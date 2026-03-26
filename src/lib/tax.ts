/**
 * Shared tax calculation utilities.
 * Used by Finance, ClientList, and API layers.
 */

export const calcTaxAmount = (amount: number, mode: string, rate: number): number => {
  if (mode === "none" || !rate) return 0;
  if (mode === "exclusive") return Math.round((amount * rate) / 100 * 100) / 100;
  if (mode === "inclusive") return Math.round((amount * rate) / (100 + rate) * 100) / 100;
  return 0;
};

export const CATEGORY_I18N: Record<string, string> = {
  "收入": "money.cat.income",
  "软件支出": "money.cat.software",
  "外包支出": "money.cat.outsource",
  "应收": "money.cat.receivable",
  "应付": "money.cat.payable",
  "其他支出": "money.cat.other",
  "项目收入": "money.category.projectIncome",
};

export const STATUS_I18N: Record<string, string> = {
  "已完成": "money.st.completed",
  "待收款 (应收)": "money.st.receivable",
  "待支付 (应付)": "money.st.payable",
};

export const catLabel = (cat: string, t: (k: any) => string) => {
  const key = CATEGORY_I18N[cat];
  return key ? t(key as any) : cat;
};
