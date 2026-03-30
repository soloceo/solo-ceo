import { create } from "zustand";

export interface Transaction {
  id: number;
  type: "income" | "expense";
  amount: number;
  category: string;
  description?: string;
  date: string;
  source: "manual" | "subscription" | "milestone" | "project_fee";
  source_id?: number;
  tax_mode?: "none" | "exclusive" | "inclusive";
  tax_rate?: number;
  tax_amount?: number;
  currency?: string;
  created_at?: string;
}

interface FinanceFilters {
  type?: "income" | "expense" | "all";
  month?: string;
  category?: string;
  search?: string;
}

interface FinanceState {
  transactions: Transaction[];
  filters: FinanceFilters;
  loading: boolean;
  error: string | null;

  fetchTransactions: () => Promise<void>;
  createTransaction: (tx: Partial<Transaction>) => Promise<Transaction | null>;
  updateTransaction: (id: number, updates: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: number) => Promise<void>;
  setFilters: (filters: Partial<FinanceFilters>) => void;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  transactions: [],
  filters: { type: "all" },
  loading: false,
  error: null,

  fetchTransactions: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/finance");
      const data = await res.json();
      set({ transactions: Array.isArray(data) ? data : [], loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  createTransaction: async (tx) => {
    try {
      const res = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...tx }),
      });
      if (!res.ok) return null;
      const created = await res.json();
      if (!created || created.error || !created.id) return null;
      set({ transactions: [created, ...get().transactions] });
      return created;
    } catch (err) { console.warn('[FinanceStore] createTransaction failed:', err); return null; }
  },

  updateTransaction: async (id, updates) => {
    try {
      await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id, ...updates }),
      });
      set({
        transactions: get().transactions.map((t) =>
          t.id === id ? { ...t, ...updates } : t,
        ),
      });
    } catch (err) { console.warn('[FinanceStore] updateTransaction failed:', err); }
  },

  deleteTransaction: async (id) => {
    try {
      await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      set({ transactions: get().transactions.filter((t) => t.id !== id) });
    } catch (err) { console.warn('[FinanceStore] deleteTransaction failed:', err); }
  },

  setFilters: (filters) =>
    set((s) => ({ filters: { ...s.filters, ...filters } })),
}));
