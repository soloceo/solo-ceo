import type { ThemeDefinition, StyleDefinition } from './types';
import { defaultTheme } from './builtins/default';
import { oceanTheme } from './builtins/ocean';
import { roseTheme } from './builtins/rose';
import { forestTheme } from './builtins/forest';
import { midnightTheme } from './builtins/midnight';
import { monoTheme } from './builtins/mono';
import { defaultStyle } from './styles/default';
import { neobrutalismStyle } from './styles/neobrutalism';
import { glassmorphismStyle } from './styles/glassmorphism';
import { hudStyle } from './styles/hud';

/** Color palettes — order determines display order in the picker */
export const palettes: ThemeDefinition[] = [
  defaultTheme,
  oceanTheme,
  roseTheme,
  forestTheme,
  midnightTheme,
  monoTheme,
];

/** Visual styles — order determines display order in the picker */
export const styles: StyleDefinition[] = [
  defaultStyle,
  neobrutalismStyle,
  glassmorphismStyle,
  hudStyle,
];

const paletteMap = new Map(palettes.map((p) => [p.id, p]));
const styleMap = new Map(styles.map((s) => [s.id, s]));

/** Look up a palette by ID; returns defaultTheme if not found */
export function getPalette(id: string): ThemeDefinition {
  return paletteMap.get(id) ?? defaultTheme;
}

/** Look up a style by ID; returns defaultStyle if not found */
export function getStyle(id: string): StyleDefinition {
  return styleMap.get(id) ?? defaultStyle;
}

// ── Legacy compat: keep old exports for any remaining references ──
export const themes = palettes;
export function getTheme(id: string): ThemeDefinition {
  return getPalette(id);
}
