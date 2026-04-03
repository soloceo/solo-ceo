import type { ThemeDefinition } from '../types';

/** Mono — Black, white & gray. Pure neutral palette */
export const monoTheme: ThemeDefinition = {
  id: 'mono',
  nameKey: 'settings.theme.mono',
  descKey: 'settings.theme.monoDesc',
  preview: { accent: '#333333', bg: '#fafafa', text: '#111111' },
  meta: { light: '#fafafa', dark: '#111111' },
  tokens: {
    light: {
      '--color-bg-primary':      '#ffffff',
      '--color-bg-secondary':    '#fafafa',
      '--color-bg-tertiary':     '#f0f0f0',
      '--color-bg-quaternary':   '#e0e0e0',
      '--color-bg-panel':        '#ffffff',
      '--color-bg-translucent':  'rgba(0,0,0,0.02)',

      '--color-line-secondary':  'rgba(0,0,0,0.08)',
      '--color-line-tertiary':   'rgba(0,0,0,0.05)',

      '--color-border-primary':             'rgba(0,0,0,0.10)',
      '--color-border-secondary':           'rgba(0,0,0,0.15)',
      '--color-border-translucent':         'rgba(0,0,0,0.08)',

      '--color-text-primary':    '#111111',
      '--color-text-secondary':  '#555555',
      '--color-text-tertiary':   '#888888',
      '--color-text-quaternary': '#aaaaaa',
      '--color-text-on-color':   '#ffffff',

      '--color-accent':          '#333333',
      '--color-accent-hover':    '#111111',
      '--color-accent-tint':     'rgba(0,0,0,0.06)',
      '--color-brand-text':      '#ffffff',

      '--color-blue':            '#555555',
      '--color-green':           '#27a644',
      '--color-orange':          '#d97706',
      '--color-purple':          '#666666',

      '--color-success':         '#27a644',
      '--color-success-light':   'rgba(39,166,68,0.06)',
      '--color-warning':         '#d97706',
      '--color-warning-light':   'rgba(217,119,6,0.06)',
      '--color-danger':          '#dc2626',
      '--color-danger-light':    'rgba(220,38,38,0.06)',
      '--color-danger-tint':     'rgba(220,38,38,0.06)',
      '--color-info':            '#555555',

      '--header-bg':             'rgba(250,250,250,0.85)',
      '--header-border':         'rgba(0,0,0,0.06)',

      '--color-overlay-primary': 'rgba(0,0,0,0.5)',

      '--glass-bg':              'rgba(250,250,250,0.92)',
      '--glass-bg-sidebar':      'rgba(240,240,240,0.95)',
      '--glass-bg-content':      'rgba(255,255,255,0.97)',
      '--glass-border':          'rgba(0,0,0,0.06)',
      '--glass-shadow':          '0 1px 2px rgba(0,0,0,0.04)',

      '--shadow-tiny':           '0 0 0 transparent',
      '--shadow-low':            '0 1px 2px rgba(0,0,0,0.05)',
      '--shadow-medium':         '0 2px 6px rgba(0,0,0,0.07)',
      '--shadow-high':           '0 4px 12px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)',

      '--grid-line-color':       'rgba(0,0,0,0.04)',

      '--border-width':          '1px',
      '--border-width-heavy':    '1px',
      '--radius-base':           '6px',
      '--font-heading':          'var(--font-regular)',
      '--font-base':             'var(--font-regular)',
      '--shadow-interactive':    '0 1px 2px rgba(0,0,0,0.05)',
      '--shadow-interactive-hover': '0 2px 6px rgba(0,0,0,0.07)',
      '--translate-hover-x':     '0px',
      '--translate-hover-y':     '0px',
    },
    dark: {
      '--color-bg-primary':      '#111111',
      '--color-bg-secondary':    '#1a1a1a',
      '--color-bg-tertiary':     '#2a2a2a',
      '--color-bg-quaternary':   '#3a3a3a',
      '--color-bg-panel':        '#1a1a1a',
      '--color-bg-translucent':  'rgba(255,255,255,0.04)',

      '--color-line-secondary':  'rgba(255,255,255,0.08)',
      '--color-line-tertiary':   'rgba(255,255,255,0.04)',

      '--color-border-primary':             'rgba(255,255,255,0.10)',
      '--color-border-secondary':           'rgba(255,255,255,0.15)',
      '--color-border-translucent':         'rgba(255,255,255,0.08)',

      '--color-text-primary':    'rgba(255,255,255,0.87)',
      '--color-text-secondary':  'rgba(255,255,255,0.60)',
      '--color-text-tertiary':   'rgba(255,255,255,0.40)',
      '--color-text-quaternary': 'rgba(255,255,255,0.25)',
      '--color-text-on-color':   '#ffffff',

      '--color-accent':          '#cccccc',
      '--color-accent-hover':    '#e0e0e0',
      '--color-accent-tint':     'rgba(255,255,255,0.08)',
      '--color-brand-text':      '#111111',

      '--color-blue':            '#aaaaaa',
      '--color-green':           '#4dab9a',
      '--color-orange':          '#fbbf24',
      '--color-purple':          '#999999',

      '--color-success':         '#4dab9a',
      '--color-success-light':   'rgba(77,171,154,0.12)',
      '--color-warning':         '#fbbf24',
      '--color-warning-light':   'rgba(251,191,36,0.08)',
      '--color-danger':          '#f87171',
      '--color-danger-light':    'rgba(248,113,113,0.12)',
      '--color-danger-tint':     'rgba(248,113,113,0.12)',
      '--color-info':            '#aaaaaa',

      '--header-bg':             'rgba(17,17,17,0.85)',
      '--header-border':         'rgba(255,255,255,0.06)',

      '--color-overlay-primary': 'rgba(0,0,0,0.7)',

      '--glass-bg':              'rgba(17,17,17,0.92)',
      '--glass-bg-sidebar':      'rgba(26,26,26,0.95)',
      '--glass-bg-content':      'rgba(17,17,17,0.97)',
      '--glass-border':          'rgba(255,255,255,0.06)',
      '--glass-shadow':          '0 1px 3px rgba(0,0,0,0.3)',

      '--shadow-tiny':           '0 0 0 transparent',
      '--shadow-low':            '0 1px 2px rgba(0,0,0,0.25)',
      '--shadow-medium':         '0 2px 8px rgba(0,0,0,0.35)',
      '--shadow-high':           '0 4px 16px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',

      '--grid-line-color':       'rgba(255,255,255,0.04)',

      '--border-width':          '1px',
      '--border-width-heavy':    '1px',
      '--radius-base':           '6px',
      '--font-heading':          'var(--font-regular)',
      '--font-base':             'var(--font-regular)',
      '--shadow-interactive':    '0 1px 2px rgba(0,0,0,0.25)',
      '--shadow-interactive-hover': '0 2px 8px rgba(0,0,0,0.35)',
      '--translate-hover-x':     '0px',
      '--translate-hover-y':     '0px',
    },
  },
};
