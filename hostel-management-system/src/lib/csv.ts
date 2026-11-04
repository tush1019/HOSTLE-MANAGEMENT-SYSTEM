export function safeCsvCell(value: string): string {
  const v = String(value);
  // Preserve legitimate numeric values (including negatives).
  if (/^-?\d+(\.\d+)?$/.test(v.trim())) return v;
  // Neutralize spreadsheet formula injection for text cells.
  if (/^[=+\-@\t\r]/.test(v)) return "'" + v;
  return v;
}
