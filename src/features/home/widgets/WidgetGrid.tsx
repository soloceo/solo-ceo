import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Plus, Settings2, GripVertical } from "lucide-react";
import { useT } from "../../../i18n/context";
import { useWidgetStore } from "./useWidgetStore";
import { WIDGET_REGISTRY, WidgetWrapper, WidgetPreviewProvider } from "./WidgetRegistry";
import WidgetStore from "./WidgetStore";

export default function WidgetGrid() {
  const { t } = useT();
  const { layout, reorder } = useWidgetStore();
  const [storeOpen, setStoreOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const enabledWidgets = layout
    .filter((w) => w.enabled)
    .sort((a, b) => a.order - b.order)
    .map((w) => {
      const def = WIDGET_REGISTRY.find((r) => r.id === w.id);
      return def ? { ...def, layoutIndex: layout.indexOf(w) } : null;
    })
    .filter(Boolean) as (typeof WIDGET_REGISTRY[number] & { layoutIndex: number })[];

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const srcIdx = enabledWidgets[result.source.index]?.layoutIndex;
    const dstIdx = enabledWidgets[result.destination.index]?.layoutIndex;
    if (srcIdx !== undefined && dstIdx !== undefined) reorder(srcIdx, dstIdx);
  };

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

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="widgets">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              style={{ gap: 8 }}
            >
              {enabledWidgets.map((widget, index) => (
                <Draggable {...{ key: widget.id }} draggableId={widget.id} index={index} isDragDisabled={!editMode}>
                  {(dp, snap) => (
                    <div
                      ref={dp.innerRef}
                      {...dp.draggableProps}
                      className="relative group card overflow-hidden widget-card"
                      style={{
                        ...dp.draggableProps.style,
                        opacity: snap.isDragging ? 0.85 : 1,
                        padding: 0,
                      }}
                    >
                      {editMode && (
                        <div {...dp.dragHandleProps} className="flex items-center justify-center mb-[-6px] relative" style={{ zIndex: 1, height: 14 }}>
                          <div className="flex items-center justify-center rounded-full" style={{ width: 32, height: 14, background: "var(--color-bg-tertiary)", color: "var(--color-text-quaternary)" }}>
                            <GripVertical size={10} />
                          </div>
                        </div>
                      )}
                      {/* Widget content — directly interactive */}
                      <div className="h-full">
                        <WidgetPreviewProvider value={false}>
                          <WidgetWrapper>
                            <widget.component />
                          </WidgetWrapper>
                        </WidgetPreviewProvider>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <WidgetStore open={storeOpen} onClose={() => setStoreOpen(false)} />
    </section>
  );
}
