import { create } from "zustand";

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: "todo" | "inProgress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  due_date?: string;
  tags?: string;
  created_at?: string;
  updated_at?: string;
}

interface TaskState {
  tasks: Task[];
  loading: boolean;
  error: string | null;

  fetchTasks: () => Promise<void>;
  createTask: (task: Partial<Task>) => Promise<Task | null>;
  updateTask: (id: number, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  moveTask: (id: number, status: Task["status"]) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,

  fetchTasks: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      set({ tasks: Array.isArray(data) ? data : [], loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  createTask: async (task) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...task }),
      });
      if (!res.ok) return null;
      const created = await res.json();
      if (!created || created.error || !created.id) return null;
      set({ tasks: [created, ...get().tasks] });
      return created;
    } catch { return null; }
  },

  updateTask: async (id, updates) => {
    const prev = get().tasks;
    set({ tasks: prev.map((t) => (t.id === id ? { ...t, ...updates } : t)) });
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id, ...updates }),
      });
      if (!res.ok) set({ tasks: prev });
    } catch (err) { set({ tasks: prev }); }
  },

  deleteTask: async (id) => {
    const prev = get().tasks;
    set({ tasks: prev.filter((t) => t.id !== id) });
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (!res.ok) set({ tasks: prev });
    } catch (err) { set({ tasks: prev }); }
  },

  moveTask: async (id, status) => {
    const previousTasks = get().tasks;
    // Optimistic update
    set({
      tasks: get().tasks.map((t) => (t.id === id ? { ...t, status } : t)),
    });
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id, status }),
      });
    } catch {
      set({ tasks: previousTasks });
    }
  },
}));
