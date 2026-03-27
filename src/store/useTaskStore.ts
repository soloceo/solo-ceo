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
      const created = await res.json();
      set({ tasks: [created, ...get().tasks] });
      return created;
    } catch {
      return null;
    }
  },

  updateTask: async (id, updates) => {
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id, ...updates }),
      });
      set({
        tasks: get().tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      });
    } catch { /* handled by interceptor */ }
  },

  deleteTask: async (id) => {
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      set({ tasks: get().tasks.filter((t) => t.id !== id) });
    } catch { /* handled by interceptor */ }
  },

  moveTask: async (id, status) => {
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
      // Revert on error
      get().fetchTasks();
    }
  },
}));
