/* ══════════════════════════════════════════════════════════════════
   Theme System — Type Definitions
   Each theme provides light + dark token sets that override CSS variables.
   ══════════════════════════════════════════════════════════════════ */

/** All CSS custom properties a theme must define */
export interface ThemeColorTokens {
  // ── Backgrounds ──
  '--color-bg-primary': string;
  '--color-bg-secondary': string;
  '--color-bg-tertiary': string;
  '--color-bg-quaternary': string;
  '--color-bg-panel': string;
  '--color-bg-translucent': string;

  // ── Lines / Dividers ──
  '--color-line-secondary': string;
  '--color-line-tertiary': string;

  // ── Borders ──
  '--color-border-primary': string;
  '--color-border-secondary': string;
  '--color-border-translucent': string;

  // ── Text (4-level hierarchy) ──
  '--color-text-primary': string;
  '--color-text-secondary': string;
  '--color-text-tertiary': string;
  '--color-text-quaternary': string;
  '--color-text-on-color': string;

  // ── Accent / Brand ──
  '--color-accent': string;
  '--color-accent-hover': string;
  '--color-accent-tint': string;
  '--color-brand-text': string;

  // ── Semantic palette ──
  '--color-blue': string;
  '--color-green': string;
  '--color-orange': string;
  '--color-purple': string;

  '--color-success': string;
  '--color-success-light': string;
  '--color-warning': string;
  '--color-warning-light': string;
  '--color-danger': string;
  '--color-danger-light': string;
  '--color-danger-tint': string;
  '--color-info': string;

  // ── Header ──
  '--header-bg': string;
  '--header-border': string;

  // ── Overlay ──
  '--color-overlay-primary': string;

  // ── Glass ──
  '--glass-bg': string;
  '--glass-bg-sidebar': string;
  '--glass-bg-content': string;
  '--glass-border': string;
  '--glass-shadow': string;

  // ── Shadows ──
  '--shadow-tiny': string;
  '--shadow-low': string;
  '--shadow-medium': string;
  '--shadow-high': string;

  // ── Grid ──
  '--grid-line-color': string;

  // ── Structural — border, radius, font, hover ──
  '--border-width': string;
  '--border-width-heavy': string;
  '--radius-base': string;
  '--font-heading': string;
  '--font-base': string;
  '--shadow-interactive': string;
  '--shadow-interactive-hover': string;
  '--translate-hover-x': string;
  '--translate-hover-y': string;
}

/** Complete theme definition — used by palette files (drop-in format) */
export interface ThemeDefinition {
  /** Unique theme identifier */
  id: string;
  /** i18n key for theme display name (e.g. "settings.theme.ocean") */
  nameKey: string;
  /** i18n key for theme description (e.g. "settings.theme.oceanDesc") */
  descKey: string;
  /** Colors for the theme picker preview card */
  preview: {
    accent: string;
    bg: string;
    text: string;
  };
  /** Meta theme-color for iOS/Android status bar */
  meta: {
    light: string;
    dark: string;
  };
  /** Token overrides for light and dark modes */
  tokens: {
    light: ThemeColorTokens;
    dark: ThemeColorTokens;
  };
}

/**
 * Style definition — controls structural DNA (borders, radius, shadows, fonts, hover).
 * Overrides are merged ON TOP of palette tokens. Use `var()` references
 * for palette-derived values (e.g. `var(--color-bg-primary)` for opaque header).
 */
export interface StyleDefinition {
  id: string;
  nameKey: string;
  descKey: string;
  overrides: {
    light: Partial<ThemeColorTokens>;
    dark: Partial<ThemeColorTokens>;
  };
}

/** CSS property keys that are structural (not color) — filtered from palette application */
export const STRUCTURAL_KEYS = new Set([
  '--border-width', '--border-width-heavy', '--radius-base',
  '--font-heading', '--font-base',
  '--shadow-interactive', '--shadow-interactive-hover',
  '--translate-hover-x', '--translate-hover-y',
]);
