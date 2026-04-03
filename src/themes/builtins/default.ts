import type { ThemeDefinition } from '../types';

/** Default — Notion-inspired warm white + yellow accent (the V2 look) */
export const defaultTheme: ThemeDefinition = {
  id: 'default',
  nameKey: 'settings.theme.default',
  descKey: 'settings.theme.defaultDesc',
  preview: { accent: '#f5c518', bg: '#ffffff', text: '#37352f' },
  meta: { light: '#ffffff', dark: '#191919' },
  tokens: {
    light: {
      '--color-bg-primary':      '#ffffff',
      '--color-bg-secondary':    '#f7f6f3',
      '--color-bg-tertiary':     '#f1f0ed',
      '--color-bg-quaternary':   '#e9e8e4',
      '--color-bg-panel':        '#ffffff',
      '--color-bg-translucent':  'rgba(55,53,47,0.03)',

      '--color-line-secondary':  'rgba(55,53,47,0.09)',
      '--color-line-tertiary':   'rgba(55,53,47,0.06)',

      '--color-border-primary':             'rgba(55,53,47,0.09)',
      '--color-border-secondary':           'rgba(55,53,47,0.13)',
      '--color-border-translucent':         'rgba(55,53,47,0.09)',

      '--color-text-primary':    '#37352f',
      '--color-text-secondary':  '#5a5955',
      '--color-text-tertiary':   '#787774',
      '--color-text-quaternary': '#9b9a97',
      '--color-text-on-color':   '#ffffff',

      '--color-accent':          '#f5c518',
      '--color-accent-hover':    '#e0ad00',
      '--color-accent-tint':     'rgba(245,197,24,0.08)',
      '--color-brand-text':      '#1a1400',

      '--color-blue':            '#2383e2',
      '--color-green':           '#0f7b6c',
      '--color-orange':          '#d9730d',
      '--color-purple':          '#6940a5',

      '--color-success':         '#0f7b6c',
      '--color-success-light':   'rgba(15,123,108,0.06)',
      '--color-warning':         '#f5c518',
      '--color-warning-light':   'rgba(245,197,24,0.06)',
      '--color-danger':          '#e03e3e',
      '--color-danger-light':    'rgba(224,62,62,0.06)',
      '--color-danger-tint':     'rgba(224,62,62,0.06)',
      '--color-info':            '#2383e2',

      '--header-bg':             'rgba(255,255,255,0.85)',
      '--header-border':         'rgba(55,53,47,0.06)',

      '--color-overlay-primary': 'rgba(15,15,15,0.6)',

      '--glass-bg':              'rgba(255,255,255,0.92)',
      '--glass-bg-sidebar':      'rgba(247,246,243,0.95)',
      '--glass-bg-content':      'rgba(255,255,255,0.97)',
      '--glass-border':          'rgba(55,53,47,0.06)',
      '--glass-shadow':          '0 1px 2px rgba(0,0,0,0.04)',

      '--shadow-tiny':           '0 0 0 transparent',
      '--shadow-low':            '0 1px 2px rgba(0,0,0,0.04)',
      '--shadow-medium':         '0 2px 6px rgba(0,0,0,0.05)',
      '--shadow-high':           '0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(55,53,47,0.06)',

      '--grid-line-color':       'rgba(55,53,47,0.04)',

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
      '--color-bg-primary':      '#191919',
      '--color-bg-secondary':    '#202020',
      '--color-bg-tertiary':     '#2f2f2f',
      '--color-bg-quaternary':   '#373737',
      '--color-bg-panel':        '#202020',
      '--color-bg-translucent':  'rgba(255,255,255,0.04)',

      '--color-line-secondary':  'rgba(255,255,255,0.06)',
      '--color-line-tertiary':   'rgba(255,255,255,0.04)',

      '--color-border-primary':             'rgba(255,255,255,0.07)',
      '--color-border-secondary':           'rgba(255,255,255,0.11)',
      '--color-border-translucent':         'rgba(255,255,255,0.07)',

      '--color-text-primary':    '#ffffffcf',
      '--color-text-secondary':  '#ffffff9e',
      '--color-text-tertiary':   '#999999',
      '--color-text-quaternary': '#666666',
      '--color-text-on-color':   '#ffffff',

      '--color-accent':          '#f5c518',
      '--color-accent-hover':    '#ffd43b',
      '--color-accent-tint':     'rgba(245,197,24,0.12)',
      '--color-brand-text':      '#1a1400',

      '--color-blue':            '#5b9ee9',
      '--color-green':           '#4dab9a',
      '--color-orange':          '#e8863a',
      '--color-purple':          '#9a6dd7',

      '--color-success':         '#4dab9a',
      '--color-success-light':   'rgba(15,123,108,0.12)',
      '--color-warning':         '#f5c518',
      '--color-warning-light':   'rgba(245,197,24,0.08)',
      '--color-danger':          '#e06c6c',
      '--color-danger-light':    'rgba(224,62,62,0.12)',
      '--color-danger-tint':     'rgba(224,62,62,0.12)',
      '--color-info':            '#5b9ee9',

      '--header-bg':             'rgba(25,25,25,0.85)',
      '--header-border':         'rgba(255,255,255,0.05)',

      '--color-overlay-primary': 'rgba(0,0,0,0.7)',

      '--glass-bg':              'rgba(25,25,25,0.92)',
      '--glass-bg-sidebar':      'rgba(25,25,25,0.95)',
      '--glass-bg-content':      'rgba(25,25,25,0.97)',
      '--glass-border':          'rgba(255,255,255,0.05)',
      '--glass-shadow':          '0 1px 3px rgba(0,0,0,0.2)',

      '--shadow-tiny':           '0 0 0 transparent',
      '--shadow-low':            '0 1px 2px rgba(0,0,0,0.2)',
      '--shadow-medium':         '0 2px 8px rgba(0,0,0,0.3)',
      '--shadow-high':           '0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',

      '--grid-line-color':       'rgba(255,255,255,0.03)',

      '--border-width':          '1px',
      '--border-width-heavy':    '1px',
      '--radius-base':           '6px',
      '--font-heading':          'var(--font-regular)',
      '--font-base':             'var(--font-regular)',
      '--shadow-interactive':    '0 1px 2px rgba(0,0,0,0.2)',
      '--shadow-interactive-hover': '0 2px 8px rgba(0,0,0,0.3)',
      '--translate-hover-x':     '0px',
      '--translate-hover-y':     '0px',
    },
  },
};
