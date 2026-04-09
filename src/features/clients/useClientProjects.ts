import { useState, useCallback, useRef } from "react";
import { api } from "../../lib/api";
import { useUIStore } from "../../store/useUIStore";
import { useT } from "../../i18n/context";
import { todayDateKey } from "../../lib/date-utils";

export interface ProjectRow {
  id: number;
  client_id: number;
  name: string;
  project_fee: number;
  project_start_date: string;
  project_end_date: string;
  status: string; // active | completed | cancelled
  tax_mode: string;
  tax_rate: number;
  note: string;
  sort_order: number;
  created_at?: string;
  [key: string]: unknown;
}

const EMPTY_PROJECT = {
  name: "",
  project_fee: "",
  project_start_date: todayDateKey(),
  project_end_date: "",
  status: "active" as string,
  tax_mode: "none" as "none" | "exclusive" | "inclusive",
  tax_rate: "",
  note: "",
};

export type ProjectForm = typeof EMPTY_PROJECT;

/**
 * Encapsulates all project state + CRUD for a client.
 * Follows the same pattern as useMilestones.
 */
export function useClientProjects() {
  const { t } = useT();
  const showToast = useUIStore((s) => s.showToast);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editProjectId, setEditProjectId] = useState<number | null>(null);
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT);
  const [saving, setSaving] = useState(false);
  const editProjectRef = useRef<ProjectRow | null>(null);

  const fetchProjects = useCallback(async (clientId: number) => {
    setLoading(true);
    try {
      const data = await api.get<ProjectRow[]>(`/api/clients/${clientId}/projects`);
      const list = Array.isArray(data) ? data : [];
      setProjects(list);
      // Auto-select: use functional updater to avoid stale closure
      setActiveProjectId(prev => {
        if (prev && list.find(p => p.id === prev)) return prev;
        const active = list.find(p => p.status === 'active');
        return active?.id ?? list[0]?.id ?? null;
      });
    } catch (e) {
      console.warn('[useClientProjects] fetch', e);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /** After project CRUD, sync sum of active project fees back to client row for KPI/list display */
  const syncClientFee = useCallback(async (clientId: number, projectList: ProjectRow[]) => {
    const total = projectList
      .filter(p => p.status === 'active')
      .reduce((s, p) => s + Number(p.project_fee || 0), 0);
    try { await api.put(`/api/clients/${clientId}`, { project_fee: total }); } catch { /* non-critical */ }
  }, []);

  const saveProject = useCallback(async (clientId: number, onDone?: () => void) => {
    if (saving) return;
    setSaving(true);
    const fee = parseFloat(projectForm.project_fee);
    const rate = parseFloat(projectForm.tax_rate);
    const payload = {
      name: projectForm.name || t("pipeline.projects.defaultName"),
      project_fee: isNaN(fee) ? 0 : fee,
      project_start_date: projectForm.project_start_date,
      project_end_date: projectForm.project_end_date,
      status: projectForm.status,
      tax_mode: projectForm.tax_mode,
      tax_rate: isNaN(rate) ? 0 : rate,
      note: projectForm.note,
    };
    try {
      if (editProjectId) {
        // Rule 13: only send changed fields to avoid stale-data overwrites
        const orig = editProjectRef.current;
        if (orig) {
          const patch: Record<string, unknown> = {};
          if (payload.name !== (orig.name || '')) patch.name = payload.name;
          if (payload.project_fee !== (orig.project_fee ?? 0)) patch.project_fee = payload.project_fee;
          if (payload.project_start_date !== (orig.project_start_date || '')) patch.project_start_date = payload.project_start_date;
          if (payload.project_end_date !== (orig.project_end_date || '')) patch.project_end_date = payload.project_end_date;
          if (payload.status !== (orig.status || 'active')) patch.status = payload.status;
          if (payload.tax_mode !== (orig.tax_mode || 'none')) patch.tax_mode = payload.tax_mode;
          if (payload.tax_rate !== (orig.tax_rate ?? 0)) patch.tax_rate = payload.tax_rate;
          if (payload.note !== (orig.note || '')) patch.note = payload.note;
          if (Object.keys(patch).length > 0) await api.put(`/api/projects/${editProjectId}`, patch);
        } else {
          await api.put(`/api/projects/${editProjectId}`, payload);
        }
        showToast(t("pipeline.projects.updated"));
      } else {
        const data = await api.post<{ id: number }>(`/api/clients/${clientId}/projects`, payload);
        if (data?.id) setActiveProjectId(data.id);
        showToast(t("pipeline.projects.created"));
      }
      setShowAddForm(false);
      setEditProjectId(null);
      editProjectRef.current = null;
      setProjectForm(EMPTY_PROJECT);
      const fresh = await api.get<ProjectRow[]>(`/api/clients/${clientId}/projects`);
      const list = Array.isArray(fresh) ? fresh : [];
      setProjects(list);
      setActiveProjectId(prev => {
        if (prev && list.find(p => p.id === prev)) return prev;
        const active = list.find(p => p.status === 'active');
        return active?.id ?? list[0]?.id ?? null;
      });
      syncClientFee(clientId, list);
      onDone?.();
    } catch (e) {
      console.warn('[useClientProjects] save', e);
      showToast(t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [saving, projectForm, editProjectId, syncClientFee, showToast, t]);

  const deleteProject = useCallback(async (projectId: number, clientId: number) => {
    try {
      await api.del(`/api/projects/${projectId}`);
      showToast(t("pipeline.projects.deleted"));
      if (activeProjectId === projectId) setActiveProjectId(null);
      const fresh = await api.get<ProjectRow[]>(`/api/clients/${clientId}/projects`);
      const list = Array.isArray(fresh) ? fresh : [];
      setProjects(list);
      setActiveProjectId(prev => {
        if (prev && prev !== projectId && list.find(p => p.id === prev)) return prev;
        const active = list.find(p => p.status === 'active');
        return active?.id ?? list[0]?.id ?? null;
      });
      syncClientFee(clientId, list);
    } catch (e) {
      console.warn('[useClientProjects] delete', e);
      showToast(t("common.deleteFailed"));
    }
  }, [activeProjectId, syncClientFee, showToast, t]);

  const openAddForm = useCallback(() => {
    setEditProjectId(null);
    setProjectForm(EMPTY_PROJECT);
    setShowAddForm(true);
  }, []);

  const openEditForm = useCallback((p: ProjectRow) => {
    setEditProjectId(p.id);
    editProjectRef.current = p;
    setProjectForm({
      name: p.name,
      project_fee: String(p.project_fee || ""),
      project_start_date: p.project_start_date || "",
      project_end_date: p.project_end_date || "",
      status: p.status || "active",
      tax_mode: (p.tax_mode || "none") as "none" | "exclusive" | "inclusive",
      tax_rate: String(p.tax_rate || ""),
      note: p.note || "",
    });
    setShowAddForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowAddForm(false);
    setEditProjectId(null);
    editProjectRef.current = null;
    setProjectForm(EMPTY_PROJECT);
  }, []);

  const resetState = useCallback(() => {
    setProjects([]);
    setActiveProjectId(null);
    setShowAddForm(false);
    setEditProjectId(null);
    editProjectRef.current = null;
    setProjectForm(EMPTY_PROJECT);
  }, []);

  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;

  return {
    projects, loading, activeProjectId, activeProject,
    showAddForm, editProjectId, projectForm, saving,
    setActiveProjectId, setProjectForm,
    fetchProjects, saveProject, deleteProject,
    openAddForm, openEditForm, closeForm, resetState,
  };
}
