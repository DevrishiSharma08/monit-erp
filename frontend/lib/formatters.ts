// Indian date format: YYYY-MM-DD → DD-MM-YYYY
export function fmtDateIN(d: string | null | undefined): string {
  if (!d) return "—";
  const iso = d.split("T")[0];
  const parts = iso.split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// Indian number format using en-IN locale
export function fmtNumIN(
  n: number | null | undefined,
  opts?: { decimals?: number; prefix?: string }
): string {
  if (n == null || isNaN(n)) return "—";
  const { decimals, prefix = "" } = opts ?? {};
  const formatted = n.toLocaleString("en-IN",
    decimals != null
      ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
      : {}
  );
  return prefix ? `${prefix}${formatted}` : formatted;
}
