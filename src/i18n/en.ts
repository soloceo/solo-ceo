import type zh from "./zh";
import { common } from "./en/common";
import { home } from "./en/home";
import { work } from "./en/work";
import { clients } from "./en/clients";
import { finance } from "./en/finance";
import { settings } from "./en/settings";

const en: typeof zh = {
  ...common,
  ...home,
  ...work,
  ...clients,
  ...finance,
  ...settings,
} as const;

export default en;
