import type { ThemeColorTokens } from './types';
import { STRUCTURAL_KEYS } from './types';
import { getPalette, getStyle } from './registry';

type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * All CSS property keys a theme can define — used for cleanup when switching.
 * MUST include every key from ThemeColorTokens to prevent stale values.
 */
const TOKEN_KEYS: (keyof ThemeColorTokens)[] = [
  // ── Backgrounds ──
  '--color-bg-primary', '--color-bg-secondary', '--color-bg-tertiary',
  '--color-bg-quaternary', '--color-bg-panel', '--color-bg-translucent',
  // ── Lines / Dividers ──
  '--color-line-secondary', '--color-line-tertiary',
  // ── Borders ──
  '--color-border-primary', '--color-border-secondary', '--color-border-translucent',
  // ── Text ──
  '--color-text-primary', '--color-text-secondary', '--color-text-tertiary',
  '--color-text-quaternary', '--color-text-on-color',
  // ── Accent / Brand ──
  '--color-accent', '--color-accent-hover', '--color-accent-tint', '--color-brand-text',
  // ── Semantic palette ──
  '--color-blue', '--color-green', '--color-orange', '--color-purple',
  '--color-success', '--color-success-light', '--color-warning', '--color-warning-light',
  '--color-danger', '--color-danger-light', '--color-danger-tint', '--color-info',
  // ── Header ──
  '--header-bg', '--header-border',
  // ── Overlay ──
  '--color-overlay-primary',
  // ── Glass ──
  '--glass-bg', '--glass-bg-sidebar', '--glass-bg-content', '--glass-border', '--glass-shadow',
  // ── Shadows ──
  '--shadow-tiny', '--shadow-low', '--shadow-medium', '--shadow-high',
  // ── Grid ──
  '--grid-line-color',
  // ── Structural — border, radius, font, hover ──
  '--border-width', '--border-width-heavy', '--radius-base',
  '--font-heading', '--font-base',
  '--shadow-interactive', '--shadow-interactive-hover',
  '--translate-hover-x', '--translate-hover-y',
  // ── Typography structural ──
  '--font-weight-heading', '--letter-spacing-heading', '--text-transform-heading',
  '--font-weight-kpi', '--letter-spacing-kpi',
  '--text-transform-label', '--letter-spacing-label',
  '--text-transform-button', '--letter-spacing-button',
  '--text-transform-badge', '--letter-spacing-badge',
  '--text-transform-tab', '--letter-spacing-tab',
  // ── Component dimensions ──
  '--button-height', '--button-height-compact', '--input-height',
  '--button-padding-x', '--button-padding-y', '--button-font-size',
  '--badge-padding-x', '--badge-padding-y', '--badge-font-size', '--badge-border-width',
  // ── Component visual ──
  '--card-shadow', '--card-elevated-shadow', '--icon-btn-radius',
  '--progress-height', '--progress-radius', '--progress-border',
  // ── Interaction ──
  '--opacity-disabled', '--opacity-active-press',
  '--focus-outline-width', '--focus-outline-color',
  // ── Glass / Backdrop ──
  '--backdrop-blur',
  // ── Animation Durations ──
  '--duration-fast', '--duration-normal', '--duration-slow', '--duration-slower',
  // ── Button interaction ──
  '--button-font-weight', '--btn-hover-shadow',
  '--btn-hover-translate-x', '--btn-hover-translate-y',
  '--btn-active-opacity', '--btn-active-translate-x', '--btn-active-translate-y', '--btn-active-shadow',
  // ── Icon button interaction ──
  '--icon-btn-border', '--icon-btn-hover-border', '--icon-btn-hover-shadow',
  // ── Input interaction ──
  '--input-shadow', '--input-focus-border', '--input-focus-shadow', '--select-shadow',
  // ── Ghost ──
  '--ghost-hover-border',
  // ── Component structural ──
  '--badge-font-weight', '--label-font-weight', '--kpi-label-font-size',
  '--tab-font-size', '--tab-active-font-weight', '--tab-active-bg', '--tab-active-color', '--tab-active-border',
  // ── Skeleton ──
  '--skeleton-border',
  // ── Modal / overlay / sheet ──
  '--modal-border', '--modal-shadow', '--overlay-bg',
  '--sheet-radius-mobile', '--sheet-border-mobile', '--sheet-shadow-mobile',
  // ── Table ──
  '--table-header-bg', '--table-header-border', '--table-row-border',
  // ── Layout ──
  '--sidebar-panel-shadow', '--divider-width',
  // ── Floating ──
  '--shadow-float', '--btn-group-shadow',
  // ── Button / Badge / Tab Radius ──
  '--btn-radius', '--badge-radius', '--tab-radius',
];

/** Update Safari/iOS status bar meta theme-color */
function updateMetaThemeColor(color: string) {
  const old = document.querySelector('meta[name="theme-color"]');
  if (old) old.remove();
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = color;
  document.head.appendChild(meta);
}

/** Update iOS PWA status bar text color to match dark/light mode */
function updateStatusBarStyle(isDark: boolean) {
  const meta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (meta) {
    meta.setAttribute('content', isDark ? 'black-translucent' : 'default');
  }
}

/**
 * Apply a style + palette + light/dark mode to the DOM.
 *
 * Merge logic:
 * 1. Palette provides all color tokens (backgrounds, text, accent, semantic, etc.)
 * 2. Style provides structural overrides (borders, radius, fonts, shadows, hover)
 * 3. Final = palette colors (excluding structural) + style overrides
 *
 * Special cases:
 * - default style + default palette → clear all inline overrides (tokens.css only)
 * - default style + other palette → apply palette colors only
 * - other style + any palette → apply palette colors + style overrides
 */
export function applyFullTheme(styleId: string, paletteId: string, mode: ThemeMode): void {
  const palette = getPalette(paletteId);
  const style = getStyle(styleId);
  const isDark =
    mode === 'dark' ||
    (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Toggle dark class
  document.documentElement.classList.toggle('dark', isDark);

  // Set data-theme attribute for component-level CSS overrides
  if (styleId === 'default') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.dataset.theme = styleId;
  }

  // Update meta theme-color (from palette) + iOS status bar text color
  updateMetaThemeColor(isDark ? palette.meta.dark : palette.meta.light);
  updateStatusBarStyle(isDark);

  // Build the complete set of tokens to apply BEFORE touching the DOM.
  // This avoids flicker from "clear all → re-apply" across multiple frames.
  const nextTokens = new Map<string, string>();

  if (styleId !== 'default' || paletteId !== 'default') {
    const paletteTokens = isDark ? palette.tokens.dark : palette.tokens.light;
    const styleOverrides = isDark ? style.overrides.dark : style.overrides.light;

    // Palette color tokens (skip structural — those come from style or tokens.css)
    if (paletteId !== 'default') {
      for (const [prop, value] of Object.entries(paletteTokens)) {
        if (!STRUCTURAL_KEYS.has(prop)) {
          nextTokens.set(prop, value);
        }
      }
    }

    // Style overrides on top (structural + any color adjustments)
    for (const [prop, value] of Object.entries(styleOverrides)) {
      nextTokens.set(prop, value);
    }
  }

  // Single DOM pass: set new values and remove stale ones atomically
  const htmlStyle = document.documentElement.style;
  for (const key of TOKEN_KEYS) {
    const next = nextTokens.get(key);
    if (next != null) {
      htmlStyle.setProperty(key, next);
    } else {
      htmlStyle.removeProperty(key);
    }
  }
}

// ── Legacy compat: 2-arg signature for any remaining callers ──
const _applyFullTheme = applyFullTheme;
export default _applyFullTheme;
