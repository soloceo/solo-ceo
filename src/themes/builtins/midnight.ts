import type { ThemeDefinition } from '../types';

/** Midnight — Deep purple/indigo, modern and creative */
export const midnightTheme: ThemeDefinition = {
  id: 'midnight',
  nameKey: 'settings.theme.midnight',
  descKey: 'settings.theme.midnightDesc',
  preview: { accent: '#8b5cf6', bg: '#faf5ff', text: '#2e1065' },
  meta: { light: '#faf5ff', dark: '#13111c' },
  tokens: {
    light: {
      '--color-bg-primary':      '#ffffff',
      '--color-bg-secondary':    '#faf5ff',
      '--color-bg-tertiary':     '#f3e8ff',
      '--color-bg-quaternary':   '#e9d5ff',
      '--color-bg-panel':        '#ffffff',
      '--color-bg-translucent':  'rgba(46,16,101,0.03)',

      '--color-line-secondary':  'rgba(46,16,101,0.09)',
      '--color-line-tertiary':   'rgba(46,16,101,0.06)',

      '--color-border-primary':             'rgba(46,16,101,0.09)',
      '--color-border-secondary':           'rgba(46,16,101,0.13)',
      '--color-border-translucent':         'rgba(46,16,101,0.09)',

      '--color-text-primary':    '#2e1065',
      '--color-text-secondary':  '#4c1d95',
      '--color-text-tertiary':   '#6d28d9',
      '--color-text-quaternary': '#a78bfa',
      '--color-text-on-color':   '#ffffff',

      '--color-accent':          '#8b5cf6',
      '--color-accent-hover':    '#7c3aed',
      '--color-accent-tint':     'rgba(139,92,246,0.08)',
      '--color-brand-text':      '#ffffff',

      '--color-blue':            '#3b82f6',
      '--color-green':           '#0f7b6c',
      '--color-orange':          '#d97706',
      '--color-purple':          '#8b5cf6',

      '--color-success':         '#0f7b6c',
      '--color-success-light':   'rgba(15,123,108,0.06)',
      '--color-warning':         '#d97706',
      '--color-warning-light':   'rgba(217,119,6,0.06)',
      '--color-danger':          '#dc2626',
      '--color-danger-light':    'rgba(220,38,38,0.06)',
      '--color-danger-tint':     'rgba(220,38,38,0.06)',
      '--color-info':            '#3b82f6',

      '--header-bg':             'rgba(250,245,255,0.85)',
      '--header-border':         'rgba(46,16,101,0.06)',

      '--color-overlay-primary': 'rgba(19,17,28,0.6)',

      '--glass-bg':              'rgba(250,245,255,0.92)',
      '--glass-bg-sidebar':      'rgba(243,232,255,0.95)',
      '--glass-bg-content':      'rgba(255,255,255,0.97)',
      '--glass-border':          'rgba(46,16,101,0.06)',
      '--glass-shadow':          '0 1px 2px rgba(0,0,0,0.04)',

      '--shadow-tiny':           '0 0 0 transparent',
      '--shadow-low':            '0 1px 2px rgba(0,0,0,0.04)',
      '--shadow-medium':         '0 2px 6px rgba(0,0,0,0.05)',
      '--shadow-high':           '0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(46,16,101,0.06)',

      '--grid-line-color':       'rgba(46,16,101,0.04)',

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
      '--color-bg-primary':      '#13111c',
      '--color-bg-secondary':    '#1c1929',
      '--color-bg-tertiary':     '#2a2540',
      '--color-bg-quaternary':   '#3b3558',
      '--color-bg-panel':        '#1c1929',
      '--color-bg-translucent':  'rgba(255,255,255,0.04)',

      '--color-line-secondary':  'rgba(255,255,255,0.07)',
      '--color-line-tertiary':   'rgba(255,255,255,0.04)',

      '--color-border-primary':             'rgba(255,255,255,0.07)',
      '--color-border-secondary':           'rgba(255,255,255,0.12)',
      '--color-border-translucent':         'rgba(255,255,255,0.07)',

      '--color-text-primary':    'rgba(255,255,255,0.87)',
      '--color-text-secondary':  'rgba(255,255,255,0.6)',
      '--color-text-tertiary':   '#a78bfa',
      '--color-text-quaternary': '#6d28d9',
      '--color-text-on-color':   '#ffffff',

      '--color-accent':          '#a78bfa',
      '--color-accent-hover':    '#c4b5fd',
      '--color-accent-tint':     'rgba(167,139,250,0.12)',
      '--color-brand-text':      '#13111c',

      '--color-blue':            '#60a5fa',
      '--color-green':           '#4dab9a',
      '--color-orange':          '#fbbf24',
      '--color-purple':          '#c4b5fd',

      '--color-success':         '#4dab9a',
      '--color-success-light':   'rgba(77,171,154,0.12)',
      '--color-warning':         '#fbbf24',
      '--color-warning-light':   'rgba(251,191,36,0.08)',
      '--color-danger':          '#f87171',
      '--color-danger-light':    'rgba(248,113,113,0.12)',
      '--color-danger-tint':     'rgba(248,113,113,0.12)',
      '--color-info':            '#60a5fa',

      '--header-bg':             'rgba(19,17,28,0.85)',
      '--header-border':         'rgba(255,255,255,0.05)',

      '--color-overlay-primary': 'rgba(0,0,0,0.7)',

      '--glass-bg':              'rgba(19,17,28,0.92)',
      '--glass-bg-sidebar':      'rgba(28,25,41,0.95)',
      '--glass-bg-content':      'rgba(19,17,28,0.97)',
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
