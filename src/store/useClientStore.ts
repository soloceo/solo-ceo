import { create } from "zustand";

export interface Lead {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  stage: string;
  source?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Client {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  billing_type?: "subscription" | "project";
  payment_method?: "auto" | "manual";
  status?: string;
  plan_name?: string;
  monthly_fee?: number;
  project_fee?: number;
  currency?: string;
  tax_mode?: "none" | "exclusive" | "inclusive";
  tax_rate?: number;
  subscription_timeline?: string;
  notes?: string;
  contact_notes?: string;
  start_date?: string;
  created_at?: string;
  updated_at?: string;
}

interface ClientState {
  leads: Lead[];
  clients: Client[];
  selectedClientId: number | null;
  loading: boolean;
  error: string | null;

  fetchLeads: () => Promise<void>;
  fetchClients: () => Promise<void>;
  selectClient: (id: number | null) => void;
  createLead: (lead: Partial<Lead>) => Promise<Lead | null>;
  updateLead: (id: number, updates: Partial<Lead>) => Promise<void>;
  deleteLead: (id: number) => Promise<void>;
  createClient: (client: Partial<Client>) => Promise<Client | null>;
  updateClient: (id: number, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: number) => Promise<void>;
}

export const useClientStore = create<ClientState>((set, get) => ({
  leads: [],
  clients: [],
  selectedClientId: null,
  loading: false,
  error: null,

  fetchLeads: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/leads");
      const data = await res.json();
      set({ leads: Array.isArray(data) ? data : [], loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  fetchClients: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/clients");
      const data = await res.json();
      set({ clients: Array.isArray(data) ? data : [], loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  selectClient: (id) => set({ selectedClientId: id }),

  createLead: async (lead) => {
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...lead }),
      });
      if (!res.ok) return null;
      const created = await res.json();
      if (!created || created.error || !created.id) return null;
      set({ leads: [created, ...get().leads] });
      return created;
    } catch { return null; }
  },

  updateLead: async (id, updates) => {
    const prev = get().leads;
    set({ leads: prev.map((l) => (l.id === id ? { ...l, ...updates } : l)) });
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id, ...updates }),
      });
      if (!res.ok) set({ leads: prev });
    } catch (err) { set({ leads: prev }); }
  },

  deleteLead: async (id) => {
    const prev = get().leads;
    set({ leads: prev.filter((l) => l.id !== id) });
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (!res.ok) set({ leads: prev });
    } catch (err) { set({ leads: prev }); }
  },

  createClient: async (client) => {
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...client }),
      });
      if (!res.ok) return null;
      const created = await res.json();
      if (!created || created.error || !created.id) return null;
      set({ clients: [created, ...get().clients] });
      return created;
    } catch { return null; }
  },

  updateClient: async (id, updates) => {
    const prev = get().clients;
    set({ clients: prev.map((c) => (c.id === id ? { ...c, ...updates } : c)) });
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id, ...updates }),
      });
      if (!res.ok) set({ clients: prev });
    } catch (err) { set({ clients: prev }); }
  },

  deleteClient: async (id) => {
    const prev = get().clients;
    set({ clients: prev.filter((c) => c.id !== id) });
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (!res.ok) set({ clients: prev });
    } catch (err) { set({ clients: prev }); }
  },
}));
