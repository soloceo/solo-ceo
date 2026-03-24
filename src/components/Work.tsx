import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Plus, Clock, Sparkles, Loader2, X, Filter, Check, Edit2, Trash2,
  LayoutGrid, AlignJustify, GripVertical, ChevronDown, PanelRightClose,
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { motion, AnimatePresence } from "motion/react";
import { useT } from '../i18n/context';
import { useRealtimeRefresh } from "../hooks/useRealtimeRefresh";
import { useIsMobile } from "../hooks/useIsMobile";
import { useToast } from "../hooks/useToast";

/* ── Helpers ────────────────────────────────────────────────────── */
const getAI = () => {
  const key = localStorage.getItem("GEMINI_API_KEY") || import.meta.env.VITE_GEMINI_API_KEY;
  return new GoogleGenAI({ apiKey: key });
};

const cleanAI = (t: string) =>
  (t || "").replace(/```[\s\S]*?```/g, m => m.replace(/```/g, ""))
    .replace(/^#{1,6}\s*/gm, "").replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n").trim();

type TaskMap = Record<string, any[]>;

/* ── Main ───────────────────────────────────────────────────────── */
export default function Work() {
  const { t, lang } = useT();

  const COLS = useMemo(() => [
    { id: "todo", title: t("work.col.todo" as any), color: "var(--text-secondary)" },
    { id: "inProgress", title: t("work.col.inProgress" as any), color: "var(--accent)" },
    { id: "review", title: t("work.col.review" as any), color: "var(--warning)" },
    { id: "done", title: t("work.col.done" as any), color: "var(--success)" },
  ], [t]);

  const [tasks, setTasks] = useState<TaskMap>({ todo: [], inProgress: [], review: [], done: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [filterPriority, setFilterPriority] = useState("All");
  const [toast, showToast] = useToast();
  const [editId, setEditId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"vertical" | "horizontal">(() =>
    (localStorage.getItem("tasks_view_mode") as any) || "vertical",
  );
  const isMobile = useIsMobile();

  // AI planner
  const [projectType, setProjectType] = useState("brand-identity");
  const [complexity, setComplexity] = useState("medium");
  const [requirements, setRequirements] = useState("");
  const [aiPlan, setAiPlan] = useState("");
  const [planLoading, setPlanLoading] = useState(false);

  // Task form
  const emptyTask = { title: "", client: "", priority: "Medium", due: "", column: "todo", originalRequest: "", aiBreakdown: "", aiMjPrompts: "", aiStory: "" };
  const [form, setForm] = useState(emptyTask);
  const [activeTab, setActiveTab] = useState("breakdown");
  const [generating, setGenerating] = useState<string | null>(null);
  const [clientList, setClientList] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/clients").then(r => r.json()).then(d => setClientList(d.filter((c: any) => !c.soft_deleted))).catch(() => {});
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks({
        todo: data.filter((t: any) => t.column === "todo"),
        inProgress: data.filter((t: any) => t.column === "inProgress"),
        review: data.filter((t: any) => t.column === "review"),
        done: data.filter((t: any) => t.column === "done"),
      });
    } catch { showToast(t("work.loadFailed" as any)); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, []);
  useRealtimeRefresh(['tasks'], fetchTasks);

  useEffect(() => {
    const showFullscreen = isMobile && (showPanel || showAIModal);
    window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: showFullscreen } }));
    return () => { window.dispatchEvent(new CustomEvent("mobile-nav-visibility", { detail: { hidden: false } })); };
  }, [showPanel, showAIModal, isMobile]);

  /* ── Drag & Drop ── */
  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const { source: s, destination: d } = result;
    if (s.droppableId !== d.droppableId) {
      const src = [...tasks[s.droppableId]];
      const dst = [...tasks[d.droppableId]];
      const [moved] = src.splice(s.index, 1);
      moved.column = d.droppableId;
      dst.splice(d.index, 0, moved);
      setTasks({ ...tasks, [s.droppableId]: src, [d.droppableId]: dst });
      try {
        await fetch(`/api/tasks/${moved.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(moved) });
      } catch { showToast(t("common.updateFailed" as any)); fetchTasks(); }
    } else {
      const col = [...tasks[s.droppableId]];
      const [moved] = col.splice(s.index, 1);
      col.splice(d.index, 0, moved);
      setTasks({ ...tasks, [s.droppableId]: col });
    }
  };

  /* ── Task CRUD ── */
  const openPanel = (task: any = null, col = "todo") => {
    if (task) {
      setEditId(task.id);
      setForm({ title: task.title, client: task.client, priority: task.priority, due: task.due || "", column: task.column || col, originalRequest: task.originalRequest || "", aiBreakdown: task.aiBreakdown || "", aiMjPrompts: task.aiMjPrompts || "", aiStory: task.aiStory || "" });
    } else {
      setEditId(null);
      setForm({ ...emptyTask, column: col });
    }
    setActiveTab("breakdown");
    setShowPanel(true);
  };

  const saveTask = async (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      if (editId) {
        await fetch(`/api/tasks/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        showToast(t("work.taskUpdated" as any));
      } else {
        await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        showToast(t("work.taskAdded" as any));
      }
      setShowPanel(false);
      fetchTasks();
    } catch { showToast(t("common.saveFailed" as any)); }
  };

  const deleteTask = async (id: number) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      setShowPanel(false);
      showToast(t("work.taskDeleted" as any));
      fetchTasks();
    } catch { showToast(t("common.deleteFailed" as any)); }
  };

  /* ── AI Generate ── */
  const generateAI = async (type: "breakdown" | "mj" | "story") => {
    if (!form.originalRequest.trim()) { showToast(t("work.ai.needRequest" as any)); return; }
    setGenerating(type);
    setActiveTab(type);
    try {
      const ai = getAI();
      const prompts: Record<string, string> = {
        breakdown: `作为资深设计项目经理，请根据以下客户的原始需求，拆解出具体的任务清单和执行步骤。\n客户名称：${form.client || "未知客户"}\n原始需求：${form.originalRequest}\n\n请直接输出可执行任务拆解，不要用 Markdown 符号。包含：核心目标、阶段划分、任务清单（动作、优先级、预计工时、交付物）、下一步建议。`,
        mj: `作为Midjourney提示词专家，请根据以下客户需求，生成3个高质量英文图像生成提示词。\n客户名称：${form.client || "未知客户"}\n原始需求：${form.originalRequest}\n\n每条包含：主体描述、环境/光线、艺术风格、构图、镜头/材质。直接输出3条可复制的英文提示词。`,
        story: `作为资深品牌策略师，请根据以下客户需求，撰写一段品牌故事/设计理念阐述（约150-220字），专业、克制、有画面感。\n客户名称：${form.client || "未知客户"}\n原始需求：${form.originalRequest}`,
      };
      const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompts[type] });
      const text = cleanAI(res.text || t("work.ai.genFailed" as any));
      setForm(p => ({ ...p, [type === "breakdown" ? "aiBreakdown" : type === "mj" ? "aiMjPrompts" : "aiStory"]: text }));
      showToast(t("work.ai.done" as any));
    } catch { showToast(t("work.ai.genFailed" as any)); }
    finally { setGenerating(null); }
  };

  const generatePlan = async () => {
    if (!requirements.trim()) return;
    setPlanLoading(true);
    setAiPlan("");
    try {
      const ai = getAI();
      const typeMap: Record<string, string> = { "brand-identity": "品牌视觉识别系统", website: "网站设计", marketing: "营销物料设计" };
      const compMap: Record<string, string> = { high: "高", medium: "中等", low: "低" };
      const prompt = `作为资深项目经理，请为以下设计项目生成结构化的项目计划。\n项目类型：${typeMap[projectType]}\n复杂度：${compMap[complexity]}\n客户要求：${requirements}\n\n请直接输出可执行版本，包含：项目目标、里程碑、任务清单（优先级、工时、负责人）、资源建议、风险预警。`;
      const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
      setAiPlan(res.text || t("work.ai.genFailed" as any));
    } catch { setAiPlan(t("work.planner.error" as any)); }
    finally { setPlanLoading(false); }
  };

  const applyFilter = (items: any[]) => filterPriority === "All" ? items : items.filter((t: any) => t.priority === filterPriority);

  return (
    <div className="mobile-page max-w-[1680px] mx-auto min-h-full flex flex-col px-4 py-3 md:px-6 md:py-4 lg:px-8 lg:py-5 relative">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 px-4 py-2 rounded-lg z-[9999] flex items-center gap-2 text-[13px] font-medium" style={{ background: "var(--text)", color: "var(--bg)", boxShadow: "var(--shadow-lg)" }}>
          <Check size={16} style={{ color: "var(--success)" }} /> {toast}
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
        <h1 className="page-title">{t("work.pageTitle" as any)}</h1>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1.5">
            <Filter size={16} style={{ color: "var(--text-secondary)" }} />
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="input-base px-2 py-1 text-[13px]">
              <option value="All">{t("work.filter.all" as any)}</option>
              <option value="High">{t("work.filter.high" as any)}</option><option value="Medium">{t("work.filter.medium" as any)}</option><option value="Low">{t("work.filter.low" as any)}</option>
            </select>
          </div>
          <div className="segment-switcher">
            {([["vertical", <LayoutGrid size={16} />, t("work.view.board" as any)], ["horizontal", <AlignJustify size={16} />, t("work.view.swimlane" as any)]] as [string, React.ReactNode, string][]).map(([mode, icon, label]) => (
              <button key={mode} onClick={() => { setViewMode(mode as any); localStorage.setItem("tasks_view_mode", mode as string); }}
                data-active={viewMode === mode}>
                {icon}
              </button>
            ))}
          </div>
          <button onClick={() => setShowAIModal(true)} className="btn-ghost text-[13px]"><Sparkles size={16} /> {t("work.aiPlan" as any)}</button>
          <button onClick={() => openPanel(null, "todo")} className="btn-primary text-[13px]"><Plus size={16} /> {t("work.new" as any)}</button>
        </div>
      </header>

      {/* Board */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : viewMode === "vertical" ? (
        <div className="flex-1 overflow-x-auto overflow-y-hidden ios-scroll pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
          <div className="flex h-full gap-3 min-w-max">
            <DragDropContext onDragEnd={onDragEnd}>
              {COLS.map(col => (
                <Column key={col.id} col={col} items={applyFilter(tasks[col.id])} onAdd={() => openPanel(null, col.id)} onEdit={(t: any) => openPanel(t, t.column || col.id)} onDelete={deleteTask} emptyText={t("work.empty" as any)} />
              ))}
            </DragDropContext>
          </div>
        </div>
      ) : (
        <SwimlaneView cols={COLS} tasks={tasks} filter={filterPriority} onAdd={openPanel} onEdit={openPanel} onDelete={deleteTask} emptyText={t("work.empty" as any)} onMove={async (id: number, col: string) => {
          try { await fetch(`/api/tasks/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ column: col }) }); fetchTasks(); } catch { showToast(t("work.moveFailed" as any)); }
        }} />
      )}

      {/* ═══ Task Side Panel (desktop) / Fullscreen (mobile) ═══ */}
      <AnimatePresence>
        {showPanel && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40"
              className="modal-backdrop"
              onClick={() => setShowPanel(false)}
            />
            {/* Panel */}
            <motion.div
              initial={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              animate={{ x: 0, y: 0 }}
              exit={{ x: isMobile ? 0 : "100%", y: isMobile ? "100%" : 0 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              className={isMobile
                ? "fixed inset-0 z-50 flex flex-col"
                : "fixed top-0 right-0 z-50 h-full w-full max-w-[440px] lg:max-w-[520px] flex flex-col border-l"
              }
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-lg)",
                paddingTop: isMobile ? "env(safe-area-inset-top, 0px)" : undefined,
              }}
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                    {editId ? <Edit2 size={16} /> : <Plus size={16} />}
                  </div>
                  <span className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                    {editId ? t("work.panel.edit" as any) : t("work.panel.new" as any)}
                  </span>
                </div>
                <button onClick={() => setShowPanel(false)} className="btn-ghost p-1">
                  {isMobile ? <X size={16} /> : <PanelRightClose size={16} />}
                </button>
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto ios-scroll">
                <div className="p-5 space-y-3">
                  {/* Core fields */}
                  <div className="space-y-3">
                    <FL label={t("work.form.title" as any)}>
                      <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder={t("work.form.titlePlaceholder" as any)} className="input-base w-full px-3 py-2 text-[13px]" />
                    </FL>
                    <div className="grid grid-cols-2 gap-3">
                      <FL label={t("work.form.client" as any)}>
                        <select value={form.client} onChange={e => setForm(p => ({ ...p, client: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]">
                          <option value="">{t("work.form.clientNone" as any)}</option>
                          {clientList.map((c: any) => <option key={c.id} value={c.company_name || c.name}>{c.company_name || c.name}</option>)}
                        </select>
                      </FL>
                      <FL label={t("work.form.due" as any)}>
                        <input type="date" value={form.due} onChange={e => setForm(p => ({ ...p, due: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]" />
                      </FL>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FL label={t("work.form.priority" as any)}>
                        <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]">
                          <option value="High">{t("work.filter.high" as any)}</option><option value="Medium">{t("work.filter.medium" as any)}</option><option value="Low">{t("work.filter.low" as any)}</option>
                        </select>
                      </FL>
                      <FL label={t("work.form.status" as any)}>
                        <select value={form.column} onChange={e => setForm(p => ({ ...p, column: e.target.value }))} className="input-base w-full px-3 py-2 text-[13px]">
                          {COLS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                      </FL>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t" style={{ borderColor: "var(--border)" }} />

                  {/* Client request */}
                  <FL label={t("work.form.request" as any)}>
                    <textarea value={form.originalRequest} onChange={e => setForm(p => ({ ...p, originalRequest: e.target.value }))} placeholder={t("work.form.requestPlaceholder" as any)} className="input-base w-full h-20 px-3 py-2 text-[13px] resize-none" />
                  </FL>

                  {/* AI chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {([["breakdown", t("work.ai.breakdown" as any)], ["mj", t("work.ai.mjPrompt" as any)], ["story", t("work.ai.brandStory" as any)]] as const).map(([key, label]) => (
                      <button key={key} type="button" onClick={() => generateAI(key as any)} disabled={generating !== null}
                        className="inline-flex items-center gap-1 py-1 px-3 rounded-md text-[11px] font-medium transition-all disabled:opacity-50"
                        style={{ border: "1px solid var(--border)", color: "var(--accent)", background: "var(--surface)" }}>
                        {generating === key ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {label}
                      </button>
                    ))}
                  </div>

                  {/* AI output tabs — only show if any AI content exists */}
                  {(form.aiBreakdown || form.aiMjPrompts || form.aiStory || generating) && (
                    <div>
                      <div className="flex gap-1 mb-2">
                        {([["breakdown", t("work.ai.tab.breakdown" as any)], ["mj", t("work.ai.tab.mj" as any)], ["story", t("work.ai.tab.story" as any)]] as const).map(([k, l]) => {
                          const hasContent = k === "breakdown" ? form.aiBreakdown : k === "mj" ? form.aiMjPrompts : form.aiStory;
                          return (
                            <button key={k} type="button" onClick={() => setActiveTab(k)}
                              className="px-3 py-1 text-[11px] font-medium rounded-md transition-colors"
                              style={activeTab === k ? { background: "var(--surface-alt)", color: "var(--text)" } : { color: hasContent ? "var(--text-secondary)" : "var(--text-tertiary)" }}>
                              {l}{hasContent ? " ●" : ""}
                            </button>
                          );
                        })}
                      </div>
                      <textarea
                        value={activeTab === "breakdown" ? form.aiBreakdown : activeTab === "mj" ? form.aiMjPrompts : form.aiStory}
                        onChange={e => {
                          const field = activeTab === "breakdown" ? "aiBreakdown" : activeTab === "mj" ? "aiMjPrompts" : "aiStory";
                          setForm(p => ({ ...p, [field]: e.target.value }));
                        }}
                        placeholder={t("work.ai.placeholder" as any)}
                        className="input-base w-full px-3 py-2 text-[13px] resize-y"
                        style={{ minHeight: 80, maxHeight: 300 }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Panel footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t pb-safe" style={{ borderColor: "var(--border)" }}>
                {editId ? (
                  <button type="button" onClick={() => deleteTask(editId)} className="btn-ghost text-[13px]" style={{ color: "var(--danger)" }}>
                    <Trash2 size={16} /> {t("common.delete" as any)}
                  </button>
                ) : <div />}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowPanel(false)} className="btn-secondary text-[13px]">{t("common.cancel" as any)}</button>
                  <button type="button" onClick={() => saveTask()} className="btn-primary text-[13px]">{editId ? t("common.save" as any) : t("common.create" as any)}</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* AI Planner Modal */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg)", paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: "var(--accent-light)", color: "var(--accent)" }}><Sparkles size={16} /></div>
              <span className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{t("work.planner.title" as any)}</span>
            </div>
            <button onClick={() => setShowAIModal(false)} className="btn-ghost p-1"><X size={16} /></button>
          </div>
          <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
            <div className="w-full md:w-1/3 p-5 border-b md:border-b-0 md:border-r space-y-4 md:overflow-y-auto" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <FL label={t("work.planner.type" as any)}>
                <select value={projectType} onChange={e => setProjectType(e.target.value)} className="input-base w-full px-3 py-2 text-[13px]">
                  <option value="brand-identity">{t("work.planner.type.brand" as any)}</option><option value="website">{t("work.planner.type.website" as any)}</option><option value="marketing">{t("work.planner.type.marketing" as any)}</option>
                </select>
              </FL>
              <FL label={t("work.planner.complexity" as any)}>
                <select value={complexity} onChange={e => setComplexity(e.target.value)} className="input-base w-full px-3 py-2 text-[13px]">
                  <option value="high">{t("work.filter.high" as any)}</option><option value="medium">{t("work.filter.medium" as any)}</option><option value="low">{t("work.filter.low" as any)}</option>
                </select>
              </FL>
              <FL label={t("work.planner.requirements" as any)}>
                <textarea value={requirements} onChange={e => setRequirements(e.target.value)} placeholder={t("work.planner.requirementsPlaceholder" as any)} className="input-base w-full h-28 px-3 py-2 text-[13px] resize-none" />
              </FL>
              <button onClick={generatePlan} disabled={planLoading || !requirements.trim()} className="btn-primary w-full text-[13px] disabled:opacity-50">
                {planLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {planLoading ? t("work.planner.generating" as any) : t("work.planner.generate" as any)}
              </button>
            </div>
            <div className="w-full md:w-2/3 p-5 overflow-y-auto pb-safe ios-scroll" style={{ background: "var(--bg)" }}>
              {aiPlan ? (
                <div className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>{aiPlan}</div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-2" style={{ color: "var(--text-secondary)" }}>
                  <Sparkles size={24} className="opacity-30" />
                  <p className="text-[13px]">{t("work.planner.hint" as any)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────── */

function FL({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`flex flex-col gap-1 ${className || ""}`}><span className="section-label">{label}</span>{children}</label>;
}

function Column({ col, items, onAdd, onEdit, onDelete, emptyText }: { col: { id: string; title: string; color: string }; items: any[]; onAdd: () => void; onEdit: (t: any) => void; onDelete: (id: number) => void; emptyText: string }) {
  return (
    <div className="flex flex-col w-[260px] md:w-[280px] shrink-0 h-full">
      {/* Column header with color bar */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: col.color }} />
          <h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{col.title}</h3>
          <span className="text-[11px] font-medium tabular-nums" style={{ color: "var(--text-secondary)" }}>{items.length}</span>
        </div>
        <button onClick={onAdd} className="btn-ghost p-0.5"><Plus size={16} /></button>
      </div>
      <Droppable droppableId={col.id}>
        {(provided, snapshot) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="flex flex-col flex-1 min-h-0 rounded-xl overflow-hidden"
            style={{
              background: snapshot.isDraggingOver ? "var(--accent-light)" : "var(--surface-alt)",
              borderTop: `2px solid ${col.color}`,
              transition: "background 0.15s",
            }}
          >
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 ios-scroll">
              {!items.length && <div className="py-8 text-center text-[11px]" style={{ color: "var(--text-secondary)" }}>{emptyText}</div>}
              {items.map((task: any, i: number) => (
                // @ts-expect-error React 19 type issue with Draggable
                <Draggable key={task.id.toString()} draggableId={task.id.toString()} index={i}>
                  {(prov: any, snap: any) => <TaskCard task={task} provided={prov} snapshot={snap} onEdit={onEdit} onDelete={onDelete} />}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          </div>
        )}
      </Droppable>
    </div>
  );
}

function TaskCard({ task, provided, snapshot, onEdit, onDelete }: any) {
  const hasAI = Boolean(task.aiBreakdown || task.aiMjPrompts || task.aiStory);
  const prioColor = task.priority === "High" ? "var(--danger)" : task.priority === "Medium" ? "var(--warning)" : "var(--success)";
  const card = (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      style={{ ...provided.draggableProps.style, touchAction: "none" } as React.CSSProperties}
      onClick={() => onEdit(task)}
      className={`group card-interactive cursor-pointer p-3 ${snapshot.isDragging ? "rotate-[2deg] scale-[1.02] !shadow-lg z-[9999]" : ""}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <GripVertical size={16} className="shrink-0 lg:hidden" style={{ color: "var(--text-secondary)", opacity: 0.5 }} />
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: prioColor }} />
        <h4 className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>{task.title}</h4>
      </div>
      {task.client && <p className="text-[11px] mb-1 pl-3.5" style={{ color: "var(--text-secondary)" }}>{task.client}</p>}
      <div className="flex items-center justify-between pl-3.5 mt-1.5">
        <div className="flex items-center gap-1">
          {task.due && (() => {
            const today = new Date().toISOString().split("T")[0];
            const isOverdue = task.due < today;
            const isToday = task.due === today;
            const dueSt = isOverdue ? { background: "var(--danger-light)", color: "var(--danger)" } : isToday ? { background: "var(--warning-light)", color: "var(--warning)" } : undefined;
            return <span className="badge text-[11px]" style={dueSt}><Clock size={16} /> {task.due}</span>;
          })()}
          {hasAI && <span className="badge text-[11px]" style={{ background: "var(--accent-light)", color: "var(--accent)" }}><Sparkles size={16} /></span>}
        </div>
        <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); onDelete(task.id); }} className="p-0.5 rounded" style={{ color: "var(--text-secondary)" }} aria-label="Delete"><Trash2 size={16} /></button>
        </div>
      </div>
    </div>
  );
  return snapshot.isDragging ? createPortal(card, document.body) : card;
}

function SwimlaneView({ cols, tasks, filter, onAdd, onEdit, onDelete, onMove, emptyText }: any) {
  const applyFilter = (items: any[]) => filter === "All" ? items : items.filter((t: any) => t.priority === filter);
  return (
    <div className="flex-1 overflow-y-auto ios-scroll space-y-2 pb-4">
      {cols.map((col: any) => {
        const items = applyFilter(tasks[col.id] || []);
        return (
          <div key={col.id} className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "var(--border)", borderTop: `2px solid ${col.color}` }}>
              <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{col.title}</h3>
                <span className="text-[11px] font-medium tabular-nums" style={{ color: "var(--text-secondary)" }}>{items.length}</span>
              </div>
              <button onClick={() => onAdd(null, col.id)} className="btn-ghost p-0.5"><Plus size={16} /></button>
            </div>
            {!items.length ? (
              <div className="px-4 py-4 text-[13px] text-center" style={{ color: "var(--text-secondary)" }}>{emptyText}</div>
            ) : (
              <div className="overflow-x-auto ios-scroll">
                <div className="flex gap-2 p-3 min-w-max">
                  {items.map((task: any) => (
                    <div key={task.id} onClick={() => onEdit(task, task.column || col.id)}
                      className="w-[200px] shrink-0 cursor-pointer card-interactive p-3 group">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: task.priority === "High" ? "var(--danger)" : task.priority === "Medium" ? "var(--warning)" : "var(--success)" }} />
                        <h4 className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>{task.title}</h4>
                      </div>
                      {task.client && <p className="text-[11px] truncate mb-1 pl-3" style={{ color: "var(--text-secondary)" }}>{task.client}</p>}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t" style={{ borderColor: "var(--border)" }} onClick={e => e.stopPropagation()}>
                        <select value={col.id} onChange={e => onMove(task.id, e.target.value)}
                          className="appearance-none text-[11px] font-medium pl-2 pr-4 py-0.5 rounded-md cursor-pointer input-base">
                          {cols.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                        <button onClick={() => onDelete(task.id)} className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-secondary)" }}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
