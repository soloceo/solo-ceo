import type { ThemeDefinition } from '../types';

/** Forest — Natural green, calm and grounded */
export const forestTheme: ThemeDefinition = {
  id: 'forest',
  nameKey: 'settings.theme.forest',
  descKey: 'settings.theme.forestDesc',
  preview: { accent: '#16a34a', bg: '#f0fdf4', text: '#14532d' },
  meta: { light: '#f0fdf4', dark: '#0a1f0d' },
  tokens: {
    light: {
      '--color-bg-primary':      '#ffffff',
      '--color-bg-secondary':    '#f0fdf4',
      '--color-bg-tertiary':     '#dcfce7',
      '--color-bg-quaternary':   '#bbf7d0',
      '--color-bg-panel':        '#ffffff',
      '--color-bg-translucent':  'rgba(20,83,45,0.03)',

      '--color-line-secondary':  'rgba(20,83,45,0.09)',
      '--color-line-tertiary':   'rgba(20,83,45,0.06)',

      '--color-border-primary':             'rgba(20,83,45,0.09)',
      '--color-border-secondary':           'rgba(20,83,45,0.13)',
      '--color-border-translucent':         'rgba(20,83,45,0.09)',

      '--color-text-primary':    '#14532d',
      '--color-text-secondary':  '#166534',
      '--color-text-tertiary':   '#4d7c5e',
      '--color-text-quaternary': '#86a894',
      '--color-text-on-color':   '#ffffff',

      '--color-accent':          '#16a34a',
      '--color-accent-hover':    '#15803d',
      '--color-accent-tint':     'rgba(22,163,74,0.08)',
      '--color-brand-text':      '#ffffff',

      '--color-blue':            '#2563eb',
      '--color-green':           '#16a34a',
      '--color-orange':          '#d97706',
      '--color-purple':          '#7c3aed',

      '--color-success':         '#16a34a',
      '--color-success-light':   'rgba(22,163,74,0.06)',
      '--color-warning':         '#d97706',
      '--color-warning-light':   'rgba(217,119,6,0.06)',
      '--color-danger':          '#dc2626',
      '--color-danger-light':    'rgba(220,38,38,0.06)',
      '--color-danger-tint':     'rgba(220,38,38,0.06)',
      '--color-info':            '#2563eb',

      '--header-bg':             'rgba(240,253,244,0.85)',
      '--header-border':         'rgba(20,83,45,0.06)',

      '--color-overlay-primary': 'rgba(10,31,13,0.6)',

      '--glass-bg':              'rgba(240,253,244,0.92)',
      '--glass-bg-sidebar':      'rgba(220,252,231,0.95)',
      '--glass-bg-content':      'rgba(255,255,255,0.97)',
      '--glass-border':          'rgba(20,83,45,0.06)',
      '--glass-shadow':          '0 1px 2px rgba(0,0,0,0.04)',

      '--shadow-tiny':           '0 0 0 transparent',
      '--shadow-low':            '0 1px 2px rgba(0,0,0,0.04)',
      '--shadow-medium':         '0 2px 6px rgba(0,0,0,0.05)',
      '--shadow-high':           '0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(20,83,45,0.06)',

      '--grid-line-color':       'rgba(20,83,45,0.04)',

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
      '--color-bg-primary':      '#0a1f0d',
      '--color-bg-secondary':    '#132a17',
      '--color-bg-tertiary':     '#1e3a22',
      '--color-bg-quaternary':   '#2d4d32',
      '--color-bg-panel':        '#132a17',
      '--color-bg-translucent':  'rgba(255,255,255,0.04)',

      '--color-line-secondary':  'rgba(255,255,255,0.07)',
      '--color-line-tertiary':   'rgba(255,255,255,0.04)',

      '--color-border-primary':             'rgba(255,255,255,0.07)',
      '--color-border-secondary':           'rgba(255,255,255,0.12)',
      '--color-border-translucent':         'rgba(255,255,255,0.07)',

      '--color-text-primary':    'rgba(255,255,255,0.87)',
      '--color-text-secondary':  'rgba(255,255,255,0.6)',
      '--color-text-tertiary':   '#86a894',
      '--color-text-quaternary': '#4d7c5e',
      '--color-text-on-color':   '#ffffff',

      '--color-accent':          '#4ade80',
      '--color-accent-hover':    '#86efac',
      '--color-accent-tint':     'rgba(74,222,128,0.12)',
      '--color-brand-text':      '#0a1f0d',

      '--color-blue':            '#60a5fa',
      '--color-green':           '#4ade80',
      '--color-orange':          '#fbbf24',
      '--color-purple':          '#a78bfa',

      '--color-success':         '#4ade80',
      '--color-success-light':   'rgba(74,222,128,0.12)',
      '--color-warning':         '#fbbf24',
      '--color-warning-light':   'rgba(251,191,36,0.08)',
      '--color-danger':          '#f87171',
      '--color-danger-light':    'rgba(248,113,113,0.12)',
      '--color-danger-tint':     'rgba(248,113,113,0.12)',
      '--color-info':            '#60a5fa',

      '--header-bg':             'rgba(10,31,13,0.85)',
      '--header-border':         'rgba(255,255,255,0.05)',

      '--color-overlay-primary': 'rgba(0,0,0,0.7)',

      '--glass-bg':              'rgba(10,31,13,0.92)',
      '--glass-bg-sidebar':      'rgba(19,42,23,0.95)',
      '--glass-bg-content':      'rgba(10,31,13,0.97)',
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
