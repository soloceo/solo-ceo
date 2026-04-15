/**
 * Localized date formatting utility.
 * Converts ISO date strings (YYYY-MM-DD or YYYY-MM-DDThh:mm) to friendly
 * locale format. Input is treated as a CALENDAR DATE, not an instant —
 * the displayed month/day always matches the stored date regardless of
 * browser timezone or user-configured timezone.
 */

/** Short date: "3月26日" / "Mar 26" */
export function fmtDate(iso: string, lang: string): string {
  if (!iso) return "—";
  // Extract calendar date part; ignore time component to avoid TZ ambiguity.
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  try {
    // Parse as UTC and format as UTC — guarantees output matches stored date.
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
