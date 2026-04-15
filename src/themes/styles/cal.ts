import type { StyleDefinition } from '../types';
import './cal.css';

/**
 * Cal — Inspired by Cal.com's design system.
 *
 * Structural DNA:
 * - Multi-layered shadow system (ring borders + diffused + contact shadows)
 * - Cool gray neutral tones (#242424 text, #898989 secondary)
 * - Shadow-based borders instead of CSS borders
 * - Opacity-based hover/press interaction (no translate)
 * - Cal Sans headings (semibold 600), Inter body
 * - 8px base radius, 6px icon buttons
 * - Blue focus rings (#3b82f6) for accessibility
 * - Pure white surfaces — depth comes entirely from shadows
 */
const calStyle: StyleDefinition = {
  id: 'cal',
  nameKey: 'settings.style.cal',
  descKey: 'settings.style.calDesc',
  order: 2,
  preview: {
    accent: '#292929',
    card: {
      border: 'none',
      borderRadius: '8px',
      boxShadow:
        '0 1px 5px -3px rgba(19,19,22,0.7), 0 0 0 1px rgba(34,42,53,0.14), 0 4px 10px rgba(34,42,53,0.08)',
    },
    elements: {
      accentShape: 'chip-row',
      accentRadius: '9999px',
      textLineRadius: 4,
    },
  },
  overrides: {
    light: {
      // ── Structural ──
      '--border-width':          '0px',
      '--border-width-heavy':    '0px',
      '--radius-base':           '8px',
      '--font-heading':          "'Cal Sans', 'Inter', var(--font-regular)",
      '--font-base':             "'Inter', var(--font-regular)",
      '--shadow-interactive':    '0 1px 3px -1px rgba(19,19,22,0.5), 0 0 0 1px rgba(34,42,53,0.14), 0 2px 6px rgba(34,42,53,0.08)',
      '--shadow-interactive-hover': '0 2px 6px -1px rgba(19,19,22,0.5), 0 0 0 1px rgba(34,42,53,0.18), 0 6px 16px rgba(34,42,53,0.1)',
      '--translate-hover-x':     '0px',
      '--translate-hover-y':     '0px',

      // ── Typography structural ──
      '--font-weight-heading':   '600',
      '--letter-spacing-heading': '-0.025em',
      '--text-transform-heading': 'none',
      '--font-weight-kpi':       '700',
      '--letter-spacing-kpi':    '-0.03em',
      '--text-transform-label':  'none',
      '--letter-spacing-label':  '0em',
      '--text-transform-button': 'none',
      '--letter-spacing-button': '-0.01em',
      '--text-transform-badge':  'none',
      '--letter-spacing-badge':  '0em',
      '--text-transform-tab':    'none',
      '--letter-spacing-tab':    '-0.01em',

      // ── Component dimensions ──
      '--badge-padding-x':       '8px',
      '--badge-padding-y':       '2px',
      '--badge-font-size':       '0.75rem',
      '--badge-border-width':    '0px',

      // ── Component visual — prominent ring + layered shadows ──
      '--card-shadow':           '0 1px 3px -1px rgba(19,19,22,0.5), 0 0 0 1px rgba(34,42,53,0.12), 0 3px 8px rgba(34,42,53,0.06)',
      '--card-elevated-shadow':  '0 2px 6px -2px rgba(19,19,22,0.6), 0 0 0 1px rgba(34,42,53,0.14), 0 8px 20px rgba(34,42,53,0.1)',
      '--icon-btn-radius':       '6px',
      '--progress-height':       '4px',
      '--progress-radius':       '9999px',
      '--progress-border':       'none',

      // ── Interaction ──
      '--opacity-disabled':      '0.5',
      '--opacity-active-press':  '0.85',
      '--focus-outline-width':   '2px',
      '--focus-outline-color':   'rgba(59,130,246,0.5)',

      // ── Glass ──
      '--backdrop-blur':         'blur(20px) saturate(180%)',

      // ── Button interaction — opacity + shadow deepen ──
      '--button-font-weight':    'var(--font-weight-semibold)',
      '--btn-hover-shadow':      '0 2px 6px -2px rgba(19,19,22,0.6), 0 0 0 1px rgba(34,42,53,0.16), 0 6px 16px rgba(34,42,53,0.08)',
      '--btn-hover-translate-x': '0px',
      '--btn-hover-translate-y': '0px',
      '--btn-active-opacity':    '0.85',
      '--btn-active-translate-x': '0px',
      '--btn-active-translate-y': '0px',
      '--btn-active-shadow':     '0 0 2px rgba(19,19,22,0.4), 0 0 0 1px rgba(34,42,53,0.14)',

      // ── Icon button interaction ──
      '--icon-btn-border':       '0px solid transparent',
      '--icon-btn-hover-border': 'transparent',
      '--icon-btn-hover-shadow': '0 0 0 1px rgba(34,42,53,0.14), 0 2px 4px rgba(34,42,53,0.08)',

      // ── Input interaction — prominent ring shadows ──
      '--input-shadow':          '0 0 0 1px rgba(34,42,53,0.16), 0 1px 2px rgba(34,42,53,0.06)',
      '--input-focus-border':    'rgba(59,130,246,0.5)',
      '--input-focus-shadow':    '0 0 0 1px rgba(59,130,246,0.5), 0 0 0 4px rgba(59,130,246,0.15)',
      '--select-shadow':         '0 0 0 1px rgba(34,42,53,0.16), 0 1px 2px rgba(34,42,53,0.06)',

      // ── Ghost hover ──
      '--ghost-hover-border':    'transparent',

      // ── Component structural ──
      '--badge-font-weight':     'var(--font-weight-medium)',
      '--label-font-weight':     'var(--font-weight-medium)',
      '--kpi-label-font-size':   '12px',
      '--tab-font-size':         '14px',
      '--tab-active-font-weight': 'var(--font-weight-semibold)',
      '--tab-active-bg':         'var(--color-bg-primary)',
      '--tab-active-border':     '#242424',

      // ── Skeleton ──
      '--skeleton-border':       'none',

      // ── Modal / overlay / sheet ──
      '--modal-border':          'none',
      '--modal-shadow':          '0 2px 8px -2px rgba(19,19,22,0.7), 0 0 0 1px rgba(34,42,53,0.14), 0 24px 48px rgba(34,42,53,0.2)',
      '--overlay-bg':            'rgba(17,17,17,0.5)',
      '--sheet-radius-mobile':   '12px 12px 0 0',
      '--sheet-border-mobile':   'none',
      '--sheet-shadow-mobile':   '0 -2px 12px rgba(34,42,53,0.12), 0 0 0 1px rgba(34,42,53,0.1)',

      // ── Table ──
      '--table-header-bg':       '#fafafa',
      '--table-header-border':   '1px solid rgba(34,42,53,0.1)',
      '--table-row-border':      '1px solid rgba(34,42,53,0.08)',

      // ── Layout ──
      '--sidebar-panel-shadow':  '0 0 0 1px rgba(34,42,53,0.08), 2px 0 8px rgba(34,42,53,0.04)',
      '--divider-width':         '1px',

      // ── Floating ──
      '--shadow-float':          '0 2px 6px -2px rgba(19,19,22,0.6), 0 0 0 1px rgba(34,42,53,0.12), 0 12px 28px rgba(34,42,53,0.12)',
      '--btn-group-shadow':      '0 0 0 1px rgba(34,42,53,0.14), 0 1px 4px rgba(34,42,53,0.06)',

      // ── Cal neutral tones — cool gray, not warm ──
      '--color-bg-primary':      '#ffffff',
      '--color-bg-secondary':    '#fafafa',
      '--color-bg-tertiary':     '#f5f5f5',
      '--color-bg-quaternary':   '#ebebeb',
      '--color-bg-panel':        '#ffffff',
      '--color-bg-translucent':  'rgba(0,0,0,0.02)',
      '--color-text-primary':    '#242424',
      '--color-text-secondary':  '#6b6b6b',
      '--color-text-tertiary':   '#898989',
      '--color-text-quaternary': '#ababab',
      '--color-text-on-color':   '#ffffff',

      // ── Accent — dark neutral (Cal.com professional) ──
      '--color-accent':          '#292929',
      '--color-accent-hover':    '#404040',
      '--color-accent-tint':     'rgba(41,41,41,0.06)',
      '--color-brand-text':      '#ffffff',

      // ── Semantic — cool, professional tones ──
      '--color-blue':            '#2563eb',
      '--color-green':           '#16a34a',
      '--color-orange':          '#ea580c',
      '--color-purple':          '#7c3aed',
      '--color-success':         '#16a34a',
      '--color-success-light':   'rgba(22,163,74,0.06)',
      '--color-warning':         '#ea580c',
      '--color-warning-light':   'rgba(234,88,12,0.06)',
      '--color-danger':          '#dc2626',
      '--color-danger-light':    'rgba(220,38,38,0.06)',
      '--color-danger-tint':     'rgba(220,38,38,0.06)',
      '--color-info':            '#2563eb',

      // ── Borders — ring-shadow style ──
      '--color-border-primary':             'rgba(34,42,53,0.14)',
      '--color-border-secondary':           'rgba(34,42,53,0.12)',
      '--color-border-translucent':         'rgba(34,42,53,0.08)',

      // ── Lines ──
      '--color-line-secondary':  'rgba(34,42,53,0.1)',
      '--color-line-tertiary':   'rgba(34,42,53,0.06)',

      // ── Header ──
      '--header-bg':             'rgba(255,255,255,0.95)',
      '--header-border':         'rgba(34,42,53,0.08)',

      // ── Glass ──
      '--glass-bg':              'rgba(255,255,255,0.88)',
      '--glass-bg-sidebar':      'rgba(250,250,250,0.95)',
      '--glass-bg-content':      'rgba(255,255,255,0.97)',
      '--glass-border':          'rgba(34,42,53,0.08)',
      '--glass-shadow':          '0 0 0 1px rgba(34,42,53,0.06), 0 1px 4px rgba(34,42,53,0.06)',

      // ── Shadows — Cal.com multi-layered (AMPLIFIED) ──
      '--shadow-tiny':           '0 0 0 1px rgba(34,42,53,0.1)',
      '--shadow-low':            '0 1px 3px -1px rgba(19,19,22,0.5), 0 0 0 1px rgba(34,42,53,0.1), 0 2px 6px rgba(34,42,53,0.06)',
      '--shadow-medium':         '0 2px 6px -2px rgba(19,19,22,0.5), 0 0 0 1px rgba(34,42,53,0.12), 0 6px 16px rgba(34,42,53,0.08)',
      '--shadow-high':           '0 2px 8px -2px rgba(19,19,22,0.6), 0 0 0 1px rgba(34,42,53,0.14), 0 24px 48px rgba(34,42,53,0.15)',

      // ── Grid ──
      '--grid-line-color':       'rgba(34,42,53,0.04)',
    },
    dark: {
      // ── Structural ──
      '--border-width':          '0px',
      '--border-width-heavy':    '0px',
      '--radius-base':           '8px',
      '--font-heading':          "'Cal Sans', 'Inter', var(--font-regular)",
      '--font-base':             "'Inter', var(--font-regular)",
      '--shadow-interactive':    '0 1px 3px -1px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08), 0 2px 6px rgba(0,0,0,0.3)',
      '--shadow-interactive-hover': '0 2px 6px -1px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.12), 0 6px 16px rgba(0,0,0,0.4)',
      '--translate-hover-x':     '0px',
      '--translate-hover-y':     '0px',

      // ── Typography structural ──
      '--font-weight-heading':   '600',
      '--letter-spacing-heading': '-0.025em',
      '--text-transform-heading': 'none',
      '--font-weight-kpi':       '700',
      '--letter-spacing-kpi':    '-0.03em',
      '--text-transform-label':  'none',
      '--letter-spacing-label':  '0em',
      '--text-transform-button': 'none',
      '--letter-spacing-button': '-0.01em',
      '--text-transform-badge':  'none',
      '--letter-spacing-badge':  '0em',
      '--text-transform-tab':    'none',
      '--letter-spacing-tab':    '-0.01em',

      // ── Component dimensions ──
      '--badge-padding-x':       '8px',
      '--badge-padding-y':       '2px',
      '--badge-font-size':       '0.75rem',
      '--badge-border-width':    '0px',

      // ── Component visual ──
      '--card-shadow':           '0 1px 3px -1px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06), 0 3px 8px rgba(0,0,0,0.3)',
      '--card-elevated-shadow':  '0 2px 6px -2px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.08), 0 8px 20px rgba(0,0,0,0.4)',
      '--icon-btn-radius':       '6px',
      '--progress-height':       '4px',
      '--progress-radius':       '9999px',
      '--progress-border':       'none',

      // ── Interaction ──
      '--opacity-disabled':      '0.5',
      '--opacity-active-press':  '0.85',
      '--focus-outline-width':   '2px',
      '--focus-outline-color':   'rgba(59,130,246,0.5)',

      // ── Glass ──
      '--backdrop-blur':         'blur(20px) saturate(180%)',

      // ── Button interaction ──
      '--button-font-weight':    'var(--font-weight-semibold)',
      '--btn-hover-shadow':      '0 2px 6px -2px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.12), 0 6px 16px rgba(0,0,0,0.4)',
      '--btn-hover-translate-x': '0px',
      '--btn-hover-translate-y': '0px',
      '--btn-active-opacity':    '0.85',
      '--btn-active-translate-x': '0px',
      '--btn-active-translate-y': '0px',
      '--btn-active-shadow':     '0 0 2px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',

      // ── Icon button interaction ──
      '--icon-btn-border':       '0px solid transparent',
      '--icon-btn-hover-border': 'transparent',
      '--icon-btn-hover-shadow': '0 0 0 1px rgba(255,255,255,0.12), 0 2px 4px rgba(0,0,0,0.3)',

      // ── Input interaction ──
      '--input-shadow':          '0 0 0 1px rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.3)',
      '--input-focus-border':    'rgba(59,130,246,0.5)',
      '--input-focus-shadow':    '0 0 0 1px rgba(59,130,246,0.5), 0 0 0 4px rgba(59,130,246,0.2)',
      '--select-shadow':         '0 0 0 1px rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.3)',

      // ── Ghost hover ──
      '--ghost-hover-border':    'transparent',

      // ── Component structural ──
      '--badge-font-weight':     'var(--font-weight-medium)',
      '--label-font-weight':     'var(--font-weight-medium)',
      '--kpi-label-font-size':   '12px',
      '--tab-font-size':         '14px',
      '--tab-active-font-weight': 'var(--font-weight-semibold)',
      '--tab-active-bg':         'var(--color-bg-primary)',
      '--tab-active-border':     '#e0e0e0',

      // ── Skeleton ──
      '--skeleton-border':       'none',

      // ── Modal / overlay / sheet ──
      '--modal-border':          'none',
      '--modal-shadow':          '0 2px 8px -2px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.1), 0 24px 48px rgba(0,0,0,0.6)',
      '--overlay-bg':            'rgba(0,0,0,0.6)',
      '--sheet-radius-mobile':   '12px 12px 0 0',
      '--sheet-border-mobile':   'none',
      '--sheet-shadow-mobile':   '0 -2px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)',

      // ── Table ──
      '--table-header-bg':       '#1a1a1a',
      '--table-header-border':   '1px solid rgba(255,255,255,0.08)',
      '--table-row-border':      '1px solid rgba(255,255,255,0.06)',

      // ── Layout ──
      '--sidebar-panel-shadow':  '0 0 0 1px rgba(255,255,255,0.06), 2px 0 8px rgba(0,0,0,0.2)',
      '--divider-width':         '1px',

      // ── Floating ──
      '--shadow-float':          '0 2px 6px -2px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.08), 0 12px 28px rgba(0,0,0,0.4)',
      '--btn-group-shadow':      '0 0 0 1px rgba(255,255,255,0.1), 0 1px 4px rgba(0,0,0,0.3)',

      // ── Cal dark — cool neutral ──
      '--color-bg-primary':      '#111111',
      '--color-bg-secondary':    '#1a1a1a',
      '--color-bg-tertiary':     '#252525',
      '--color-bg-quaternary':   '#333333',
      '--color-bg-panel':        '#1a1a1a',
      '--color-bg-translucent':  'rgba(255,255,255,0.03)',
      '--color-text-primary':    '#f0f0f0',
      '--color-text-secondary':  '#a0a0a0',
      '--color-text-tertiary':   '#777777',
      '--color-text-quaternary': '#555555',
      '--color-text-on-color':   '#000000',

      // ── Accent — light neutral for dark mode ──
      '--color-accent':          '#e0e0e0',
      '--color-accent-hover':    '#f0f0f0',
      '--color-accent-tint':     'rgba(224,224,224,0.08)',
      '--color-brand-text':      '#111111',

      // ── Semantic — lighter for dark mode ──
      '--color-blue':            '#60a5fa',
      '--color-green':           '#4ade80',
      '--color-orange':          '#fb923c',
      '--color-purple':          '#a78bfa',
      '--color-success':         '#4ade80',
      '--color-success-light':   'rgba(74,222,128,0.1)',
      '--color-warning':         '#fb923c',
      '--color-warning-light':   'rgba(251,146,60,0.1)',
      '--color-danger':          '#f87171',
      '--color-danger-light':    'rgba(248,113,113,0.1)',
      '--color-danger-tint':     'rgba(248,113,113,0.1)',
      '--color-info':            '#60a5fa',

      // ── Borders ──
      '--color-border-primary':             'rgba(255,255,255,0.12)',
      '--color-border-secondary':           'rgba(255,255,255,0.1)',
      '--color-border-translucent':         'rgba(255,255,255,0.06)',

      // ── Lines ──
      '--color-line-secondary':  'rgba(255,255,255,0.1)',
      '--color-line-tertiary':   'rgba(255,255,255,0.06)',

      // ── Header ──
      '--header-bg':             'rgba(17,17,17,0.95)',
      '--header-border':         'rgba(255,255,255,0.06)',

      // ── Glass ──
      '--glass-bg':              'rgba(17,17,17,0.88)',
      '--glass-bg-sidebar':      'rgba(17,17,17,0.95)',
      '--glass-bg-content':      'rgba(17,17,17,0.97)',
      '--glass-border':          'rgba(255,255,255,0.06)',
      '--glass-shadow':          '0 0 0 1px rgba(255,255,255,0.05), 0 1px 4px rgba(0,0,0,0.3)',

      // ── Shadows — amplified dark ──
      '--shadow-tiny':           '0 0 0 1px rgba(255,255,255,0.08)',
      '--shadow-low':            '0 1px 3px -1px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06), 0 2px 6px rgba(0,0,0,0.3)',
      '--shadow-medium':         '0 2px 6px -2px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08), 0 6px 16px rgba(0,0,0,0.35)',
      '--shadow-high':           '0 2px 8px -2px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.1), 0 24px 48px rgba(0,0,0,0.5)',

      // ── Grid ──
      '--grid-line-color':       'rgba(255,255,255,0.04)',
    },
  },
};

export default calStyle;
