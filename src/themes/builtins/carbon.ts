import type { ThemeDefinition } from '../types';

/**
 * Carbon — IBM Carbon Design System inspired.
 * Single accent: IBM Blue 60 (#0f62fe).
 * Monochrome scale from Gray 100 (#161616) to white (#ffffff).
 * Semantic depth via background-color layering (white → gray 10 → gray 20).
 */
export const carbonTheme: ThemeDefinition = {
  id: 'carbon',
  nameKey: 'settings.theme.carbon',
  descKey: 'settings.theme.carbonDesc',
  preview: { accent: '#0f62fe', bg: '#ffffff', text: '#161616' },
  meta: { light: '#ffffff', dark: '#161616' },
  tokens: {
    light: {
      '--color-bg-primary':      '#ffffff',
      '--color-bg-secondary':    '#f4f4f4',
      '--color-bg-tertiary':     '#e8e8e8',
      '--color-bg-quaternary':   '#e0e0e0',
      '--color-bg-panel':        '#ffffff',
      '--color-bg-translucent':  'rgba(22,22,22,0.03)',

      '--color-line-secondary':  '#e0e0e0',
      '--color-line-tertiary':   '#e8e8e8',

      '--color-border-primary':             '#c6c6c6',
      '--color-border-secondary':           '#e0e0e0',
      '--color-border-translucent':         'rgba(22,22,22,0.08)',

      '--color-text-primary':    '#161616',
      '--color-text-secondary':  '#525252',
      '--color-text-tertiary':   '#6f6f6f',
      '--color-text-quaternary': '#8d8d8d',
      '--color-text-on-color':   '#ffffff',

      '--color-accent':          '#0f62fe',
      '--color-accent-hover':    '#0353e9',
      '--color-accent-tint':     'rgba(15,98,254,0.08)',
      '--color-brand-text':      '#ffffff',

      '--color-blue':            '#0f62fe',
      '--color-green':           '#24a148',
      '--color-orange':          '#ff832b',
      '--color-purple':          '#8a3ffc',

      '--color-success':         '#24a148',
      '--color-success-light':   'rgba(36,161,72,0.08)',
      '--color-warning':         '#f1c21b',
      '--color-warning-light':   'rgba(241,194,27,0.08)',
      '--color-danger':          '#da1e28',
      '--color-danger-light':    'rgba(218,30,40,0.08)',
      '--color-danger-tint':     'rgba(218,30,40,0.08)',
      '--color-info':            '#0f62fe',

      '--header-bg':             '#161616',
      '--header-border':         '#262626',

      '--color-overlay-primary': 'rgba(22,22,22,0.6)',

      '--glass-bg':              'rgba(255,255,255,0.95)',
      '--glass-bg-sidebar':      'rgba(244,244,244,0.95)',
      '--glass-bg-content':      'rgba(255,255,255,0.97)',
      '--glass-border':          '#e0e0e0',
      '--glass-shadow':          '0 1px 2px rgba(0,0,0,0.05)',

      '--shadow-tiny':           '0 0 0 transparent',
      '--shadow-low':            '0 1px 2px rgba(0,0,0,0.05)',
      '--shadow-medium':         '0 2px 6px rgba(0,0,0,0.1)',
      '--shadow-high':           '0 4px 12px rgba(0,0,0,0.15)',

      '--grid-line-color':       'rgba(22,22,22,0.04)',

      '--border-width':          '1px',
      '--border-width-heavy':    '1px',
      '--radius-base':           '0px',
      '--font-heading':          'var(--font-regular)',
      '--font-base':             'var(--font-regular)',
      '--shadow-interactive':    '0 0 0 transparent',
      '--shadow-interactive-hover': '0 0 0 transparent',
      '--translate-hover-x':     '0px',
      '--translate-hover-y':     '0px',
    },
    dark: {
      '--color-bg-primary':      '#161616',
      '--color-bg-secondary':    '#262626',
      '--color-bg-tertiary':     '#393939',
      '--color-bg-quaternary':   '#525252',
      '--color-bg-panel':        '#262626',
      '--color-bg-translucent':  'rgba(255,255,255,0.04)',

      '--color-line-secondary':  '#393939',
      '--color-line-tertiary':   '#262626',

      '--color-border-primary':             '#525252',
      '--color-border-secondary':           '#393939',
      '--color-border-translucent':         'rgba(255,255,255,0.08)',

      '--color-text-primary':    '#f4f4f4',
      '--color-text-secondary':  '#c6c6c6',
      '--color-text-tertiary':   '#8d8d8d',
      '--color-text-quaternary': '#6f6f6f',
      '--color-text-on-color':   '#ffffff',

      '--color-accent':          '#78a9ff',
      '--color-accent-hover':    '#a6c8ff',
      '--color-accent-tint':     'rgba(120,169,255,0.12)',
      '--color-brand-text':      '#161616',

      '--color-blue':            '#78a9ff',
      '--color-green':           '#42be65',
      '--color-orange':          '#ff832b',
      '--color-purple':          '#be95ff',

      '--color-success':         '#42be65',
      '--color-success-light':   'rgba(66,190,101,0.12)',
      '--color-warning':         '#f1c21b',
      '--color-warning-light':   'rgba(241,194,27,0.12)',
      '--color-danger':          '#fa4d56',
      '--color-danger-light':    'rgba(250,77,86,0.12)',
      '--color-danger-tint':     'rgba(250,77,86,0.12)',
      '--color-info':            '#78a9ff',

      '--header-bg':             '#000000',
      '--header-border':         '#393939',

      '--color-overlay-primary': 'rgba(0,0,0,0.75)',

      '--glass-bg':              'rgba(22,22,22,0.95)',
      '--glass-bg-sidebar':      'rgba(38,38,38,0.95)',
      '--glass-bg-content':      'rgba(22,22,22,0.97)',
      '--glass-border':          '#393939',
      '--glass-shadow':          '0 1px 3px rgba(0,0,0,0.3)',

      '--shadow-tiny':           '0 0 0 transparent',
      '--shadow-low':            '0 1px 2px rgba(0,0,0,0.3)',
      '--shadow-medium':         '0 2px 6px rgba(0,0,0,0.4)',
      '--shadow-high':           '0 4px 12px rgba(0,0,0,0.5)',

      '--grid-line-color':       'rgba(255,255,255,0.04)',

      '--border-width':          '1px',
      '--border-width-heavy':    '1px',
      '--radius-base':           '0px',
      '--font-heading':          'var(--font-regular)',
      '--font-base':             'var(--font-regular)',
      '--shadow-interactive':    '0 0 0 transparent',
      '--shadow-interactive-hover': '0 0 0 transparent',
      '--translate-hover-x':     '0px',
      '--translate-hover-y':     '0px',
    },
  },
};
