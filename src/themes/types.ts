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

  // ── Typography — Structural (per-element text DNA) ──
  // Optional: styles override these; palettes don't need to.
  '--font-weight-heading'?: string;
  '--letter-spacing-heading'?: string;
  '--text-transform-heading'?: string;
  '--font-weight-kpi'?: string;
  '--letter-spacing-kpi'?: string;
  '--text-transform-label'?: string;
  '--letter-spacing-label'?: string;
  '--text-transform-button'?: string;
  '--letter-spacing-button'?: string;
  '--text-transform-badge'?: string;
  '--letter-spacing-badge'?: string;
  '--text-transform-tab'?: string;
  '--letter-spacing-tab'?: string;

  // ── Component Dimensions ──
  '--button-height'?: string;
  '--button-height-compact'?: string;
  '--input-height'?: string;
  '--button-padding-x'?: string;
  '--button-padding-y'?: string;
  '--button-font-size'?: string;
  '--badge-padding-x'?: string;
  '--badge-padding-y'?: string;
  '--badge-font-size'?: string;
  '--badge-border-width'?: string;

  // ── Component Visual ──
  '--card-shadow'?: string;
  '--card-elevated-shadow'?: string;
  '--icon-btn-radius'?: string;
  '--progress-height'?: string;
  '--progress-radius'?: string;
  '--progress-border'?: string;

  // ── Interaction States ──
  '--opacity-disabled'?: string;
  '--opacity-active-press'?: string;
  '--focus-outline-width'?: string;
  '--focus-outline-color'?: string;

  // ── Glass / Backdrop ──
  '--backdrop-blur'?: string;

  // ── Animation Durations ──
  '--duration-fast'?: string;
  '--duration-normal'?: string;
  '--duration-slow'?: string;
  '--duration-slower'?: string;

  // ── Button Interaction Model ──
  '--button-font-weight'?: string;
  '--btn-hover-shadow'?: string;
  '--btn-hover-translate-x'?: string;
  '--btn-hover-translate-y'?: string;
  '--btn-active-opacity'?: string;
  '--btn-active-translate-x'?: string;
  '--btn-active-translate-y'?: string;
  '--btn-active-shadow'?: string;

  // ── Icon Button Interaction ──
  '--icon-btn-border'?: string;
  '--icon-btn-hover-border'?: string;
  '--icon-btn-hover-shadow'?: string;

  // ── Input Interaction ──
  '--input-shadow'?: string;
  '--input-focus-border'?: string;
  '--input-focus-shadow'?: string;
  '--select-shadow'?: string;

  // ── Ghost Button ──
  '--ghost-hover-border'?: string;

  // ── Component Structural ──
  '--badge-font-weight'?: string;
  '--label-font-weight'?: string;
  '--kpi-label-font-size'?: string;
  '--tab-font-size'?: string;
  '--tab-active-font-weight'?: string;
  '--tab-active-bg'?: string;
  '--tab-active-color'?: string;
  '--tab-active-border'?: string;

  // ── Skeleton ──
  '--skeleton-border'?: string;

  // ── Modal / Overlay / Sheet ──
  '--modal-border'?: string;
  '--modal-shadow'?: string;
  '--overlay-bg'?: string;
  '--sheet-radius-mobile'?: string;
  '--sheet-border-mobile'?: string;
  '--sheet-shadow-mobile'?: string;

  // ── Table ──
  '--table-header-bg'?: string;
  '--table-header-border'?: string;
  '--table-row-border'?: string;

  // ── Layout Panels ──
  '--sidebar-panel-shadow'?: string;
  '--divider-width'?: string;

  // ── Floating Elements ──
  '--shadow-float'?: string;
  '--btn-group-shadow'?: string;

  // ── Button / Badge / Tab Radius ──
  '--btn-radius'?: string;
  '--badge-radius'?: string;
  '--tab-radius'?: string;
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

/** How a style renders its preview thumbnail in the picker */
export interface StylePreview {
  /** Style's signature accent color (light-mode hex) used in the picker
   *  preview so each card shows its own brand color regardless of the
   *  currently applied theme. */
  accent: string;
  card: {
    border: string;
    borderRadius: string;
    boxShadow: string;
  };
  elements: {
    /** 'bar' = accent bar + text lines, 'chip-row' = pill + chip row */
    accentShape: 'bar' | 'chip-row';
    accentRadius: number | string;
    textLineRadius: number;
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
  /** Display order in the style picker (lower = first) */
  order: number;
  /** Self-describing preview for the settings picker */
  preview: StylePreview;
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
  // Typography structural
  '--font-weight-heading', '--letter-spacing-heading', '--text-transform-heading',
  '--font-weight-kpi', '--letter-spacing-kpi',
  '--text-transform-label', '--letter-spacing-label',
  '--text-transform-button', '--letter-spacing-button',
  '--text-transform-badge', '--letter-spacing-badge',
  '--text-transform-tab', '--letter-spacing-tab',
  // Component dimensions
  '--button-height', '--button-height-compact', '--input-height',
  '--button-padding-x', '--button-padding-y', '--button-font-size',
  '--badge-padding-x', '--badge-padding-y', '--badge-font-size', '--badge-border-width',
  // Component visual
  '--card-shadow', '--card-elevated-shadow', '--icon-btn-radius',
  '--progress-height', '--progress-radius', '--progress-border',
  // Interaction
  '--opacity-disabled', '--opacity-active-press',
  '--focus-outline-width', '--focus-outline-color',
  // Glass
  '--backdrop-blur',
  // Durations
  '--duration-fast', '--duration-normal', '--duration-slow', '--duration-slower',
  // Button interaction
  '--button-font-weight', '--btn-hover-shadow',
  '--btn-hover-translate-x', '--btn-hover-translate-y', '--btn-active-opacity',
  '--btn-active-translate-x', '--btn-active-translate-y', '--btn-active-shadow',
  // Icon button interaction
  '--icon-btn-border', '--icon-btn-hover-border', '--icon-btn-hover-shadow',
  // Input interaction
  '--input-shadow', '--input-focus-border', '--input-focus-shadow', '--select-shadow',
  // Ghost
  '--ghost-hover-border',
  // Component structural
  '--badge-font-weight', '--label-font-weight', '--kpi-label-font-size',
  '--tab-font-size', '--tab-active-font-weight', '--tab-active-bg', '--tab-active-color', '--tab-active-border',
  // Skeleton
  '--skeleton-border',
  // Modal / overlay / sheet
  '--modal-border', '--modal-shadow', '--overlay-bg',
  '--sheet-radius-mobile', '--sheet-border-mobile', '--sheet-shadow-mobile',
  // Table
  '--table-header-bg', '--table-header-border', '--table-row-border',
  // Layout
  '--sidebar-panel-shadow', '--divider-width',
  // Floating
  '--shadow-float', '--btn-group-shadow',
  // Button / Badge / Tab Radius
  '--btn-radius', '--badge-radius', '--tab-radius',
]);
