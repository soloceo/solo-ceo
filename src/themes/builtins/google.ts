import type { ThemeDefinition } from '../types';

/**
 * Google — Authentic Google Workspace color palette.
 *
 * References: Gmail, Google Calendar, Google Drive, Google Docs.
 * Light: pure white surfaces, #f8f9fa secondary, #dadce0 borders.
 * Dark : Google's "Dark theme" — #1f1f1f base, pastel accent shift.
 * All glass surfaces opaque — Google never uses glassmorphism.
 */
export const googleTheme: ThemeDefinition = {
  id: 'google',
  nameKey: 'settings.theme.google',
  descKey: 'settings.theme.googleDesc',
  preview: { accent: '#1a73e8', bg: '#ffffff', text: '#202124' },
  meta: { light: '#ffffff', dark: '#1f1f1f' },
  tokens: {
    light: {
      // ── Backgrounds — Google Workspace white + neutral grays ──
      '--color-bg-primary':      '#ffffff',
      '--color-bg-secondary':    '#f8f9fa',     // Google surface container
      '--color-bg-tertiary':     '#f1f3f4',     // Google surface container high
      '--color-bg-quaternary':   '#e8eaed',     // Google surface dim
      '--color-bg-panel':        '#ffffff',
      '--color-bg-translucent':  'rgba(32,33,36,0.04)',

      // ── Lines — Google's signature #dadce0 divider ──
      '--color-line-secondary':  '#dadce0',
      '--color-line-tertiary':   '#e8eaed',

      // ── Borders — clean, consistent ──
      '--color-border-primary':    '#dadce0',
      '--color-border-secondary':  '#dadce0',
      '--color-border-translucent':'rgba(0,0,0,0.06)',

      // ── Text — Google's 4-level charcoal hierarchy ──
      '--color-text-primary':    '#202124',
      '--color-text-secondary':  '#5f6368',
      '--color-text-tertiary':   '#80868b',
      '--color-text-quaternary': '#9aa0a6',
      '--color-text-on-color':   '#ffffff',

      // ── Accent — Google Blue 500 ──
      '--color-accent':          '#1a73e8',
      '--color-accent-hover':    '#1765cc',
      '--color-accent-tint':     'rgba(26,115,232,0.08)',
      '--color-brand-text':      '#ffffff',

      // ── Google's four-color semantic ──
      '--color-blue':            '#1a73e8',
      '--color-green':           '#1e8e3e',      // Google Green 600 (darker, higher contrast)
      '--color-orange':          '#f9ab00',      // Google Yellow 700 (readable on white)
      '--color-purple':          '#a142f4',

      '--color-success':         '#1e8e3e',
      '--color-success-light':   'rgba(30,142,62,0.08)',
      '--color-warning':         '#f9ab00',
      '--color-warning-light':   'rgba(249,171,0,0.08)',
      '--color-danger':          '#d93025',      // Google Red 600 (proper danger)
      '--color-danger-light':    'rgba(217,48,37,0.06)',
      '--color-danger-tint':     'rgba(217,48,37,0.06)',
      '--color-info':            '#1a73e8',

      // ── Header — solid white, hairline border ──
      '--header-bg':             '#ffffff',
      '--header-border':         '#dadce0',

      // ── Overlay ──
      '--color-overlay-primary': 'rgba(32,33,36,0.6)',

      // ── Glass — opaque surfaces (Google = no blur) ──
      '--glass-bg':              '#ffffff',
      '--glass-bg-sidebar':      '#f8f9fa',
      '--glass-bg-content':      '#ffffff',
      '--glass-border':          '#dadce0',
      '--glass-shadow':          '0 1px 2px rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',

      // ── Shadows — Google's exact elevation tokens ──
      '--shadow-tiny':           '0 1px 2px rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',
      '--shadow-low':            '0 1px 2px rgba(60,64,67,0.3), 0 2px 6px 2px rgba(60,64,67,0.15)',
      '--shadow-medium':         '0 1px 3px rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)',
      '--shadow-high':           '0 2px 6px rgba(60,64,67,0.3), 0 8px 24px 6px rgba(60,64,67,0.15)',

      '--grid-line-color':       'rgba(0,0,0,0.04)',

      // ── Structural ──
      '--border-width':          '1px',
      '--border-width-heavy':    '1px',
      '--radius-base':           '8px',
      '--font-heading':          "'Google Sans', 'Inter', var(--font-regular)",
      '--font-base':             "'Google Sans Text', 'Inter', var(--font-regular)",
      '--shadow-interactive':    '0 1px 2px rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',
      '--shadow-interactive-hover': '0 1px 3px rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)',
      '--translate-hover-x':     '0px',
      '--translate-hover-y':     '0px',
    },
    dark: {
      // ── Backgrounds — Google Dark Theme ──
      '--color-bg-primary':      '#1f1f1f',
      '--color-bg-secondary':    '#292a2d',      // Surface container
      '--color-bg-tertiary':     '#303134',      // Surface container high
      '--color-bg-quaternary':   '#3c4043',      // Surface dim
      '--color-bg-panel':        '#292a2d',
      '--color-bg-translucent':  'rgba(255,255,255,0.04)',

      // ── Lines ──
      '--color-line-secondary':  '#3c4043',
      '--color-line-tertiary':   '#303134',

      // ── Borders ──
      '--color-border-primary':    '#3c4043',
      '--color-border-secondary':  '#5f6368',
      '--color-border-translucent':'rgba(255,255,255,0.06)',

      // ── Text — Google Dark palette (pastel tones) ──
      '--color-text-primary':    '#e8eaed',
      '--color-text-secondary':  '#bdc1c6',
      '--color-text-tertiary':   '#9aa0a6',
      '--color-text-quaternary': '#5f6368',
      '--color-text-on-color':   '#202124',

      // ── Accent — Google Blue 200 (pastel for dark) ──
      '--color-accent':          '#8ab4f8',
      '--color-accent-hover':    '#aecbfa',
      '--color-accent-tint':     'rgba(138,180,248,0.15)',
      '--color-brand-text':      '#202124',

      // ── Semantic — Google Dark pastels ──
      '--color-blue':            '#8ab4f8',
      '--color-green':           '#81c995',
      '--color-orange':          '#fdd663',
      '--color-purple':          '#c58af9',

      '--color-success':         '#81c995',
      '--color-success-light':   'rgba(129,201,149,0.15)',
      '--color-warning':         '#fdd663',
      '--color-warning-light':   'rgba(253,214,99,0.1)',
      '--color-danger':          '#f28b82',
      '--color-danger-light':    'rgba(242,139,130,0.15)',
      '--color-danger-tint':     'rgba(242,139,130,0.15)',
      '--color-info':            '#8ab4f8',

      // ── Header — solid dark, subtle border ──
      '--header-bg':             '#1f1f1f',
      '--header-border':         '#3c4043',

      // ── Overlay ──
      '--color-overlay-primary': 'rgba(0,0,0,0.7)',

      // ── Glass — opaque dark surfaces ──
      '--glass-bg':              '#292a2d',
      '--glass-bg-sidebar':      '#292a2d',
      '--glass-bg-content':      '#1f1f1f',
      '--glass-border':          '#3c4043',
      '--glass-shadow':          '0 1px 3px rgba(0,0,0,0.5)',

      // ── Shadows — deeper for dark surfaces ──
      '--shadow-tiny':           '0 1px 2px rgba(0,0,0,0.4)',
      '--shadow-low':            '0 1px 3px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.2)',
      '--shadow-medium':         '0 1px 3px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.25)',
      '--shadow-high':           '0 2px 6px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.3)',

      '--grid-line-color':       'rgba(255,255,255,0.03)',

      // ── Structural ──
      '--border-width':          '1px',
      '--border-width-heavy':    '1px',
      '--radius-base':           '8px',
      '--font-heading':          "'Google Sans', 'Inter', var(--font-regular)",
      '--font-base':             "'Google Sans Text', 'Inter', var(--font-regular)",
      '--shadow-interactive':    '0 1px 3px rgba(0,0,0,0.45)',
      '--shadow-interactive-hover': '0 2px 6px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.25)',
      '--translate-hover-x':     '0px',
      '--translate-hover-y':     '0px',
    },
  },
};
