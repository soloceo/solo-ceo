import type { StyleDefinition } from '../types';

/**
 * Default style — Notion-inspired flat.
 * No overrides: all structural tokens come from tokens.css defaults.
 * Rounded corners, soft shadows, system fonts, no hover translate.
 */
export const defaultStyle: StyleDefinition = {
  id: 'default',
  nameKey: 'settings.style.default',
  descKey: 'settings.style.defaultDesc',
  overrides: { light: {}, dark: {} },
};
