import type { StyleDefinition } from '../types';
import './carbon.css';

/**
 * Carbon — IBM Carbon Design System inspired.
 *
 * Structural DNA:
 * - 0px border-radius everywhere (the Carbon signature — rectangles rule)
 * - IBM Plex Sans display at weight 300 (Light) for gravity through restraint
 * - IBM Plex Mono for code and technical content
 * - Micro-tracking: 0.16px at small sizes, 0.32px on labels/captions
 * - Three functional weights: 400 body, 500 UI, 600 emphasis — no 700/bold
 * - Flat design: depth through background-color layering, not shadows
 * - Bottom-border inputs — the Carbon form signature (no boxed borders)
 * - 48px interactive height standard
 * - Blue focus ring (#0f62fe) 2px inset
 */
const carbonStyle: StyleDefinition = {
  id: 'carbon',
  nameKey: 'settings.style.carbon',
  descKey: 'settings.style.carbonDesc',
  order: 4,
  preview: {
    card: {
      border: '1px solid #e0e0e0',
      borderRadius: '0px',
      boxShadow: 'none',
    },
    elements: {
      accentShape: 'bar',
      accentRadius: 0,
      textLineRadius: 0,
    },
  },
  overrides: {
    light: {
      // ── Structural — hard rectangles, flat ──
      '--border-width':          '1px',
      '--border-width-heavy':    '1px',
      '--radius-base':           '0px',
      '--font-heading':          "'IBM Plex Sans', 'Helvetica Neue', Arial, var(--font-regular)",
      '--font-base':             "'IBM Plex Sans', 'Helvetica Neue', Arial, var(--font-regular)",
      '--shadow-interactive':    'none',
      '--shadow-interactive-hover': 'none',
      '--translate-hover-x':     '0px',
      '--translate-hover-y':     '0px',

      // ── Typography — light display, micro-tracking at small sizes ──
      '--font-weight-heading':   '300',
      '--letter-spacing-heading': '0',
      '--text-transform-heading': 'none',
      '--font-weight-kpi':       '300',
      '--letter-spacing-kpi':    '0',
      '--text-transform-label':  'none',
      '--letter-spacing-label':  '0.32px',
      '--text-transform-button': 'none',
      '--letter-spacing-button': '0.16px',
      '--text-transform-badge':  'none',
      '--letter-spacing-badge':  '0.32px',
      '--text-transform-tab':    'none',
      '--letter-spacing-tab':    '0.16px',

      // ── Component dimensions — Carbon 48px interactive ──
      '--button-height':         '48px',
      '--button-height-compact': '40px',
      '--input-height':          '40px',
      '--button-padding-x':      '16px',
      '--button-padding-y':      '14px',
      '--button-font-size':      '0.875rem',
      '--badge-padding-x':       '8px',
      '--badge-padding-y':       '2px',
      '--badge-font-size':       '0.75rem',
      '--badge-border-width':    '0px',

      // ── Radius — sharp rectangles throughout, badges included ──
      '--btn-radius':            '0px',
      '--badge-radius':          '0px',
      '--tab-radius':            '0px',

      // ── Component visual — flat, borderless cards ──
      '--card-shadow':           'none',
      '--card-elevated-shadow':  'none',
      '--icon-btn-radius':       '0px',
      '--progress-height':       '4px',
      '--progress-radius':       '0px',
      '--progress-border':       'none',

      // ── Interaction ──
      '--opacity-disabled':      '0.5',
      '--opacity-active-press':  '1',
      '--focus-outline-width':   '2px',
      '--focus-outline-color':   '#0f62fe',

      // ── Glass — minimal blur ──
      '--backdrop-blur':         'blur(12px)',

      // ── Animation — Carbon productive motion scale ──
      '--duration-fast':         '70ms',
      '--duration-normal':       '110ms',
      '--duration-slow':         '240ms',
      '--duration-slower':       '400ms',

      // ── Button — solid state shifts, no translate ──
      '--button-font-weight':    '400',
      '--btn-hover-shadow':      'none',
      '--btn-hover-translate-x': '0px',
      '--btn-hover-translate-y': '0px',
      '--btn-active-opacity':    '1',
      '--btn-active-translate-x': '0px',
      '--btn-active-translate-y': '0px',
      '--btn-active-shadow':     'none',

      // ── Icon button — square, flat ──
      '--icon-btn-border':       '1px solid transparent',
      '--icon-btn-hover-border': 'transparent',
      '--icon-btn-hover-shadow': 'none',

      // ── Input — bottom-border only (the Carbon signature) ──
      '--input-shadow':          'inset 0 -1px 0 0 #161616',
      '--input-focus-border':    '#0f62fe',
      '--input-focus-shadow':    'inset 0 -2px 0 0 #0f62fe',
      '--select-shadow':         'inset 0 -1px 0 0 #161616',

      // ── Ghost hover ──
      '--ghost-hover-border':    'transparent',

      // ── Component structural ──
      '--badge-font-weight':     '400',
      '--label-font-weight':     '400',
      '--kpi-label-font-size':   '12px',
      '--tab-font-size':         '14px',
      '--tab-active-font-weight': '600',
      '--tab-active-bg':         'transparent',
      '--tab-active-color':      '#161616',
      '--tab-active-border':     '#0f62fe',

      // ── Skeleton ──
      '--skeleton-border':       'none',

      // ── Modal / overlay / sheet — light shadow only where floating ──
      '--modal-border':          'none',
      '--modal-shadow':          '0 2px 6px rgba(0,0,0,0.3)',
      '--overlay-bg':            'rgba(22,22,22,0.5)',
      '--sheet-radius-mobile':   '0px',
      '--sheet-border-mobile':   'none',
      '--sheet-shadow-mobile':   '0 -2px 6px rgba(0,0,0,0.2)',

      // ── Table ──
      '--table-header-bg':       '#f4f4f4',
      '--table-header-border':   '1px solid #e0e0e0',
      '--table-row-border':      '1px solid #e0e0e0',

      // ── Layout ──
      '--sidebar-panel-shadow':  'none',
      '--divider-width':         '1px',

      // ── Floating (dropdowns, tooltips) — meaningful shadow only here ──
      '--shadow-float':          '0 2px 6px rgba(0,0,0,0.3)',
      '--btn-group-shadow':      'none',

      // ── Carbon light palette ──
      '--color-bg-primary':      '#ffffff',
      '--color-bg-secondary':    '#f4f4f4',
      '--color-bg-tertiary':     '#e8e8e8',
      '--color-bg-quaternary':   '#e0e0e0',
      '--color-bg-panel':        '#ffffff',
      '--color-bg-translucent':  'rgba(22,22,22,0.03)',
      '--color-text-primary':    '#161616',
      '--color-text-secondary':  '#525252',
      '--color-text-tertiary':   '#6f6f6f',
      '--color-text-quaternary': '#8d8d8d',
      '--color-text-on-color':   '#ffffff',

      // ── Accent — IBM Blue 60, the single interactive color ──
      '--color-accent':          '#0f62fe',
      '--color-accent-hover':    '#0353e9',
      '--color-accent-tint':     'rgba(15,98,254,0.08)',
      '--color-brand-text':      '#ffffff',

      // ── Semantic — Carbon support colors ──
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

      // ── Borders — Carbon Gray 30 / Gray 20 ──
      '--color-border-primary':             '#c6c6c6',
      '--color-border-secondary':           '#e0e0e0',
      '--color-border-translucent':         'rgba(22,22,22,0.08)',

      // ── Lines ──
      '--color-line-secondary':  '#e0e0e0',
      '--color-line-tertiary':   '#e8e8e8',

      // ── Header — signature dark Carbon masthead (Gray 100) ──
      '--header-bg':             '#161616',
      '--header-border':         '#262626',

      // ── Glass ──
      '--glass-bg':              'rgba(255,255,255,0.95)',
      '--glass-bg-sidebar':      'rgba(244,244,244,0.95)',
      '--glass-bg-content':      'rgba(255,255,255,0.97)',
      '--glass-border':          '#e0e0e0',
      '--glass-shadow':          'none',

      // ── Shadows — reserved for floating only ──
      '--shadow-tiny':           'none',
      '--shadow-low':            'none',
      '--shadow-medium':         '0 2px 6px rgba(0,0,0,0.1)',
      '--shadow-high':           '0 2px 6px rgba(0,0,0,0.3)',

      // ── Grid ──
      '--grid-line-color':       'rgba(22,22,22,0.04)',
    },
    dark: {
      // ── Structural ──
      '--border-width':          '1px',
      '--border-width-heavy':    '1px',
      '--radius-base':           '0px',
      '--font-heading':          "'IBM Plex Sans', 'Helvetica Neue', Arial, var(--font-regular)",
      '--font-base':             "'IBM Plex Sans', 'Helvetica Neue', Arial, var(--font-regular)",
      '--shadow-interactive':    'none',
      '--shadow-interactive-hover': 'none',
      '--translate-hover-x':     '0px',
      '--translate-hover-y':     '0px',

      // ── Typography ──
      '--font-weight-heading':   '300',
      '--letter-spacing-heading': '0',
      '--text-transform-heading': 'none',
      '--font-weight-kpi':       '300',
      '--letter-spacing-kpi':    '0',
      '--text-transform-label':  'none',
      '--letter-spacing-label':  '0.32px',
      '--text-transform-button': 'none',
      '--letter-spacing-button': '0.16px',
      '--text-transform-badge':  'none',
      '--letter-spacing-badge':  '0.32px',
      '--text-transform-tab':    'none',
      '--letter-spacing-tab':    '0.16px',

      // ── Component dimensions ──
      '--button-height':         '48px',
      '--button-height-compact': '40px',
      '--input-height':          '40px',
      '--button-padding-x':      '16px',
      '--button-padding-y':      '14px',
      '--button-font-size':      '0.875rem',
      '--badge-padding-x':       '8px',
      '--badge-padding-y':       '2px',
      '--badge-font-size':       '0.75rem',
      '--badge-border-width':    '0px',

      // ── Radius ──
      '--btn-radius':            '0px',
      '--badge-radius':          '0px',
      '--tab-radius':            '0px',

      // ── Component visual ──
      '--card-shadow':           'none',
      '--card-elevated-shadow':  'none',
      '--icon-btn-radius':       '0px',
      '--progress-height':       '4px',
      '--progress-radius':       '0px',
      '--progress-border':       'none',

      // ── Interaction ──
      '--opacity-disabled':      '0.5',
      '--opacity-active-press':  '1',
      '--focus-outline-width':   '2px',
      '--focus-outline-color':   '#78a9ff',

      // ── Glass ──
      '--backdrop-blur':         'blur(12px)',

      // ── Animation — Carbon productive motion scale ──
      '--duration-fast':         '70ms',
      '--duration-normal':       '110ms',
      '--duration-slow':         '240ms',
      '--duration-slower':       '400ms',

      // ── Button ──
      '--button-font-weight':    '400',
      '--btn-hover-shadow':      'none',
      '--btn-hover-translate-x': '0px',
      '--btn-hover-translate-y': '0px',
      '--btn-active-opacity':    '1',
      '--btn-active-translate-x': '0px',
      '--btn-active-translate-y': '0px',
      '--btn-active-shadow':     'none',

      // ── Icon button ──
      '--icon-btn-border':       '1px solid transparent',
      '--icon-btn-hover-border': 'transparent',
      '--icon-btn-hover-shadow': 'none',

      // ── Input — bottom-border ──
      '--input-shadow':          'inset 0 -1px 0 0 #f4f4f4',
      '--input-focus-border':    '#78a9ff',
      '--input-focus-shadow':    'inset 0 -2px 0 0 #78a9ff',
      '--select-shadow':         'inset 0 -1px 0 0 #f4f4f4',

      // ── Ghost hover ──
      '--ghost-hover-border':    'transparent',

      // ── Component structural ──
      '--badge-font-weight':     '400',
      '--label-font-weight':     '400',
      '--kpi-label-font-size':   '12px',
      '--tab-font-size':         '14px',
      '--tab-active-font-weight': '600',
      '--tab-active-bg':         'transparent',
      '--tab-active-color':      '#f4f4f4',
      '--tab-active-border':     '#78a9ff',

      // ── Skeleton ──
      '--skeleton-border':       'none',

      // ── Modal / overlay / sheet ──
      '--modal-border':          'none',
      '--modal-shadow':          '0 2px 6px rgba(0,0,0,0.5)',
      '--overlay-bg':            'rgba(0,0,0,0.7)',
      '--sheet-radius-mobile':   '0px',
      '--sheet-border-mobile':   'none',
      '--sheet-shadow-mobile':   '0 -2px 6px rgba(0,0,0,0.4)',

      // ── Table ──
      '--table-header-bg':       '#262626',
      '--table-header-border':   '1px solid #393939',
      '--table-row-border':      '1px solid #393939',

      // ── Layout ──
      '--sidebar-panel-shadow':  'none',
      '--divider-width':         '1px',

      // ── Floating ──
      '--shadow-float':          '0 2px 6px rgba(0,0,0,0.5)',
      '--btn-group-shadow':      'none',

      // ── Carbon dark palette (Gray 100 theme) ──
      '--color-bg-primary':      '#161616',
      '--color-bg-secondary':    '#262626',
      '--color-bg-tertiary':     '#393939',
      '--color-bg-quaternary':   '#525252',
      '--color-bg-panel':        '#262626',
      '--color-bg-translucent':  'rgba(255,255,255,0.04)',
      '--color-text-primary':    '#f4f4f4',
      '--color-text-secondary':  '#c6c6c6',
      '--color-text-tertiary':   '#8d8d8d',
      '--color-text-quaternary': '#6f6f6f',
      '--color-text-on-color':   '#ffffff',

      // ── Accent — Blue 40 for dark mode contrast ──
      '--color-accent':          '#78a9ff',
      '--color-accent-hover':    '#a6c8ff',
      '--color-accent-tint':     'rgba(120,169,255,0.12)',
      '--color-brand-text':      '#161616',

      // ── Semantic ──
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

      // ── Borders ──
      '--color-border-primary':             '#525252',
      '--color-border-secondary':           '#393939',
      '--color-border-translucent':         'rgba(255,255,255,0.08)',

      // ── Lines ──
      '--color-line-secondary':  '#393939',
      '--color-line-tertiary':   '#262626',

      // ── Header — pure black masthead ──
      '--header-bg':             '#000000',
      '--header-border':         '#393939',

      // ── Glass ──
      '--glass-bg':              'rgba(22,22,22,0.95)',
      '--glass-bg-sidebar':      'rgba(38,38,38,0.95)',
      '--glass-bg-content':      'rgba(22,22,22,0.97)',
      '--glass-border':          '#393939',
      '--glass-shadow':          'none',

      // ── Shadows ──
      '--shadow-tiny':           'none',
      '--shadow-low':            'none',
      '--shadow-medium':         '0 2px 6px rgba(0,0,0,0.4)',
      '--shadow-high':           '0 2px 6px rgba(0,0,0,0.5)',

      // ── Grid ──
      '--grid-line-color':       'rgba(255,255,255,0.04)',
    },
  },
};

export default carbonStyle;
