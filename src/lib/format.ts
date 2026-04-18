/**
 * Localized date + money formatting utilities.
 *
 * `fmtDate` preserves the ISO calendar date regardless of browser timezone.
 * `formatMoney` / `getCurrencySymbol` drive display off `settings.currency`
 * — this is the single source of truth so a user who picks CNY in
 * Settings → Preferences actually sees ¥ everywhere, instead of the
 * pre-existing situation where `$` was hard-coded in 20+ places.
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

/* ─────────── Money formatting ─────────── */

const CURRENCY_SYMBOL_FALLBACK: Record<string, string> = {
  USD: '$',
  CAD: '$',
  AUD: '$',
  CNY: '¥',
  JPY: '¥',
  EUR: '€',
  GBP: '£',
  HKD: '$',
  SGD: '$',
  TWD: 'NT$',
};

function localeFor(lang: string | undefined): string {
  return lang === 'zh' ? 'zh-CN' : 'en-US';
}

/**
 * Returns the glyph that precedes a number for the given currency. Used by
 * component code that has its own number formatting pipeline and only needs
 * the short symbol (e.g. "$12.3k" on a chart tick).
 */
export function getCurrencySymbol(currency: string = 'USD', lang: string = 'en'): string {
  const ccy = (currency || 'USD').toUpperCase();
  try {
    const parts = new Intl.NumberFormat(localeFor(lang), {
      style: 'currency',
      currency: ccy,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    const sym = parts.find((p) => p.type === 'currency')?.value;
    if (sym) return sym;
  } catch {
    // Intl may throw for non-ISO currency codes — fall through to our table
  }
  return CURRENCY_SYMBOL_FALLBACK[ccy] ?? ccy;
}

export interface FormatMoneyOptions {
  /** "$1,234.56" → always prefix with + / -. Default: off (negatives get "-"). */
  showSign?: boolean;
  /** Treat the amount as an absolute value (caller draws the sign themselves). */
  absolute?: boolean;
  /** Force a specific number of fraction digits. Default: 0 if whole, else 2. */
  fractionDigits?: number;
}

/**
 * Format a money amount in the user's chosen currency + language.
 * Robust against NaN / null / string inputs (coerces via Number).
 * Returns a plain-string price, e.g. "$1,234.56", "¥500", "+$20".
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency: string = 'USD',
  lang: string = 'en',
  opts: FormatMoneyOptions = {},
): string {
  const raw = Number(amount ?? 0);
  const safe = Number.isFinite(raw) ? raw : 0;
  const value = opts.absolute ? Math.abs(safe) : safe;
  const { showSign = false, fractionDigits } = opts;
  const ccy = (currency || 'USD').toUpperCase();
  const locale = localeFor(lang);

  // Decide fraction digits — if explicit, honour it; else show 2 when there's
  // a fractional part, and 0 when it's a whole number (matches existing UX
  // where "$100" is preferred over "$100.00" for round numbers).
  const frac = fractionDigits ?? (Number.isInteger(value) ? 0 : 2);

  let body: string;
  try {
    body = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: ccy,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: frac,
      maximumFractionDigits: frac,
    }).format(value);
  } catch {
    // Unknown currency code → fall back to symbol + number, same shape
    const sym = CURRENCY_SYMBOL_FALLBACK[ccy] ?? ccy;
    body = `${value < 0 ? '-' : ''}${sym}${Math.abs(value).toLocaleString(locale, {
      minimumFractionDigits: frac,
      maximumFractionDigits: frac,
    })}`;
  }

  if (showSign && safe >= 0 && !opts.absolute) return `+${body}`;
  return body;
}
