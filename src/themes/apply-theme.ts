import type { ThemeColorTokens } from './types';
import { STRUCTURAL_KEYS } from './types';
import { getPalette, getStyle } from './registry';

type ThemeMode = 'light' | 'dark' | 'auto';

/** All CSS property keys a theme defines — used for cleanup */
const TOKEN_KEYS: (keyof ThemeColorTokens)[] = [
  '--color-bg-primary', '--color-bg-secondary', '--color-bg-tertiary',
  '--color-bg-quaternary', '--color-bg-panel', '--color-bg-translucent',
  '--color-line-secondary', '--color-line-tertiary',
  '--color-border-primary', '--color-border-secondary', '--color-border-translucent',
  '--color-text-primary', '--color-text-secondary', '--color-text-tertiary',
  '--color-text-quaternary', '--color-text-on-color',
  '--color-accent', '--color-accent-hover', '--color-accent-tint', '--color-brand-text',
  '--color-blue', '--color-green', '--color-orange', '--color-purple',
  '--color-success', '--color-success-light', '--color-warning', '--color-warning-light',
  '--color-danger', '--color-danger-light', '--color-danger-tint', '--color-info',
  '--header-bg', '--header-border',
  '--color-overlay-primary',
  '--glass-bg', '--glass-bg-sidebar', '--glass-bg-content', '--glass-border', '--glass-shadow',
  '--shadow-tiny', '--shadow-low', '--shadow-medium', '--shadow-high',
  '--grid-line-color',
  '--border-width', '--border-width-heavy', '--radius-base',
  '--font-heading', '--font-base',
  '--shadow-interactive', '--shadow-interactive-hover',
  '--translate-hover-x', '--translate-hover-y',
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

  // Update meta theme-color (from palette)
  updateMetaThemeColor(isDark ? palette.meta.dark : palette.meta.light);

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
