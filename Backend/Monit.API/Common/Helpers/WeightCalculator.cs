using System.Globalization;

namespace Monit.API.Common.Helpers;

// Canonical SO-line weight-in-kg calculator — mirrors frontend/lib/weight.ts
// `lineWeightKg()`. Some SO lines store their "kg" field as a raw SHEET COUNT
// instead of an actual weight: the SO form converts sheets → kg using the
// material's WeightPerSheet, and silently falls back to storing the raw
// sheet count when that master field is missing/zero. The safe, independent
// way to recover the true kg value is GSM × sheet area × sheet count — this
// only falls back to the stored value when sheets/GSM/size aren't available
// to compute from.
public static class WeightCalculator
{
    public static decimal LineWeightKg(decimal storedQty, int? sheetQty, int? gsm, string? size)
    {
        if (sheetQty is int sheets && sheets > 0 && gsm is int g && g > 0)
        {
            var area = SheetAreaSqM(size);
            if (area > 0)
            {
                var fromSheets = Math.Round(sheets * g * area / 1000m, 0, MidpointRounding.AwayFromZero);
                if (fromSheets > 0) return fromSheets;
            }
        }
        return storedQty;
    }

    public static decimal SheetAreaSqM(string? sizeStr)
    {
        if (string.IsNullOrWhiteSpace(sizeStr)) return 0;
        var sep = sizeStr.IndexOfAny(['x', 'X', '×']);
        if (sep < 0) return 0;
        var lengthStr = sizeStr[..sep].Trim();
        var widthStr  = sizeStr[(sep + 1)..].Trim();
        if (!decimal.TryParse(lengthStr, NumberStyles.Number, CultureInfo.InvariantCulture, out var length)) return 0;
        if (!decimal.TryParse(widthStr, NumberStyles.Number, CultureInfo.InvariantCulture, out var width)) return 0;
        return (length / 100m) * (width / 100m);
    }
}
