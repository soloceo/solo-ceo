import type { StyleDefinition } from '../types';

/**
 * Material style — Google Material Design 3 (Material You).
 *
 * Structural DNA:
 * - Zero visible borders — elevation (box-shadow) creates hierarchy
 * - Google's exact shadow tokens: rgba(60,64,67,0.3) + rgba(60,64,67,0.15)
 * - Large border-radius (12px base → 16px cards → 28px FAB/chips)
 * - Google Sans / Inter font stack
 * - Hover: background tint change, no translate
 * - Opaque surfaces — no glassmorphism or blur
 * - Active state: subtle opacity 0.85, no hard press
 */
export const materialStyle: StyleDefinition = {
  id: 'material',
  nameKey: 'settings.style.material',
  descKey: 'settings.style.materialDesc',
  overrides: {
    light: {
      // ── Structural ──
      '--border-width':          '0px',
      '--border-width-heavy':    '1px',
      '--radius-base':           '12px',
      '--font-heading':          "'Google Sans', 'Inter', var(--font-regular)",
      '--font-base':             "'Google Sans Text', 'Inter', var(--font-regular)",

      // ── Borders — invisible, elevation does the work ──
      '--color-border-primary':    'rgba(0,0,0,0.06)',
      '--color-border-secondary':  'rgba(0,0,0,0.08)',
      '--color-border-translucent':'transparent',

      // ── Lines — very subtle ──
      '--color-line-secondary':  'rgba(0,0,0,0.07)',
      '--color-line-tertiary':   'rgba(0,0,0,0.04)',

      // ── Header — solid, shadow instead of border ──
      '--header-bg':             '#ffffff',
      '--header-border':         'transparent',

      // ── Glass — fully opaque tonal surfaces ──
      '--glass-bg':              '#ffffff',
      '--glass-bg-sidebar':      '#f8f9fa',
      '--glass-bg-content':      '#ffffff',
      '--glass-border':          'transparent',
      '--glass-shadow':          '0 1px 2px rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',

      // ── Shadows — MD3 elevation system ──
      '--shadow-tiny':           '0 1px 2px rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',
      '--shadow-low':            '0 1px 2px rgba(60,64,67,0.3), 0 2px 6px 2px rgba(60,64,67,0.15)',
      '--shadow-medium':         '0 1px 3px rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)',
      '--shadow-high':           '0 2px 6px rgba(60,64,67,0.3), 0 8px 24px 6px rgba(60,64,67,0.15)',

      // ── Interactive — shadow lift, no translate ──
      '--shadow-interactive':       'none',
      '--shadow-interactive-hover': '0 1px 2px rgba(60,64,67,0.3), 0 2px 6px 2px rgba(60,64,67,0.15)',
      '--translate-hover-x':       '0px',
      '--translate-hover-y':       '0px',

      // ── Tint ──
      '--color-accent-tint':     'color-mix(in srgb, var(--color-accent) 8%, transparent)',

      // ── Grid ──
      '--grid-line-color':       'rgba(0,0,0,0.03)',
    },
    dark: {
      // ── Structural ──
      '--border-width':          '0px',
      '--border-width-heavy':    '1px',
      '--radius-base':           '12px',
      '--font-heading':          "'Google Sans', 'Inter', var(--font-regular)",
      '--font-base':             "'Google Sans Text', 'Inter', var(--font-regular)",

      // ── Borders — tonal surfaces, minimal borders ──
      '--color-border-primary':    'rgba(255,255,255,0.08)',
      '--color-border-secondary':  'rgba(255,255,255,0.1)',
      '--color-border-translucent':'transparent',

      // ── Lines ──
      '--color-line-secondary':  'rgba(255,255,255,0.08)',
      '--color-line-tertiary':   'rgba(255,255,255,0.04)',

      // ── Header ──
      '--header-bg':             '#1f1f1f',
      '--header-border':         'transparent',

      // ── Glass — opaque tonal dark surfaces ──
      '--glass-bg':              '#292a2d',
      '--glass-bg-sidebar':      '#292a2d',
      '--glass-bg-content':      '#1f1f1f',
      '--glass-border':          'transparent',
      '--glass-shadow':          '0 1px 3px rgba(0,0,0,0.5)',

      // ── Shadows — subtler in dark ──
      '--shadow-tiny':           '0 1px 2px rgba(0,0,0,0.4)',
      '--shadow-low':            '0 1px 3px rgba(0,0,0,0.45)',
      '--shadow-medium':         '0 2px 8px rgba(0,0,0,0.5)',
      '--shadow-high':           '0 4px 16px rgba(0,0,0,0.55)',

      // ── Interactive ──
      '--shadow-interactive':       'none',
      '--shadow-interactive-hover': '0 1px 3px rgba(0,0,0,0.45)',
      '--translate-hover-x':       '0px',
      '--translate-hover-y':       '0px',

      // ── Tint ──
      '--color-accent-tint':     'color-mix(in srgb, var(--color-accent) 12%, transparent)',

      // ── Grid ──
      '--grid-line-color':       'rgba(255,255,255,0.02)',
    },
  },
};
