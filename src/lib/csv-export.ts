/**
 * Generic CSV export utility.
 * Converts an array of objects to CSV and triggers download.
 */
import { todayDateKey } from "./date-utils";

export function exportCSV(data: Record<string, any>[], filename: string, columns?: { key: string; label: string }[]) {
  if (!data.length) return;

  const cols = columns || Object.keys(data[0]).map(k => ({ key: k, label: k }));
  const header = cols.map(c => `"${c.label}"`).join(",");
  const rows = data.map(row =>
    cols.map(c => {
      let val = String(row[c.key] ?? "").replace(/"/g, '""');
      // Prevent CSV formula injection: prefix dangerous chars with tab
      if (/^[=+\-@\t\r]/.test(val)) val = "\t" + val;
      return `"${val}"`;
    }).join(",")
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  // Filename date uses user's configured timezone (not UTC) so midnight
  // exports don't show "yesterday" in the filename.
  a.download = `${filename}-${todayDateKey()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
