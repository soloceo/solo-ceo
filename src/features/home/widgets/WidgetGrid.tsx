import React, { useState, useMemo, useCallback } from "react";
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, TouchSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Settings2, GripVertical } from "lucide-react";
import { useT } from "../../../i18n/context";
import { useWidgetStore } from "./useWidgetStore";
import { WIDGET_REGISTRY, WidgetWrapper, WidgetPreviewProvider } from "./WidgetRegistry";
import WidgetStore from "./WidgetStore";

function SortableWidget({ widget, editMode }: { widget: typeof WIDGET_REGISTRY[number] & { layoutIndex: number }; editMode: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id, disabled: !editMode });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    padding: 0,
  };

  return (
    <div ref={setNodeRef} {...attributes} className="relative group card overflow-hidden widget-card" style={style}>
      {editMode && (
        <div {...listeners} className="flex items-center justify-center mb-[-6px] relative cursor-grab" style={{ zIndex: 1, height: 14 }}>
          <div className="flex items-center justify-center rounded-full" style={{ width: 32, height: 14, background: "var(--color-bg-tertiary)", color: "var(--color-text-quaternary)" }}>
            <GripVertical size={10} />
          </div>
        </div>
      )}
      <div className="h-full">
        <WidgetPreviewProvider value={false}>
          <WidgetWrapper>
            <widget.component />
          </WidgetWrapper>
        </WidgetPreviewProvider>
      </div>
    </div>
  );
}

export default function WidgetGrid() {
  const { t } = useT();
  const { layout, reorder } = useWidgetStore();
  const [storeOpen, setStoreOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const enabledWidgets = useMemo(() =>
    layout
      .filter((w) => w.enabled)
      .sort((a, b) => a.order - b.order)
      .map((w) => {
        const def = WIDGET_REGISTRY.find((r) => r.id === w.id);
        return def ? { ...def, layoutIndex: layout.indexOf(w) } : null;
      })
      .filter(Boolean) as (typeof WIDGET_REGISTRY[number] & { layoutIndex: number })[],
  [layout]);

  const widgetIds = useMemo(() => enabledWidgets.map(w => w.id), [enabledWidgets]);

  const handleDragStart = useCallback((e: DragStartEvent) => setActiveId(e.active.id as string), []);
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const srcIdx = enabledWidgets.findIndex(w => w.id === active.id);
    const dstIdx = enabledWidgets.findIndex(w => w.id === over.id);
    if (srcIdx >= 0 && dstIdx >= 0) {
      reorder(enabledWidgets[srcIdx].layoutIndex, enabledWidgets[dstIdx].layoutIndex);
    }
  }, [enabledWidgets, reorder]);

  const activeWidget = activeId ? enabledWidgets.find(w => w.id === activeId) : null;

  if (enabledWidgets.length === 0) {
    return (
      <section>
        <button
          onClick={() => setStoreOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-5 rounded-[var(--radius-16)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
          style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)", border: "1.5px dashed var(--color-border-translucent)" } as React.CSSProperties}
        >
          <Plus size={14} />
          <span className="text-[12px]">{t("widgets.addWidget" as any)}</span>
        </button>
        <WidgetStore open={storeOpen} onClose={() => setStoreOpen(false)} />
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[12px]" style={{ color: "var(--color-text-quaternary)", fontWeight: "var(--font-weight-medium)" } as React.CSSProperties}>
          {t("widgets.title" as any)}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditMode((e) => !e)}
            className="flex items-center justify-center rounded-full transition-colors"
            style={{ width: 24, height: 24, color: editMode ? "var(--color-accent)" : "var(--color-text-quaternary)" }}
            aria-label="Edit layout"
          >
            <GripVertical size={12} />
          </button>
          <button
            onClick={() => setStoreOpen(true)}
            className="flex items-center justify-center rounded-full transition-colors hover:bg-[var(--color-bg-tertiary)]"
            style={{ width: 24, height: 24, color: "var(--color-text-quaternary)" }}
            aria-label="Manage widgets"
          >
            <Settings2 size={12} />
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={widgetIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4" style={{ gap: 8 }}>
            {enabledWidgets.map((widget) => (
              <SortableWidget key={widget.id} widget={widget} editMode={editMode} />
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.25, 1, 0.5, 1)" }}>
          {activeWidget ? (
            <div className="card overflow-hidden widget-card" style={{ opacity: 0.85, boxShadow: "var(--shadow-high)", padding: 0 }}>
              <div className="h-full">
                <WidgetPreviewProvider value={false}>
                  <WidgetWrapper>
                    <activeWidget.component />
                  </WidgetWrapper>
                </WidgetPreviewProvider>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <WidgetStore open={storeOpen} onClose={() => setStoreOpen(false)} />
    </section>
  );
}
