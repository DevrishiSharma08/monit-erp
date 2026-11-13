using System.Data;
using System.Globalization;
using System.Text.RegularExpressions;
using Dapper;

namespace Monit.API.Services.Masters;

/// <summary>
/// Resolves a free-typed Item Code (e.g. "BILT/MAPLITHO/12/23.5x36.55") into a
/// real masters.Materials row id — finding an existing matching row OR inserting
/// a new one inside the caller's transaction. Called from SO + PO line save
/// paths whenever the incoming line carries a code but no MaterialId, so the
/// rest of the downstream chain (GRN, StockLots) can keep its NOT-NULL FK on
/// MaterialId without falling over for custom one-off items.
///
/// Reuse is keyed on (MillId, QualityId, GSM, SizeLength, SizeWidth). Any one
/// of those differing produces a brand-new master — existing rows are NEVER
/// modified (no UPDATE, only SELECT for reuse or INSERT for fresh).
///
/// If the code can't be parsed (mill not in master, no GSM, no recognisable
/// size) the helper returns null and the calling repo just stores the line
/// with MaterialId = NULL; the front-end UI still shows the typed text via
/// the snapshot Description column.
/// </summary>
public static class MaterialAutoProvisioner
{
    // Match the LAST segment of an item code: "23", "23.5", "23x36", "23.5x36.55".
    private static readonly Regex SizePattern =
        new(@"^(\d+(?:\.\d+)?)(?:[xX×](\d+(?:\.\d+)?))?$", RegexOptions.Compiled);

    public static async Task<int?> EnsureAsync(
        IDbConnection  conn,
        IDbTransaction tx,
        string?        rawCode,
        string         createdBy)
    {
        if (string.IsNullOrWhiteSpace(rawCode)) return null;

        // Normalise to upper-case so case variations don't multiply the master.
        var code  = rawCode.Trim().ToUpperInvariant();
        var parts = code.Split('/', StringSplitOptions.RemoveEmptyEntries)
                        .Select(p => p.Trim())
                        .Where(p => p.Length > 0)
                        .ToArray();
        if (parts.Length < 4) return null;   // need at least Mill / Quality / GSM / Size

        var millCode = parts[0];
        var quality  = parts[1];

        // parts[2] is brand (when present) or GSM. Brand is non-numeric, GSM is a clean int.
        var hasBrand = parts.Length >= 5 && !int.TryParse(parts[2], out _);
        var gsmIdx   = hasBrand ? 3 : 2;
        var sizeIdx  = hasBrand ? 4 : 3;
        if (parts.Length <= sizeIdx) return null;

        if (!int.TryParse(parts[gsmIdx], out var gsm) || gsm <= 0) return null;

        var sizeMatch = SizePattern.Match(parts[sizeIdx]);
        if (!sizeMatch.Success) return null;
        var sizeLen = decimal.Parse(sizeMatch.Groups[1].Value, CultureInfo.InvariantCulture);
        decimal? sizeWid = sizeMatch.Groups[2].Success
            ? decimal.Parse(sizeMatch.Groups[2].Value, CultureInfo.InvariantCulture)
            : (decimal?)null;

        // ── Mill lookup — required ─────────────────────────────────────────
        var millId = await conn.ExecuteScalarAsync<int?>(
            @"SELECT TOP 1 Id FROM masters.Mills
              WHERE IsDeleted = 0 AND (UPPER(Code) = @C OR UPPER([Name]) = @C)",
            new { C = millCode }, tx);
        if (millId == null) return null;

        // ── Quality lookup — optional ──────────────────────────────────────
        var qualityId = await conn.ExecuteScalarAsync<int?>(
            @"SELECT TOP 1 Id FROM masters.StockSubGroups
              WHERE IsDeleted = 0 AND (UPPER([Name]) = @Q OR UPPER(Alias) = @Q)",
            new { Q = quality }, tx);

        // ── ItemType derived from size shape ───────────────────────────────
        // Client convention: 2 size parameters (length × width) ⇒ Sheet,
        // single parameter (just length / diameter) ⇒ Reel.
        // Look up the actual id from masters.ItemTypes so this still works
        // even if the team renames or re-orders the rows.
        var itemTypeName = sizeWid.HasValue ? "Sheet" : "Reel";
        var itemTypeId   = await conn.ExecuteScalarAsync<int?>(
            @"SELECT TOP 1 Id FROM masters.ItemTypes
              WHERE IsDeleted = 0 AND UPPER([Name]) = @N",
            new { N = itemTypeName.ToUpperInvariant() }, tx);

        // ── Grain derived from sheet dimensions ────────────────────────────
        // Only meaningful for Sheet items. Convention:
        //   width > length ⇒ Long Grain
        //   width < length ⇒ Short Grain
        //   width = length (square) or Reel ⇒ null
        string? grain = null;
        if (sizeWid.HasValue)
        {
            if      (sizeWid.Value > sizeLen) grain = "Long Grain";
            else if (sizeWid.Value < sizeLen) grain = "Short Grain";
        }

        // ── Reuse: find an existing material with the same key ────────────
        var existing = await conn.ExecuteScalarAsync<int?>(@"
            SELECT TOP 1 Id FROM masters.Materials
            WHERE IsDeleted = 0
              AND MillId    = @MillId
              AND GSM       = @Gsm
              AND ISNULL(QualityId,  0) = ISNULL(@QualityId,  0)
              AND ISNULL(SizeLength, 0) = @SizeLen
              AND ISNULL(SizeWidth,  0) = ISNULL(@SizeWid, 0)",
            new
            {
                MillId    = millId.Value,
                Gsm       = gsm,
                QualityId = qualityId,
                SizeLen   = sizeLen,
                SizeWid   = sizeWid,
            }, tx);
        if (existing != null) return existing;

        // ── HSN inherited from sibling material (same Mill+Quality+GSM) ────
        // When the user changes only the SIZE on an existing brand line, the
        // new auto-created master should inherit the HSN/GST setup from the
        // closest "sibling" (same Mill+Quality+GSM, any size). This avoids
        // forcing the user to re-set HSN every time they record a custom-cut
        // size for a brand they've already taxed. Prefers a sibling whose
        // HsnCodeId is actually set; widens the match to Mill+GSM if no
        // Quality-matched sibling exists, then to Mill+Quality alone, before
        // giving up and leaving HsnCodeId NULL.
        var inheritedHsnId = await conn.ExecuteScalarAsync<int?>(@"
            SELECT TOP 1 HsnCodeId FROM masters.Materials
            WHERE IsDeleted = 0
              AND HsnCodeId IS NOT NULL
              AND MillId    = @MillId
              AND GSM       = @Gsm
              AND ISNULL(QualityId, 0) = ISNULL(@QualityId, 0)
            ORDER BY UpdatedAt DESC, CreatedAt DESC",
            new { MillId = millId.Value, Gsm = gsm, QualityId = qualityId }, tx);

        if (inheritedHsnId == null)
        {
            // Fallback 1: same Mill + Quality (any GSM) — covers the case
            // where this is the very first item of this brand at this GSM.
            inheritedHsnId = await conn.ExecuteScalarAsync<int?>(@"
                SELECT TOP 1 HsnCodeId FROM masters.Materials
                WHERE IsDeleted = 0
                  AND HsnCodeId IS NOT NULL
                  AND MillId    = @MillId
                  AND ISNULL(QualityId, 0) = ISNULL(@QualityId, 0)
                ORDER BY UpdatedAt DESC, CreatedAt DESC",
                new { MillId = millId.Value, QualityId = qualityId }, tx);
        }

        if (inheritedHsnId == null && qualityId != null)
        {
            // Fallback 2: same Quality across any Mill — paper HSN tends to
            // track quality (e.g. Maplitho ≈ HSN 4810) regardless of mill.
            inheritedHsnId = await conn.ExecuteScalarAsync<int?>(@"
                SELECT TOP 1 HsnCodeId FROM masters.Materials
                WHERE IsDeleted = 0
                  AND HsnCodeId IS NOT NULL
                  AND QualityId = @QualityId
                ORDER BY UpdatedAt DESC, CreatedAt DESC",
                new { QualityId = qualityId }, tx);
        }

        // ── Create the new master (existing rows are NEVER modified) ──────
        var newId = await conn.ExecuteScalarAsync<int>(@"
            INSERT INTO masters.Materials
                (Code, MillId, QualityId, ItemTypeId, GSM, SizeLength, SizeWidth, Grain,
                 HsnCodeId,
                 IsActive, CreatedAt, CreatedBy)
            OUTPUT INSERTED.Id
            VALUES (@Code, @MillId, @QualityId, @ItemTypeId, @Gsm, @SizeLen, @SizeWid, @Grain,
                    @HsnCodeId,
                    1, GETUTCDATE(), @By)",
            new
            {
                Code       = code,
                MillId     = millId.Value,
                QualityId  = qualityId,
                ItemTypeId = itemTypeId,
                Gsm        = gsm,
                SizeLen    = sizeLen,
                SizeWid    = sizeWid,
                Grain      = grain,
                HsnCodeId  = inheritedHsnId,
                By         = createdBy,
            }, tx);
        return newId;
    }
}
