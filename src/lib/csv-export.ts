/**
 * Generic CSV export utility.
 * Converts an array of objects to CSV and triggers download.
 */
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
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
