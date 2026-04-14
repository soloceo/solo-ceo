import type { ThemeDefinition, StyleDefinition } from './types';
import { defaultTheme } from './builtins/default';
import { oceanTheme } from './builtins/ocean';
import { roseTheme } from './builtins/rose';
import { forestTheme } from './builtins/forest';
import { midnightTheme } from './builtins/midnight';
import { monoTheme } from './builtins/mono';
import { carbonTheme } from './builtins/carbon';

/** Color palettes — order determines display order in the picker */
export const palettes: ThemeDefinition[] = [
  defaultTheme,
  oceanTheme,
  roseTheme,
  forestTheme,
  midnightTheme,
  monoTheme,
  carbonTheme,
];

/**
 * Visual styles — auto-discovered from ./styles/*.ts via import.meta.glob.
 * To add a new style: create a .ts file in ./styles/ with a default export.
 * To remove a style: delete the file. No registry edits needed.
 */
const styleModules = import.meta.glob<{ default: StyleDefinition }>(
  './styles/*.ts',
  { eager: true }
);

export const styles: StyleDefinition[] = Object.values(styleModules)
  .map((m) => m.default)
  .sort((a, b) => a.order - b.order);

const paletteMap = new Map(palettes.map((p) => [p.id, p]));
const styleMap = new Map(styles.map((s) => [s.id, s]));

/** Look up a palette by ID; returns defaultTheme if not found */
export function getPalette(id: string): ThemeDefinition {
  return paletteMap.get(id) ?? defaultTheme;
}

/** Look up a style by ID; returns defaultStyle if not found */
export function getStyle(id: string): StyleDefinition {
  return styleMap.get(id) ?? styles[0];
}

// ── Legacy compat: keep old exports for any remaining references ──
export const themes = palettes;
export function getTheme(id: string): ThemeDefinition {
  return getPalette(id);
}
