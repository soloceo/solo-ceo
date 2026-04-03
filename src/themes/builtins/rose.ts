import type { ThemeDefinition } from '../types';

/** Rose — Warm pink/coral, creative and inviting */
export const roseTheme: ThemeDefinition = {
  id: 'rose',
  nameKey: 'settings.theme.rose',
  descKey: 'settings.theme.roseDesc',
  preview: { accent: '#e11d48', bg: '#fff5f7', text: '#4a2030' },
  meta: { light: '#fff5f7', dark: '#1a1018' },
  tokens: {
    light: {
      '--color-bg-primary':      '#ffffff',
      '--color-bg-secondary':    '#fdf2f4',
      '--color-bg-tertiary':     '#fce7eb',
      '--color-bg-quaternary':   '#f9d4dc',
      '--color-bg-panel':        '#ffffff',
      '--color-bg-translucent':  'rgba(74,32,48,0.03)',

      '--color-line-secondary':  'rgba(74,32,48,0.09)',
      '--color-line-tertiary':   'rgba(74,32,48,0.06)',

      '--color-border-primary':             'rgba(74,32,48,0.09)',
      '--color-border-secondary':           'rgba(74,32,48,0.13)',
      '--color-border-translucent':         'rgba(74,32,48,0.09)',

      '--color-text-primary':    '#4a2030',
      '--color-text-secondary':  '#6b3a50',
      '--color-text-tertiary':   '#8c6070',
      '--color-text-quaternary': '#b08898',
      '--color-text-on-color':   '#ffffff',

      '--color-accent':          '#e11d48',
      '--color-accent-hover':    '#be123c',
      '--color-accent-tint':     'rgba(225,29,72,0.08)',
      '--color-brand-text':      '#ffffff',

      '--color-blue':            '#2563eb',
      '--color-green':           '#059669',
      '--color-orange':          '#ea580c',
      '--color-purple':          '#7c3aed',

      '--color-success':         '#059669',
      '--color-success-light':   'rgba(5,150,105,0.06)',
      '--color-warning':         '#d97706',
      '--color-warning-light':   'rgba(217,119,6,0.06)',
      '--color-danger':          '#dc2626',
      '--color-danger-light':    'rgba(220,38,38,0.06)',
      '--color-danger-tint':     'rgba(220,38,38,0.06)',
      '--color-info':            '#2563eb',

      '--header-bg':             'rgba(253,242,244,0.85)',
      '--header-border':         'rgba(74,32,48,0.06)',

      '--color-overlay-primary': 'rgba(26,16,24,0.6)',

      '--glass-bg':              'rgba(253,242,244,0.92)',
      '--glass-bg-sidebar':      'rgba(252,231,235,0.95)',
      '--glass-bg-content':      'rgba(255,255,255,0.97)',
      '--glass-border':          'rgba(74,32,48,0.06)',
      '--glass-shadow':          '0 1px 2px rgba(0,0,0,0.04)',

      '--shadow-tiny':           '0 0 0 transparent',
      '--shadow-low':            '0 1px 2px rgba(0,0,0,0.04)',
      '--shadow-medium':         '0 2px 6px rgba(0,0,0,0.05)',
      '--shadow-high':           '0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(74,32,48,0.06)',

      '--grid-line-color':       'rgba(74,32,48,0.04)',

      '--border-width':          '1px',
      '--border-width-heavy':    '1px',
      '--radius-base':           '6px',
      '--font-heading':          'var(--font-regular)',
      '--font-base':             'var(--font-regular)',
      '--shadow-interactive':    '0 1px 2px rgba(0,0,0,0.04)',
      '--shadow-interactive-hover': '0 2px 6px rgba(0,0,0,0.05)',
      '--translate-hover-x':     '0px',
      '--translate-hover-y':     '0px',
    },
    dark: {
      '--color-bg-primary':      '#1a1018',
      '--color-bg-secondary':    '#231620',
      '--color-bg-tertiary':     '#35202c',
      '--color-bg-quaternary':   '#4a2d3a',
      '--color-bg-panel':        '#231620',
      '--color-bg-translucent':  'rgba(255,255,255,0.04)',

      '--color-line-secondary':  'rgba(255,255,255,0.07)',
      '--color-line-tertiary':   'rgba(255,255,255,0.04)',

      '--color-border-primary':             'rgba(255,255,255,0.07)',
      '--color-border-secondary':           'rgba(255,255,255,0.12)',
      '--color-border-translucent':         'rgba(255,255,255,0.07)',

      '--color-text-primary':    'rgba(255,255,255,0.87)',
      '--color-text-secondary':  'rgba(255,255,255,0.6)',
      '--color-text-tertiary':   '#b08898',
      '--color-text-quaternary': '#6b3a50',
      '--color-text-on-color':   '#ffffff',

      '--color-accent':          '#fb7185',
      '--color-accent-hover':    '#fda4af',
      '--color-accent-tint':     'rgba(251,113,133,0.12)',
      '--color-brand-text':      '#1a1018',

      '--color-blue':            '#60a5fa',
      '--color-green':           '#34d399',
      '--color-orange':          '#fb923c',
      '--color-purple':          '#a78bfa',

      '--color-success':         '#34d399',
      '--color-success-light':   'rgba(52,211,153,0.12)',
      '--color-warning':         '#fbbf24',
      '--color-warning-light':   'rgba(251,191,36,0.08)',
      '--color-danger':          '#f87171',
      '--color-danger-light':    'rgba(248,113,113,0.12)',
      '--color-danger-tint':     'rgba(248,113,113,0.12)',
      '--color-info':            '#60a5fa',

      '--header-bg':             'rgba(26,16,24,0.85)',
      '--header-border':         'rgba(255,255,255,0.05)',

      '--color-overlay-primary': 'rgba(0,0,0,0.7)',

      '--glass-bg':              'rgba(26,16,24,0.92)',
      '--glass-bg-sidebar':      'rgba(35,22,32,0.95)',
      '--glass-bg-content':      'rgba(26,16,24,0.97)',
      '--glass-border':          'rgba(255,255,255,0.05)',
      '--glass-shadow':          '0 1px 3px rgba(0,0,0,0.25)',

      '--shadow-tiny':           '0 0 0 transparent',
      '--shadow-low':            '0 1px 2px rgba(0,0,0,0.25)',
      '--shadow-medium':         '0 2px 8px rgba(0,0,0,0.3)',
      '--shadow-high':           '0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',

      '--grid-line-color':       'rgba(255,255,255,0.03)',

      '--border-width':          '1px',
      '--border-width-heavy':    '1px',
      '--radius-base':           '6px',
      '--font-heading':          'var(--font-regular)',
      '--font-base':             'var(--font-regular)',
      '--shadow-interactive':    '0 1px 2px rgba(0,0,0,0.25)',
      '--shadow-interactive-hover': '0 2px 8px rgba(0,0,0,0.3)',
      '--translate-hover-x':     '0px',
      '--translate-hover-y':     '0px',
    },
  },
};
