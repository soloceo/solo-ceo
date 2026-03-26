import { common } from "./zh/common";
import { home } from "./zh/home";
import { work } from "./zh/work";
import { clients } from "./zh/clients";
import { finance } from "./zh/finance";
import { settings } from "./zh/settings";

const zh = {
  ...common,
  ...home,
  ...work,
  ...clients,
  ...finance,
  ...settings,
} as const;

export default zh;
