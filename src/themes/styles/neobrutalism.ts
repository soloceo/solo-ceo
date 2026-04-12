import type { StyleDefinition } from '../types';
import './neobrutalism.css';

/**
 * Neobrutalism style — Bold borders, hard shadows, punchy hover.
 * Inspired by neobrutalism.dev
 *
 * Structural DNA:
 * - 2px solid borders (black light / gray dark)
 * - Hard offset shadows (4px 4px 0, no blur)
 * - Hover: shadow disappears + element snaps via translate
 * - Small border-radius (5px)
 * - Space Grotesk headings, Inter body
 * - Uppercase labels, buttons, tabs, badges
 */
const neobrutalismStyle: StyleDefinition = {
  id: 'neobrutalism',
  nameKey: 'settings.style.neobrutalism',
  descKey: 'settings.style.neobrutalismDesc',
  order: 1,
  preview: {
    card: {
      border: '2px solid var(--color-text-primary)',
      borderRadius: '3px',
      boxShadow: '3px 3px 0 var(--color-text-primary)',
    },
    elements: {
      accentShape: 'bar',
      accentRadius: '1px',
      textLineRadius: 0,
    },
  },
  overrides: {
    light: {
      // ── Structural ──
      '--border-width':          '2px',
      '--border-width-heavy':    '3px',
      '--radius-base':           '5px',
      '--font-heading':          "'Space Grotesk', 'Inter', var(--font-regular)",
      '--font-base':             "'Inter', var(--font-regular)",
      '--shadow-interactive':    '4px 4px 0 #000000',
      '--shadow-interactive-hover': 'none',
      '--translate-hover-x':     '4px',
      '--translate-hover-y':     '4px',

      // ── Typography structural ──
      '--font-weight-heading':   '900',
      '--letter-spacing-heading': '-0.02em',
      '--text-transform-heading': 'none',
      '--font-weight-kpi':       '900',
      '--letter-spacing-kpi':    '-0.03em',
      '--text-transform-label':  'uppercase',
      '--letter-spacing-label':  '0.06em',
      '--text-transform-button': 'uppercase',
      '--letter-spacing-button': '0.03em',
      '--text-transform-badge':  'uppercase',
      '--letter-spacing-badge':  '0.03em',
      '--text-transform-tab':    'uppercase',
      '--letter-spacing-tab':    '0.04em',

      // ── Component dimensions ──
      '--badge-padding-x':       '6px',
      '--badge-padding-y':       '1px',
      '--badge-font-size':       '0.6875rem',
      '--badge-border-width':    '2px',

      // ── Component visual ──
      '--card-shadow':           '4px 4px 0 #000000',
      '--card-elevated-shadow':  '4px 4px 0 #000000',
      '--icon-btn-radius':       '5px',
      '--progress-height':       '8px',
      '--progress-radius':       '0px',
      '--progress-border':       '2px solid #000000',

      // ── Interaction ──
      '--opacity-disabled':      '0.4',
      '--opacity-active-press':  '1',
      '--focus-outline-width':   '3px',
      '--focus-outline-color':   '#000000',

      // ── Glass ──
      '--backdrop-blur':         'none',

      // ── Button interaction ──
      '--button-font-weight':    'var(--font-weight-bold)',
      '--btn-hover-shadow':      '2px 2px 0 #000000',
      '--btn-hover-translate-x': '2px',
      '--btn-hover-translate-y': '2px',
      '--btn-active-opacity':    '1',
      '--btn-active-translate-x': '2px',
      '--btn-active-translate-y': '2px',
      '--btn-active-shadow':     '2px 2px 0 #000000',

      // ── Icon button interaction ──
      '--icon-btn-border':       '2px solid transparent',
      '--icon-btn-hover-border': '#000000',
      '--icon-btn-hover-shadow': '2px 2px 0 #000000',

      // ── Input interaction ──
      '--input-shadow':          '2px 2px 0 #000000',
      '--input-focus-border':    '#000000',
      '--input-focus-shadow':    '4px 4px 0 #000000',
      '--select-shadow':         '2px 2px 0 #000000',

      // ── Ghost hover ──
      '--ghost-hover-border':    '#000000',

      // ── Component structural ──
      '--badge-font-weight':     'var(--font-weight-bold)',
      '--label-font-weight':     'var(--font-weight-bold)',
      '--kpi-label-font-size':   '11px',
      '--tab-font-size':         '12px',
      '--tab-radius':            '5px',
      '--tab-active-font-weight': 'var(--font-weight-bold)',
      '--tab-active-bg':         'var(--color-accent-tint)',
      '--tab-active-border':     '#000000',

      // ── Skeleton ──
      '--skeleton-border':       '2px solid rgba(0,0,0,0.25)',

      // ── Modal / overlay / sheet ──
      '--modal-border':          '3px solid #000000',
      '--modal-shadow':          '6px 6px 0 #000000',
      '--overlay-bg':            'rgba(0,0,0,0.3)',
      '--sheet-radius-mobile':   '0',
      '--sheet-border-mobile':   '3px solid #000000',
      '--sheet-shadow-mobile':   '0 -4px 0 #000000',

      // ── Table ──
      '--table-header-bg':       'var(--color-bg-tertiary)',
      '--table-header-border':   '2px solid #000000',
      '--table-row-border':      '2px solid rgba(0,0,0,0.25)',

      // ── Layout ──
      '--sidebar-panel-shadow':  '4px 4px 0 #000000',
      '--divider-width':         '2px',

      // ── Floating ──
      '--shadow-float':          '3px 3px 0 #000000',
      '--btn-group-shadow':      '2px 2px 0 #000000',

      // ── Colors — warm cream with stark black ──
      '--color-bg-primary':      '#fffdf7',
      '--color-bg-secondary':    '#f5f0e8',
      '--color-bg-tertiary':     '#ede6d9',
      '--color-bg-quaternary':   '#e0d7c8',
      '--color-bg-panel':        '#fffdf7',
      '--color-bg-translucent':  'rgba(0,0,0,0.04)',
      '--color-text-primary':    '#1a1a1a',
      '--color-text-secondary':  '#4a4a4a',
      '--color-text-tertiary':   '#7a7a7a',
      '--color-text-quaternary': '#aaaaaa',
      '--color-text-on-color':   '#ffffff',

      // ── Accent — bold pink (punchy neobrutalist signature) ──
      '--color-accent':          '#e84393',
      '--color-accent-hover':    '#d63384',
      '--color-accent-tint':     'rgba(232,67,147,0.12)',
      '--color-brand-text':      '#ffffff',

      // ── Semantic ──
      '--color-blue':            '#4361ee',
      '--color-green':           '#2dc653',
      '--color-orange':          '#ff6d00',
      '--color-purple':          '#7b2ff7',
      '--color-success':         '#2dc653',
      '--color-success-light':   'rgba(45,198,83,0.08)',
      '--color-warning':         '#ff6d00',
      '--color-warning-light':   'rgba(255,109,0,0.08)',
      '--color-danger':          '#ff0054',
      '--color-danger-light':    'rgba(255,0,84,0.08)',
      '--color-danger-tint':     'rgba(255,0,84,0.08)',
      '--color-info':            '#4361ee',

      // ── Borders — solid black ──
      '--color-border-primary':             '#000000',
      '--color-border-secondary':           '#000000',
      '--color-border-translucent':         '#000000',

      // ── Lines — stronger ──
      '--color-line-secondary':  'rgba(0,0,0,0.25)',
      '--color-line-tertiary':   'rgba(0,0,0,0.12)',

      // ── Header — opaque, follows palette bg ──
      '--header-bg':             '#fffdf7',
      '--header-border':         '#000000',

      // ── Glass — opaque, follows palette bg ──
      '--glass-bg':              '#fffdf7',
      '--glass-bg-sidebar':      '#f5f0e8',
      '--glass-bg-content':      '#fffdf7',
      '--glass-border':          '#000000',
      '--glass-shadow':          '3px 3px 0 #000000',

      // ── Shadows — hard offset, zero blur ──
      '--shadow-tiny':           '2px 2px 0 #000000',
      '--shadow-low':            '4px 4px 0 #000000',
      '--shadow-medium':         '4px 4px 0 #000000',
      '--shadow-high':           '6px 6px 0 #000000',

      // ── Grid — stronger ──
      '--grid-line-color':       'rgba(0,0,0,0.06)',
    },
    dark: {
      // ── Structural ──
      '--border-width':          '2px',
      '--border-width-heavy':    '3px',
      '--radius-base':           '5px',
      '--font-heading':          "'Space Grotesk', 'Inter', var(--font-regular)",
      '--font-base':             "'Inter', var(--font-regular)",
      '--shadow-interactive':    '4px 4px 0 #555555',
      '--shadow-interactive-hover': 'none',
      '--translate-hover-x':     '4px',
      '--translate-hover-y':     '4px',

      // ── Typography structural ──
      '--font-weight-heading':   '900',
      '--letter-spacing-heading': '-0.02em',
      '--text-transform-heading': 'none',
      '--font-weight-kpi':       '900',
      '--letter-spacing-kpi':    '-0.03em',
      '--text-transform-label':  'uppercase',
      '--letter-spacing-label':  '0.06em',
      '--text-transform-button': 'uppercase',
      '--letter-spacing-button': '0.03em',
      '--text-transform-badge':  'uppercase',
      '--letter-spacing-badge':  '0.03em',
      '--text-transform-tab':    'uppercase',
      '--letter-spacing-tab':    '0.04em',

      // ── Component dimensions ──
      '--badge-padding-x':       '6px',
      '--badge-padding-y':       '1px',
      '--badge-font-size':       '0.6875rem',
      '--badge-border-width':    '2px',

      // ── Component visual ──
      '--card-shadow':           '4px 4px 0 #555555',
      '--card-elevated-shadow':  '4px 4px 0 #555555',
      '--icon-btn-radius':       '5px',
      '--progress-height':       '8px',
      '--progress-radius':       '0px',
      '--progress-border':       '2px solid #666666',

      // ── Interaction ──
      '--opacity-disabled':      '0.4',
      '--opacity-active-press':  '1',
      '--focus-outline-width':   '3px',
      '--focus-outline-color':   '#666666',

      // ── Glass ──
      '--backdrop-blur':         'none',

      // ── Button interaction ──
      '--button-font-weight':    'var(--font-weight-bold)',
      '--btn-hover-shadow':      '2px 2px 0 #555555',
      '--btn-hover-translate-x': '2px',
      '--btn-hover-translate-y': '2px',
      '--btn-active-opacity':    '1',
      '--btn-active-translate-x': '2px',
      '--btn-active-translate-y': '2px',
      '--btn-active-shadow':     '2px 2px 0 #555555',

      // ── Icon button interaction ──
      '--icon-btn-border':       '2px solid transparent',
      '--icon-btn-hover-border': '#666666',
      '--icon-btn-hover-shadow': '2px 2px 0 #555555',

      // ── Input interaction ──
      '--input-shadow':          '2px 2px 0 #555555',
      '--input-focus-border':    '#666666',
      '--input-focus-shadow':    '4px 4px 0 #555555',
      '--select-shadow':         '2px 2px 0 #555555',

      // ── Ghost hover ──
      '--ghost-hover-border':    '#666666',

      // ── Component structural ──
      '--badge-font-weight':     'var(--font-weight-bold)',
      '--label-font-weight':     'var(--font-weight-bold)',
      '--kpi-label-font-size':   '11px',
      '--tab-font-size':         '12px',
      '--tab-radius':            '5px',
      '--tab-active-font-weight': 'var(--font-weight-bold)',
      '--tab-active-bg':         'var(--color-accent-tint)',
      '--tab-active-border':     '#666666',

      // ── Skeleton ──
      '--skeleton-border':       '2px solid rgba(255,255,255,0.2)',

      // ── Modal / overlay / sheet ──
      '--modal-border':          '3px solid #666666',
      '--modal-shadow':          '6px 6px 0 #555555',
      '--overlay-bg':            'rgba(0,0,0,0.3)',
      '--sheet-radius-mobile':   '0',
      '--sheet-border-mobile':   '3px solid #666666',
      '--sheet-shadow-mobile':   '0 -4px 0 #666666',

      // ── Table ──
      '--table-header-bg':       'var(--color-bg-tertiary)',
      '--table-header-border':   '2px solid #666666',
      '--table-row-border':      '2px solid rgba(255,255,255,0.2)',

      // ── Layout ──
      '--sidebar-panel-shadow':  '4px 4px 0 #555555',
      '--divider-width':         '2px',

      // ── Floating ──
      '--shadow-float':          '3px 3px 0 #666666',
      '--btn-group-shadow':      '2px 2px 0 #555555',

      // ── Colors — warm dark with gray borders ──
      '--color-bg-primary':      '#1c1a16',
      '--color-bg-secondary':    '#252218',
      '--color-bg-tertiary':     '#302c22',
      '--color-bg-quaternary':   '#3d382c',
      '--color-bg-panel':        '#252218',
      '--color-bg-translucent':  'rgba(255,255,255,0.04)',
      '--color-text-primary':    '#f5f0e8',
      '--color-text-secondary':  '#b5ad9e',
      '--color-text-tertiary':   '#8a8278',
      '--color-text-quaternary': '#5a5448',
      '--color-text-on-color':   '#000000',

      // ── Accent — bold pink (punchy neobrutalist signature) ──
      '--color-accent':          '#f06292',
      '--color-accent-hover':    '#ec407a',
      '--color-accent-tint':     'rgba(240,98,146,0.15)',
      '--color-brand-text':      '#000000',

      // ── Semantic ──
      '--color-blue':            '#6c8aff',
      '--color-green':           '#5ee87b',
      '--color-orange':          '#ff9533',
      '--color-purple':          '#a56eff',
      '--color-success':         '#5ee87b',
      '--color-success-light':   'rgba(94,232,123,0.12)',
      '--color-warning':         '#ff9533',
      '--color-warning-light':   'rgba(255,149,51,0.12)',
      '--color-danger':          '#ff4477',
      '--color-danger-light':    'rgba(255,68,119,0.12)',
      '--color-danger-tint':     'rgba(255,68,119,0.12)',
      '--color-info':            '#6c8aff',

      // ── Borders — visible gray ──
      '--color-border-primary':             '#666666',
      '--color-border-secondary':           '#666666',
      '--color-border-translucent':         '#666666',

      // ── Lines — stronger ──
      '--color-line-secondary':  'rgba(255,255,255,0.2)',
      '--color-line-tertiary':   'rgba(255,255,255,0.1)',

      // ── Header — opaque, follows palette bg ──
      '--header-bg':             '#1c1a16',
      '--header-border':         '#666666',

      // ── Glass — opaque, follows palette bg ──
      '--glass-bg':              '#1c1a16',
      '--glass-bg-sidebar':      '#252218',
      '--glass-bg-content':      '#1c1a16',
      '--glass-border':          '#666666',
      '--glass-shadow':          '3px 3px 0 #666666',

      // ── Shadows — hard offset gray ──
      '--shadow-tiny':           '2px 2px 0 #555555',
      '--shadow-low':            '4px 4px 0 #555555',
      '--shadow-medium':         '4px 4px 0 #555555',
      '--shadow-high':           '6px 6px 0 #555555',

      // ── Grid — stronger ──
      '--grid-line-color':       'rgba(255,255,255,0.04)',
    },
  },
};

export default neobrutalismStyle;
