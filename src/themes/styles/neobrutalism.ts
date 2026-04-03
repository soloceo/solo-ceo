import type { StyleDefinition } from '../types';

/**
 * Neobrutalism style — Bold borders, hard shadows, punchy hover.
 * Inspired by neobrutalism.dev
 *
 * Color-agnostic: uses `var()` references for palette-derived values
 * (e.g. header-bg = var(--color-bg-primary)) so it adapts to any palette.
 *
 * Structural DNA:
 * - 2px solid borders (black light / gray dark)
 * - Hard offset shadows (4px 4px 0, no blur)
 * - Hover: shadow disappears + element snaps via translate
 * - Small border-radius (5px)
 * - Space Grotesk headings, Inter body
 */
export const neobrutalismStyle: StyleDefinition = {
  id: 'neobrutalism',
  nameKey: 'settings.style.neobrutalism',
  descKey: 'settings.style.neobrutalismDesc',
  overrides: {
    light: {
      // ── Structural ──
      '--border-width':          '2px',
      '--border-width-heavy':    '3px',
      '--radius-base':           '5px',
      '--font-heading':          "'Space Grotesk', 'Inter', var(--font-regular)",
      '--font-base':             "'Inter', var(--font-regular)",
      '--shadow-interactive':    '4px 4px 0 #000000',
      '--shadow-interactive-hover': 'none',
      '--translate-hover-x':     '4px',
      '--translate-hover-y':     '4px',

      // ── Borders — solid black ──
      '--color-border-primary':             '#000000',
      '--color-border-secondary':           '#000000',
      '--color-border-translucent':         '#000000',

      // ── Lines — stronger ──
      '--color-line-secondary':  'rgba(0,0,0,0.25)',
      '--color-line-tertiary':   'rgba(0,0,0,0.12)',

      // ── Header — opaque, follows palette bg ──
      '--header-bg':             'var(--color-bg-primary)',
      '--header-border':         '#000000',

      // ── Glass — opaque, follows palette bg ──
      '--glass-bg':              'var(--color-bg-primary)',
      '--glass-bg-sidebar':      'var(--color-bg-secondary)',
      '--glass-bg-content':      'var(--color-bg-primary)',
      '--glass-border':          '#000000',
      '--glass-shadow':          '3px 3px 0 #000000',

      // ── Shadows — hard offset, zero blur ──
      '--shadow-tiny':           '2px 2px 0 #000000',
      '--shadow-low':            '4px 4px 0 #000000',
      '--shadow-medium':         '4px 4px 0 #000000',
      '--shadow-high':           '6px 6px 0 #000000',

      // ── Tints — stronger via color-mix ──
      '--color-accent-tint':     'color-mix(in srgb, var(--color-accent) 25%, transparent)',

      // ── Grid — stronger ──
      '--grid-line-color':       'rgba(0,0,0,0.06)',
    },
    dark: {
      // ── Structural ──
      '--border-width':          '2px',
      '--border-width-heavy':    '3px',
      '--radius-base':           '5px',
      '--font-heading':          "'Space Grotesk', 'Inter', var(--font-regular)",
      '--font-base':             "'Inter', var(--font-regular)",
      '--shadow-interactive':    '4px 4px 0 #555555',
      '--shadow-interactive-hover': 'none',
      '--translate-hover-x':     '4px',
      '--translate-hover-y':     '4px',

      // ── Borders — visible gray ──
      '--color-border-primary':             '#666666',
      '--color-border-secondary':           '#666666',
      '--color-border-translucent':         '#666666',

      // ── Lines — stronger ──
      '--color-line-secondary':  'rgba(255,255,255,0.2)',
      '--color-line-tertiary':   'rgba(255,255,255,0.1)',

      // ── Header — opaque, follows palette bg ──
      '--header-bg':             'var(--color-bg-primary)',
      '--header-border':         '#666666',

      // ── Glass — opaque, follows palette bg ──
      '--glass-bg':              'var(--color-bg-primary)',
      '--glass-bg-sidebar':      'var(--color-bg-secondary)',
      '--glass-bg-content':      'var(--color-bg-primary)',
      '--glass-border':          '#666666',
      '--glass-shadow':          '3px 3px 0 #666666',

      // ── Shadows — hard offset gray ──
      '--shadow-tiny':           '2px 2px 0 #555555',
      '--shadow-low':            '4px 4px 0 #555555',
      '--shadow-medium':         '4px 4px 0 #555555',
      '--shadow-high':           '6px 6px 0 #555555',

      // ── Tints — stronger via color-mix ──
      '--color-accent-tint':     'color-mix(in srgb, var(--color-accent) 22%, transparent)',

      // ── Grid — stronger ──
      '--grid-line-color':       'rgba(255,255,255,0.04)',
    },
  },
};
