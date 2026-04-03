import type { StyleDefinition } from '../types';

/**
 * Space Capsule HUD style — Cockpit instrument panels, holographic readouts.
 * Inspired by sci-fi command interfaces and aircraft HUD displays.
 *
 * Structural DNA:
 * - 1px thin borders that glow with accent color
 * - Sharp corners (2px radius) — military-grade precision
 * - Glow-based shadows (box-shadow with accent color, no hard offset)
 * - Monospace headings for that "instrument readout" feel
 * - Subtle scan-line texture on surfaces (via components.css)
 * - Hover: glow intensifies, border brightens
 * - System body font for readability
 */
export const hudStyle: StyleDefinition = {
  id: 'hud',
  nameKey: 'settings.style.hud',
  descKey: 'settings.style.hudDesc',
  overrides: {
    light: {
      // ── Structural ──
      '--border-width':          '1px',
      '--border-width-heavy':    '1px',
      '--radius-base':           '2px',
      '--font-heading':          "'JetBrains Mono', 'SF Mono', 'Menlo', monospace",
      '--font-base':             "var(--font-regular)",
      '--shadow-interactive':    '0 0 8px color-mix(in srgb, var(--color-accent) 20%, transparent)',
      '--shadow-interactive-hover': '0 0 14px color-mix(in srgb, var(--color-accent) 30%, transparent)',
      '--translate-hover-x':     '0px',
      '--translate-hover-y':     '0px',

      // ── Borders — accent-tinted glow ──
      '--color-border-primary':    'color-mix(in srgb, var(--color-accent) 30%, rgba(0,0,0,0.15))',
      '--color-border-secondary':  'color-mix(in srgb, var(--color-accent) 20%, rgba(0,0,0,0.10))',
      '--color-border-translucent':'color-mix(in srgb, var(--color-accent) 15%, rgba(0,0,0,0.06))',

      // ── Lines — subtle, technical ──
      '--color-line-secondary':  'color-mix(in srgb, var(--color-accent) 10%, rgba(0,0,0,0.10))',
      '--color-line-tertiary':   'color-mix(in srgb, var(--color-accent) 8%, rgba(0,0,0,0.05))',

      // ── Header — slightly tinted ──
      '--header-bg':             'var(--color-bg-primary)',
      '--header-border':         'color-mix(in srgb, var(--color-accent) 25%, rgba(0,0,0,0.12))',

      // ── Glass — opaque, follows palette ──
      '--glass-bg':              'var(--color-bg-primary)',
      '--glass-bg-sidebar':      'var(--color-bg-secondary)',
      '--glass-bg-content':      'var(--color-bg-primary)',
      '--glass-border':          'color-mix(in srgb, var(--color-accent) 25%, rgba(0,0,0,0.12))',
      '--glass-shadow':          '0 0 12px color-mix(in srgb, var(--color-accent) 10%, transparent)',

      // ── Shadows — soft glow ──
      '--shadow-tiny':           '0 0 4px color-mix(in srgb, var(--color-accent) 8%, transparent)',
      '--shadow-low':            '0 0 8px color-mix(in srgb, var(--color-accent) 10%, transparent)',
      '--shadow-medium':         '0 0 16px color-mix(in srgb, var(--color-accent) 12%, transparent)',
      '--shadow-high':           '0 0 24px color-mix(in srgb, var(--color-accent) 15%, transparent)',

      // ── Tints — subtle ──
      '--color-accent-tint':     'color-mix(in srgb, var(--color-accent) 8%, transparent)',

      // ── Grid — accent-tinted faint ──
      '--grid-line-color':       'color-mix(in srgb, var(--color-accent) 5%, rgba(0,0,0,0.03))',
    },
    dark: {
      // ── Structural ──
      '--border-width':          '1px',
      '--border-width-heavy':    '1px',
      '--radius-base':           '2px',
      '--font-heading':          "'JetBrains Mono', 'SF Mono', 'Menlo', monospace",
      '--font-base':             "var(--font-regular)",
      '--shadow-interactive':    '0 0 12px color-mix(in srgb, var(--color-accent) 30%, transparent)',
      '--shadow-interactive-hover': '0 0 22px color-mix(in srgb, var(--color-accent) 45%, transparent)',
      '--translate-hover-x':     '0px',
      '--translate-hover-y':     '0px',

      // ── Borders — glowing accent edges (stronger in dark) ──
      '--color-border-primary':    'color-mix(in srgb, var(--color-accent) 45%, rgba(255,255,255,0.12))',
      '--color-border-secondary':  'color-mix(in srgb, var(--color-accent) 35%, rgba(255,255,255,0.08))',
      '--color-border-translucent':'color-mix(in srgb, var(--color-accent) 25%, rgba(255,255,255,0.05))',

      // ── Lines — accent-tinted ──
      '--color-line-secondary':  'color-mix(in srgb, var(--color-accent) 18%, rgba(255,255,255,0.08))',
      '--color-line-tertiary':   'color-mix(in srgb, var(--color-accent) 12%, rgba(255,255,255,0.04))',

      // ── Header — dark with glow ──
      '--header-bg':             'var(--color-bg-primary)',
      '--header-border':         'color-mix(in srgb, var(--color-accent) 40%, rgba(255,255,255,0.10))',

      // ── Glass — opaque dark, follows palette ──
      '--glass-bg':              'var(--color-bg-primary)',
      '--glass-bg-sidebar':      'var(--color-bg-secondary)',
      '--glass-bg-content':      'var(--color-bg-primary)',
      '--glass-border':          'color-mix(in srgb, var(--color-accent) 40%, rgba(255,255,255,0.10))',
      '--glass-shadow':          '0 0 20px color-mix(in srgb, var(--color-accent) 18%, transparent)',

      // ── Shadows — stronger accent glow in dark ──
      '--shadow-tiny':           '0 0 6px color-mix(in srgb, var(--color-accent) 15%, transparent)',
      '--shadow-low':            '0 0 12px color-mix(in srgb, var(--color-accent) 18%, transparent)',
      '--shadow-medium':         '0 0 24px color-mix(in srgb, var(--color-accent) 22%, transparent)',
      '--shadow-high':           '0 0 36px color-mix(in srgb, var(--color-accent) 28%, transparent)',

      // ── Tints — stronger in dark ──
      '--color-accent-tint':     'color-mix(in srgb, var(--color-accent) 14%, transparent)',

      // ── Grid — faint accent glow ──
      '--grid-line-color':       'color-mix(in srgb, var(--color-accent) 6%, rgba(255,255,255,0.02))',
    },
  },
};
