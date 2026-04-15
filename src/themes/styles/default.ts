import type { StyleDefinition } from '../types';

/**
 * Default style — Notion-inspired flat.
 * No overrides: all structural tokens come from tokens.css defaults.
 * Rounded corners, soft shadows, system fonts, no hover translate.
 */
const defaultStyle: StyleDefinition = {
  id: 'default',
  nameKey: 'settings.style.default',
  descKey: 'settings.style.defaultDesc',
  order: 0,
  preview: {
    accent: '#f5c518',
    card: {
      border: '1px solid var(--color-border-secondary)',
      borderRadius: '8px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    },
    elements: {
      accentShape: 'bar',
      accentRadius: 3,
      textLineRadius: 2,
    },
  },
  overrides: { light: {}, dark: {} },
};

export default defaultStyle;
