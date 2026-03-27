/**
 * Localized date formatting utility
 * Converts ISO date strings (2026-03-26) to friendly locale format
 */

/** Short date: "3月26日" / "Mar 26" */
export function fmtDate(iso: string, lang: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Full date: "2026年3月26日" / "Mar 26, 2026" */
export function fmtDateFull(iso: string, lang: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Relative date badge text for task cards: overdue / today / date */
export function fmtDueDate(iso: string, lang: string): string {
  return fmtDate(iso, lang);
}
