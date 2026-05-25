// ─────────────────────────────────────────────────────────────────────────────
// Weight helpers — single source of truth for kg display across SO/PO/MOT/TLP/GRN.
//
// Procurement flow is canonical in KG. Client can enter sheets OR weight on the
// SO; everything downstream displays kg. These helpers normalize any line shape
// (with possibly weightKg / qty / orderedQty / gsm / size) into a kg value.
// ─────────────────────────────────────────────────────────────────────────────

/** sheet area in m² given a "WxH" size string (assumed cm; tolerates "cm" suffix). */
export function sheetAreaSqM(sizeStr: string | undefined | null): number {
  if (!sizeStr) return 0;
  const parts = sizeStr.toLowerCase().replace(/cm/g, "").trim().split(/[x×]/).map((s) => parseFloat(s.trim()));
  if (parts.length !== 2 || parts.some(isNaN)) return 0;
  return (parts[0] / 100) * (parts[1] / 100);
}

/** Convert sheets → kg using GSM × area. */
export function calcWeightKg(gsm: number | undefined | null, sizeStr: string | undefined | null, sheetCount: number): number {
  if (!gsm || !sheetCount) return 0;
  const area = sheetAreaSqM(sizeStr);
  return area > 0 ? Math.round((sheetCount * gsm * area) / 1000) : 0;
}

/** Convert kg → sheets (inverse of calcWeightKg). Returns 0 if size/gsm missing. */
export function sheetsFromKg(gsm: number | undefined | null, sizeStr: string | undefined | null, kg: number): number {
  if (!gsm || !kg) return 0;
  const area = sheetAreaSqM(sizeStr);
  return area > 0 ? Math.round((kg * 1000) / (gsm * area)) : 0;
}

/**
 * Canonical kg for a line. Priority:
 *   1. explicit weightKg field
 *   2. compute from sheets (qty) + gsm + size
 *   3. orderedQty (assumed already kg in the procurement flow)
 */
export function lineWeightKg(line: {
  weightKg?: number | null;
  qty?: number | null;
  orderedQty?: number | null;
  quantity?: number | null;
  gsm?: number | null;
  size?: string | null;
}): number {
  if (line.weightKg && line.weightKg > 0) return Math.round(line.weightKg);
  const sheetCount = line.qty ?? 0;
  if (sheetCount > 0) {
    const fromSheets = calcWeightKg(line.gsm, line.size, sheetCount);
    if (fromSheets > 0) return fromSheets;
  }
  return Math.round(line.orderedQty ?? line.quantity ?? 0);
}

/** Returns sheet count if the user explicitly entered sheets, otherwise null. */
export function lineSheetCount(line: { qty?: number | null }): number | null {
  return line.qty && line.qty > 0 ? line.qty : null;
}
