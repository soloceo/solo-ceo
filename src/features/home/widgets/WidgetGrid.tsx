import React, { useState, useMemo, useCallback } from "react";
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, TouchSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useWidgetStore } from "./useWidgetStore";
import { WIDGET_REGISTRY, WidgetWrapper, WidgetPreviewProvider } from "./WidgetRegistry";

function SortableWidget({ widget }: { widget: typeof WIDGET_REGISTRY[number] & { layoutIndex: number } }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    padding: 0,
  };

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className="relative group card overflow-hidden widget-card touch-manipulation" style={style}>
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
  const { layout, reorder } = useWidgetStore();
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

  if (enabledWidgets.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={widgetIds} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4" style={{ gap: 8 }}>
          {enabledWidgets.map((widget) => (
            <SortableWidget key={widget.id} widget={widget} />
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
  );
}
