import type { ThemeDefinition } from '../types';

/** Ocean — Professional blue, Linear-inspired clean look */
export const oceanTheme: ThemeDefinition = {
  id: 'ocean',
  nameKey: 'settings.theme.ocean',
  descKey: 'settings.theme.oceanDesc',
  preview: { accent: '#2383e2', bg: '#f8fafc', text: '#1e293b' },
  meta: { light: '#f8fafc', dark: '#0f172a' },
  tokens: {
    light: {
      '--color-bg-primary':      '#ffffff',
      '--color-bg-secondary':    '#f8fafc',
      '--color-bg-tertiary':     '#f1f5f9',
      '--color-bg-quaternary':   '#e2e8f0',
      '--color-bg-panel':        '#ffffff',
      '--color-bg-translucent':  'rgba(15,23,42,0.03)',

      '--color-line-secondary':  'rgba(15,23,42,0.08)',
      '--color-line-tertiary':   'rgba(15,23,42,0.05)',

      '--color-border-primary':             'rgba(15,23,42,0.08)',
      '--color-border-secondary':           'rgba(15,23,42,0.12)',
      '--color-border-translucent':         'rgba(15,23,42,0.08)',

      '--color-text-primary':    '#1e293b',
      '--color-text-secondary':  '#475569',
      '--color-text-tertiary':   '#64748b',
      '--color-text-quaternary': '#94a3b8',
      '--color-text-on-color':   '#ffffff',

      '--color-accent':          '#2383e2',
      '--color-accent-hover':    '#1d6fc0',
      '--color-accent-tint':     'rgba(35,131,226,0.08)',
      '--color-brand-text':      '#ffffff',

      '--color-blue':            '#2383e2',
      '--color-green':           '#0f7b6c',
      '--color-orange':          '#d97706',
      '--color-purple':          '#7c3aed',

      '--color-success':         '#0f7b6c',
      '--color-success-light':   'rgba(15,123,108,0.06)',
      '--color-warning':         '#d97706',
      '--color-warning-light':   'rgba(217,119,6,0.06)',
      '--color-danger':          '#dc2626',
      '--color-danger-light':    'rgba(220,38,38,0.06)',
      '--color-danger-tint':     'rgba(220,38,38,0.06)',
      '--color-info':            '#2383e2',

      '--header-bg':             'rgba(248,250,252,0.85)',
      '--header-border':         'rgba(15,23,42,0.06)',

      '--color-overlay-primary': 'rgba(15,23,42,0.6)',

      '--glass-bg':              'rgba(248,250,252,0.92)',
      '--glass-bg-sidebar':      'rgba(241,245,249,0.95)',
      '--glass-bg-content':      'rgba(255,255,255,0.97)',
      '--glass-border':          'rgba(15,23,42,0.06)',
      '--glass-shadow':          '0 1px 2px rgba(0,0,0,0.04)',

      '--shadow-tiny':           '0 0 0 transparent',
      '--shadow-low':            '0 1px 2px rgba(0,0,0,0.04)',
      '--shadow-medium':         '0 2px 6px rgba(0,0,0,0.06)',
      '--shadow-high':           '0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(15,23,42,0.06)',

      '--grid-line-color':       'rgba(15,23,42,0.04)',

      '--border-width':          '1px',
      '--border-width-heavy':    '1px',
      '--radius-base':           '6px',
      '--font-heading':          'var(--font-regular)',
      '--font-base':             'var(--font-regular)',
      '--shadow-interactive':    '0 1px 2px rgba(0,0,0,0.04)',
      '--shadow-interactive-hover': '0 2px 6px rgba(0,0,0,0.06)',
      '--translate-hover-x':     '0px',
      '--translate-hover-y':     '0px',
    },
    dark: {
      '--color-bg-primary':      '#0f172a',
      '--color-bg-secondary':    '#1e293b',
      '--color-bg-tertiary':     '#334155',
      '--color-bg-quaternary':   '#475569',
      '--color-bg-panel':        '#1e293b',
      '--color-bg-translucent':  'rgba(255,255,255,0.04)',

      '--color-line-secondary':  'rgba(255,255,255,0.07)',
      '--color-line-tertiary':   'rgba(255,255,255,0.04)',

      '--color-border-primary':             'rgba(255,255,255,0.07)',
      '--color-border-secondary':           'rgba(255,255,255,0.12)',
      '--color-border-translucent':         'rgba(255,255,255,0.07)',

      '--color-text-primary':    'rgba(255,255,255,0.87)',
      '--color-text-secondary':  'rgba(255,255,255,0.6)',
      '--color-text-tertiary':   '#94a3b8',
      '--color-text-quaternary': '#64748b',
      '--color-text-on-color':   '#ffffff',

      '--color-accent':          '#3b82f6',
      '--color-accent-hover':    '#60a5fa',
      '--color-accent-tint':     'rgba(59,130,246,0.12)',
      '--color-brand-text':      '#ffffff',

      '--color-blue':            '#60a5fa',
      '--color-green':           '#4dab9a',
      '--color-orange':          '#fbbf24',
      '--color-purple':          '#a78bfa',

      '--color-success':         '#4dab9a',
      '--color-success-light':   'rgba(77,171,154,0.12)',
      '--color-warning':         '#fbbf24',
      '--color-warning-light':   'rgba(251,191,36,0.08)',
      '--color-danger':          '#f87171',
      '--color-danger-light':    'rgba(248,113,113,0.12)',
      '--color-danger-tint':     'rgba(248,113,113,0.12)',
      '--color-info':            '#60a5fa',

      '--header-bg':             'rgba(15,23,42,0.85)',
      '--header-border':         'rgba(255,255,255,0.05)',

      '--color-overlay-primary': 'rgba(0,0,0,0.7)',

      '--glass-bg':              'rgba(15,23,42,0.92)',
      '--glass-bg-sidebar':      'rgba(30,41,59,0.95)',
      '--glass-bg-content':      'rgba(15,23,42,0.97)',
      '--glass-border':          'rgba(255,255,255,0.05)',
      '--glass-shadow':          '0 1px 3px rgba(0,0,0,0.3)',

      '--shadow-tiny':           '0 0 0 transparent',
      '--shadow-low':            '0 1px 2px rgba(0,0,0,0.25)',
      '--shadow-medium':         '0 2px 8px rgba(0,0,0,0.35)',
      '--shadow-high':           '0 4px 16px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',

      '--grid-line-color':       'rgba(255,255,255,0.03)',

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
