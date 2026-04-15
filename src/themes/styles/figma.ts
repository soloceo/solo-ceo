import type { StyleDefinition } from '../types';
import './figma.css';

/**
 * Figma — Inspired by Figma's design system.
 *
 * Structural DNA:
 * - Pill (9999px) button geometry, circle (50%) icon buttons
 * - Dashed 2px focus outlines (echoing editor selection handles)
 * - ZERO shadows on cards — depth through bg contrast only
 * - Geist font (figmaSans equivalent), tight negative letter-spacing
 * - Uppercase labels with wide letter-spacing (mono signpost style)
 * - Pure black (#000) / white (#fff) interface chrome
 * - Opacity-based hover/press — no translate, no shadow change
 * - Extremely flat — no card shadows, no button shadows, no input shadows
 */
const figmaStyle: StyleDefinition = {
  id: 'figma',
  nameKey: 'settings.style.figma',
  descKey: 'settings.style.figmaDesc',
  order: 3,
  preview: {
    accent: '#4285f4',
    card: {
      border: 'none',
      borderRadius: '12px',
      boxShadow: 'none',
    },
    elements: {
      accentShape: 'chip-row',
      accentRadius: '9999px',
      textLineRadius: 6,
    },
  },
  overrides: {
    light: {
      // ── Structural — zero borders, shadow-free ──
      '--border-width':          '0px',
      '--border-width-heavy':    '0px',
      '--radius-base':           '12px',
      '--font-heading':          "'Geist', 'Inter', var(--font-regular)",
      '--font-base':             "'Geist', 'Inter', var(--font-regular)",
      '--shadow-interactive':    'none',
      '--shadow-interactive-hover': 'none',
      '--translate-hover-x':     '0px',
      '--translate-hover-y':     '0px',

      // ── Typography — tight, negative tracking everywhere ──
      '--font-weight-heading':   '700',
      '--letter-spacing-heading': '-0.035em',
      '--text-transform-heading': 'none',
      '--font-weight-kpi':       '700',
      '--letter-spacing-kpi':    '-0.04em',
      '--text-transform-label':  'uppercase',
      '--letter-spacing-label':  '0.05em',
      '--text-transform-button': 'none',
      '--letter-spacing-button': '-0.02em',
      '--text-transform-badge':  'uppercase',
      '--letter-spacing-badge':  '0.04em',
      '--text-transform-tab':    'none',
      '--letter-spacing-tab':    '-0.01em',

      // ── Component dimensions ──
      '--badge-padding-x':       '10px',
      '--badge-padding-y':       '3px',
      '--badge-font-size':       '0.6875rem',
      '--badge-border-width':    '0px',

      // ── Pill geometry — buttons, badges, tabs all pill ──
      '--btn-radius':            '9999px',
      '--badge-radius':          '9999px',
      '--tab-radius':            '9999px',

      // ── Component visual — ZERO shadows ──
      '--card-shadow':           'none',
      '--card-elevated-shadow':  'none',
      '--icon-btn-radius':       '50%',
      '--progress-height':       '4px',
      '--progress-radius':       '9999px',
      '--progress-border':       'none',

      // ── Interaction — pure opacity ──
      '--opacity-disabled':      '0.35',
      '--opacity-active-press':  '0.7',
      '--focus-outline-width':   '2px',
      '--focus-outline-color':   '#4285f4',

      // ── Glass — very subtle ──
      '--backdrop-blur':         'blur(16px) saturate(120%)',

      // ── Button — opacity only, zero shadows ──
      '--button-font-weight':    'var(--font-weight-medium)',
      '--btn-hover-shadow':      'none',
      '--btn-hover-translate-x': '0px',
      '--btn-hover-translate-y': '0px',
      '--btn-active-opacity':    '0.7',
      '--btn-active-translate-x': '0px',
      '--btn-active-translate-y': '0px',
      '--btn-active-shadow':     'none',

      // ── Icon button — glass tint, no border/shadow ──
      '--icon-btn-border':       '0px solid transparent',
      '--icon-btn-hover-border': 'transparent',
      '--icon-btn-hover-shadow': 'none',

      // ── Input — flat, border only, no shadow ──
      '--input-shadow':          'none',
      '--input-focus-border':    '#4285f4',
      '--input-focus-shadow':    'none',
      '--select-shadow':         'none',

      // ── Ghost hover ──
      '--ghost-hover-border':    'transparent',

      // ── Component structural ──
      '--badge-font-weight':     'var(--font-weight-medium)',
      '--label-font-weight':     'var(--font-weight-medium)',
      '--kpi-label-font-size':   '11px',
      '--tab-font-size':         '14px',
      '--tab-active-font-weight': 'var(--font-weight-semibold)',
      '--tab-active-bg':         '#4285f4',
      '--tab-active-color':      '#ffffff',
      '--tab-active-border':     'transparent',

      // ── Skeleton ──
      '--skeleton-border':       'none',

      // ── Modal / overlay / sheet ──
      '--modal-border':          'none',
      '--modal-shadow':          '0 16px 48px rgba(0,0,0,0.16)',
      '--overlay-bg':            'rgba(0,0,0,0.5)',
      '--sheet-radius-mobile':   '16px 16px 0 0',
      '--sheet-border-mobile':   'none',
      '--sheet-shadow-mobile':   '0 -4px 24px rgba(0,0,0,0.1)',

      // ── Table ──
      '--table-header-bg':       '#f5f5f5',
      '--table-header-border':   'none',
      '--table-row-border':      '1px solid rgba(0,0,0,0.06)',

      // ── Layout ──
      '--sidebar-panel-shadow':  'none',
      '--divider-width':         '1px',

      // ── Floating ──
      '--shadow-float':          '0 8px 24px rgba(0,0,0,0.12)',
      '--btn-group-shadow':      'none',

      // ── Figma pure black/white chrome ──
      '--color-bg-primary':      '#ffffff',
      '--color-bg-secondary':    '#f5f5f5',
      '--color-bg-tertiary':     '#eeeeee',
      '--color-bg-quaternary':   '#e0e0e0',
      '--color-bg-panel':        '#ffffff',
      '--color-bg-translucent':  'rgba(0,0,0,0.03)',
      '--color-text-primary':    '#000000',
      '--color-text-secondary':  '#555555',
      '--color-text-tertiary':   '#888888',
      '--color-text-quaternary': '#aaaaaa',
      '--color-text-on-color':   '#ffffff',

      // ── Accent — Google blue (matches Figma's primary action color) ──
      '--color-accent':          '#4285f4',
      '--color-accent-hover':    '#3367d6',
      '--color-accent-tint':     'rgba(66,133,244,0.08)',
      '--color-brand-text':      '#ffffff',

      // ── Semantic — neutral, monochrome-friendly ──
      '--color-blue':            '#4285f4',
      '--color-green':           '#14ae5c',
      '--color-orange':          '#f24822',
      '--color-purple':          '#9747ff',
      '--color-success':         '#14ae5c',
      '--color-success-light':   'rgba(20,174,92,0.06)',
      '--color-warning':         '#ffcd29',
      '--color-warning-light':   'rgba(255,205,41,0.06)',
      '--color-danger':          '#f24822',
      '--color-danger-light':    'rgba(242,72,34,0.06)',
      '--color-danger-tint':     'rgba(242,72,34,0.06)',
      '--color-info':            '#4285f4',

      // ── Borders — barely there ──
      '--color-border-primary':             'rgba(0,0,0,0.08)',
      '--color-border-secondary':           'rgba(0,0,0,0.06)',
      '--color-border-translucent':         'rgba(0,0,0,0.04)',

      // ── Lines ──
      '--color-line-secondary':  'rgba(0,0,0,0.06)',
      '--color-line-tertiary':   'rgba(0,0,0,0.04)',

      // ── Header ──
      '--header-bg':             '#ffffff',
      '--header-border':         'rgba(0,0,0,0.06)',

      // ── Glass ──
      '--glass-bg':              'rgba(255,255,255,0.9)',
      '--glass-bg-sidebar':      '#ffffff',
      '--glass-bg-content':      '#ffffff',
      '--glass-border':          'rgba(0,0,0,0.06)',
      '--glass-shadow':          'none',

      // ── Shadows — near zero ──
      '--shadow-tiny':           'none',
      '--shadow-low':            'none',
      '--shadow-medium':         '0 4px 12px rgba(0,0,0,0.06)',
      '--shadow-high':           '0 16px 48px rgba(0,0,0,0.12)',

      // ── Grid ──
      '--grid-line-color':       'rgba(0,0,0,0.03)',
    },
    dark: {
      // ── Structural — zero borders, shadow-free ──
      '--border-width':          '0px',
      '--border-width-heavy':    '0px',
      '--radius-base':           '12px',
      '--font-heading':          "'Geist', 'Inter', var(--font-regular)",
      '--font-base':             "'Geist', 'Inter', var(--font-regular)",
      '--shadow-interactive':    'none',
      '--shadow-interactive-hover': 'none',
      '--translate-hover-x':     '0px',
      '--translate-hover-y':     '0px',

      // ── Typography — tight, negative tracking ──
      '--font-weight-heading':   '700',
      '--letter-spacing-heading': '-0.035em',
      '--text-transform-heading': 'none',
      '--font-weight-kpi':       '700',
      '--letter-spacing-kpi':    '-0.04em',
      '--text-transform-label':  'uppercase',
      '--letter-spacing-label':  '0.05em',
      '--text-transform-button': 'none',
      '--letter-spacing-button': '-0.02em',
      '--text-transform-badge':  'uppercase',
      '--letter-spacing-badge':  '0.04em',
      '--text-transform-tab':    'none',
      '--letter-spacing-tab':    '-0.01em',

      // ── Component dimensions ──
      '--badge-padding-x':       '10px',
      '--badge-padding-y':       '3px',
      '--badge-font-size':       '0.6875rem',
      '--badge-border-width':    '0px',

      // ── Pill geometry ──
      '--btn-radius':            '9999px',
      '--badge-radius':          '9999px',
      '--tab-radius':            '9999px',

      // ── Component visual — ZERO shadows ──
      '--card-shadow':           'none',
      '--card-elevated-shadow':  'none',
      '--icon-btn-radius':       '50%',
      '--progress-height':       '4px',
      '--progress-radius':       '9999px',
      '--progress-border':       'none',

      // ── Interaction — pure opacity ──
      '--opacity-disabled':      '0.35',
      '--opacity-active-press':  '0.7',
      '--focus-outline-width':   '2px',
      '--focus-outline-color':   '#8ab4f8',

      // ── Glass ──
      '--backdrop-blur':         'blur(16px) saturate(120%)',

      // ── Button — opacity only ──
      '--button-font-weight':    'var(--font-weight-medium)',
      '--btn-hover-shadow':      'none',
      '--btn-hover-translate-x': '0px',
      '--btn-hover-translate-y': '0px',
      '--btn-active-opacity':    '0.7',
      '--btn-active-translate-x': '0px',
      '--btn-active-translate-y': '0px',
      '--btn-active-shadow':     'none',

      // ── Icon button ──
      '--icon-btn-border':       '0px solid transparent',
      '--icon-btn-hover-border': 'transparent',
      '--icon-btn-hover-shadow': 'none',

      // ── Input — flat ──
      '--input-shadow':          'none',
      '--input-focus-border':    '#8ab4f8',
      '--input-focus-shadow':    'none',
      '--select-shadow':         'none',

      // ── Ghost hover ──
      '--ghost-hover-border':    'transparent',

      // ── Component structural ──
      '--badge-font-weight':     'var(--font-weight-medium)',
      '--label-font-weight':     'var(--font-weight-medium)',
      '--kpi-label-font-size':   '11px',
      '--tab-font-size':         '14px',
      '--tab-active-font-weight': 'var(--font-weight-semibold)',
      '--tab-active-bg':         '#8ab4f8',
      '--tab-active-color':      '#000000',
      '--tab-active-border':     'transparent',

      // ── Skeleton ──
      '--skeleton-border':       'none',

      // ── Modal / overlay / sheet ──
      '--modal-border':          'none',
      '--modal-shadow':          '0 16px 48px rgba(0,0,0,0.5)',
      '--overlay-bg':            'rgba(0,0,0,0.65)',
      '--sheet-radius-mobile':   '16px 16px 0 0',
      '--sheet-border-mobile':   'none',
      '--sheet-shadow-mobile':   '0 -4px 24px rgba(0,0,0,0.4)',

      // ── Table ──
      '--table-header-bg':       '#1a1a1a',
      '--table-header-border':   'none',
      '--table-row-border':      '1px solid rgba(255,255,255,0.06)',

      // ── Layout ──
      '--sidebar-panel-shadow':  'none',
      '--divider-width':         '1px',

      // ── Floating ──
      '--shadow-float':          '0 8px 24px rgba(0,0,0,0.4)',
      '--btn-group-shadow':      'none',

      // ── Figma pure dark chrome ──
      '--color-bg-primary':      '#0e0e0e',
      '--color-bg-secondary':    '#1a1a1a',
      '--color-bg-tertiary':     '#252525',
      '--color-bg-quaternary':   '#333333',
      '--color-bg-panel':        '#1a1a1a',
      '--color-bg-translucent':  'rgba(255,255,255,0.04)',
      '--color-text-primary':    '#ffffff',
      '--color-text-secondary':  '#aaaaaa',
      '--color-text-tertiary':   '#777777',
      '--color-text-quaternary': '#555555',
      '--color-text-on-color':   '#000000',

      // ── Accent — Google blue (lighter for dark-mode contrast) ──
      '--color-accent':          '#8ab4f8',
      '--color-accent-hover':    '#aecbfa',
      '--color-accent-tint':     'rgba(138,180,248,0.1)',
      '--color-brand-text':      '#000000',

      // ── Semantic — lighter for dark mode ──
      '--color-blue':            '#8ab4f8',
      '--color-green':           '#4ecb71',
      '--color-orange':          '#f57b5c',
      '--color-purple':          '#b07cff',
      '--color-success':         '#4ecb71',
      '--color-success-light':   'rgba(78,203,113,0.1)',
      '--color-warning':         '#ffd966',
      '--color-warning-light':   'rgba(255,217,102,0.1)',
      '--color-danger':          '#f57b5c',
      '--color-danger-light':    'rgba(245,123,92,0.1)',
      '--color-danger-tint':     'rgba(245,123,92,0.1)',
      '--color-info':            '#8ab4f8',

      // ── Borders — barely there ──
      '--color-border-primary':             'rgba(255,255,255,0.1)',
      '--color-border-secondary':           'rgba(255,255,255,0.08)',
      '--color-border-translucent':         'rgba(255,255,255,0.05)',

      // ── Lines ──
      '--color-line-secondary':  'rgba(255,255,255,0.08)',
      '--color-line-tertiary':   'rgba(255,255,255,0.05)',

      // ── Header ──
      '--header-bg':             '#0e0e0e',
      '--header-border':         'rgba(255,255,255,0.06)',

      // ── Glass ──
      '--glass-bg':              'rgba(14,14,14,0.9)',
      '--glass-bg-sidebar':      '#0e0e0e',
      '--glass-bg-content':      '#0e0e0e',
      '--glass-border':          'rgba(255,255,255,0.06)',
      '--glass-shadow':          'none',

      // ── Shadows — near zero ──
      '--shadow-tiny':           'none',
      '--shadow-low':            'none',
      '--shadow-medium':         '0 4px 12px rgba(0,0,0,0.3)',
      '--shadow-high':           '0 16px 48px rgba(0,0,0,0.5)',

      // ── Grid ──
      '--grid-line-color':       'rgba(255,255,255,0.04)',
    },
  },
};

export default figmaStyle;
