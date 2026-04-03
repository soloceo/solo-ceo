import type { StyleDefinition } from '../types';

/**
 * Glassmorphism style — Frosted glass, translucent surfaces, soft glow.
 * Inspired by Apple Liquid Glass / iOS design language.
 *
 * Structural DNA:
 * - 1px translucent borders (white/black at low opacity)
 * - Diffuse, multi-layer shadows (no hard edges)
 * - Large border-radius (12px)
 * - backdrop-filter: blur() on key surfaces (via components.css)
 * - Hover: lift up (translateY -2px) + shadow grow
 * - System fonts (same as Classic)
 */
export const glassmorphismStyle: StyleDefinition = {
  id: 'glassmorphism',
  nameKey: 'settings.style.glassmorphism',
  descKey: 'settings.style.glassmorphismDesc',
  overrides: {
    light: {
      // ── Structural ──
      '--border-width':          '1px',
      '--border-width-heavy':    '1px',
      '--radius-base':           '12px',

      // ── Borders — very subtle ──
      '--color-border-primary':    'rgba(0,0,0,0.08)',
      '--color-border-secondary':  'rgba(0,0,0,0.12)',
      '--color-border-translucent':'rgba(0,0,0,0.05)',

      // ── Lines — lighter ──
      '--color-line-secondary':  'rgba(0,0,0,0.06)',
      '--color-line-tertiary':   'rgba(0,0,0,0.04)',

      // ── Header — translucent glass ──
      '--header-bg':             'rgba(255,255,255,0.70)',
      '--header-border':         'rgba(0,0,0,0.06)',

      // ── Glass — Apple-aligned transparency (web needs higher than native due to no GPU lensing) ──
      '--glass-bg':              'rgba(255,255,255,0.45)',
      '--glass-bg-sidebar':      'rgba(245,244,240,0.55)',
      '--glass-bg-content':      'rgba(255,255,255,0.58)',
      '--glass-border':          'rgba(255,255,255,0.6)',
      '--glass-shadow':          '0 8px 32px rgba(0,0,0,0.06)',

      // ── Shadows — glass creates depth via blur+translucency, not shadow ──
      '--shadow-tiny':           'none',
      '--shadow-low':            'none',
      '--shadow-medium':         'none',
      '--shadow-high':           '0 16px 48px rgba(0,0,0,0.08)',

      // ── Interactive — lift hover ──
      '--shadow-interactive':       '0 4px 16px rgba(0,0,0,0.08)',
      '--shadow-interactive-hover': '0 8px 24px rgba(0,0,0,0.12)',
      '--translate-hover-x':       '0px',
      '--translate-hover-y':       '0px',

      // ── Tint — softer ──
      '--color-accent-tint':     'color-mix(in srgb, var(--color-accent) 12%, transparent)',

      // ── Grid — barely visible ──
      '--grid-line-color':       'rgba(0,0,0,0.03)',
    },
    dark: {
      // ── Structural ──
      '--border-width':          '1px',
      '--border-width-heavy':    '1px',
      '--radius-base':           '12px',

      // ── Borders — subtle glow (0.10-0.12 avoids harsh wireframe) ──
      '--color-border-primary':    'rgba(255,255,255,0.12)',
      '--color-border-secondary':  'rgba(255,255,255,0.15)',
      '--color-border-translucent':'rgba(255,255,255,0.08)',

      // ── Lines — subtle but visible ──
      '--color-line-secondary':  'rgba(255,255,255,0.09)',
      '--color-line-tertiary':   'rgba(255,255,255,0.05)',

      // ── Header — translucent glass ──
      '--header-bg':             'rgba(15,23,42,0.68)',
      '--header-border':         'rgba(255,255,255,0.10)',

      // ── Glass — opaque enough for dark legibility, translucent for orb bleed ──
      '--glass-bg':              'rgba(15,23,42,0.55)',
      '--glass-bg-sidebar':      'rgba(15,20,35,0.62)',
      '--glass-bg-content':      'rgba(15,23,42,0.68)',
      '--glass-border':          'rgba(255,255,255,0.10)',
      '--glass-shadow':          '0 8px 32px rgba(0,0,0,0.5)',

      // ── Shadows — glass creates depth via blur+translucency, not shadow ──
      '--shadow-tiny':           'none',
      '--shadow-low':            'none',
      '--shadow-medium':         'none',
      '--shadow-high':           '0 16px 48px rgba(0,0,0,0.25)',

      // ── Interactive — lift hover ──
      '--shadow-interactive':       '0 4px 16px rgba(0,0,0,0.25)',
      '--shadow-interactive-hover': '0 8px 24px rgba(0,0,0,0.35)',
      '--translate-hover-x':       '0px',
      '--translate-hover-y':       '0px',

      // ── Tint — softer ──
      '--color-accent-tint':     'color-mix(in srgb, var(--color-accent) 15%, transparent)',

      // ── Grid — barely visible ──
      '--grid-line-color':       'rgba(255,255,255,0.02)',
    },
  },
};
