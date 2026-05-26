'use client';

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import { PANEL_LABELS, type WorkspacesPanelId } from '../../lib/workspaces/layoutSchema';
import { useWorkspacesLayout } from './WorkspacesLayoutContext';
import { PanelChevron } from './PanelChevron';

function SortablePanelRow({ id, children }: { id: WorkspacesPanelId; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const { layout, togglePanelCollapsed } = useWorkspacesLayout();
  const collapsed = !!layout.collapsed?.[id];
  const controlsId = `workspace-panel-${id}`;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div className="mb-1 flex items-center gap-1 rounded border border-app-border/80 bg-app-fill/80 px-1 py-0.5">
        <button
          type="button"
          className="cursor-grab touch-none rounded px-1 py-0.5 text-[10px] font-bold text-app-muted hover:bg-app-fill-hover active:cursor-grabbing"
          aria-label={`Drag to reorder ${PANEL_LABELS[id]}`}
          {...attributes}
          {...listeners}
        >
          ::
        </button>
        <span className="text-[9px] font-semibold uppercase tracking-wide text-app-muted">{PANEL_LABELS[id]}</span>
        <div className="flex-1" />
        <button
          type="button"
          className="flex items-center justify-center rounded px-1 py-0.5 text-app-muted hover:bg-app-fill-hover"
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${PANEL_LABELS[id]}`}
          aria-expanded={!collapsed}
          aria-controls={controlsId}
          onClick={() => togglePanelCollapsed(id)}
        >
          <PanelChevron expanded={!collapsed} />
        </button>
      </div>
      <div id={controlsId} className={collapsed ? 'hidden' : 'min-w-0'}>
        {children}
      </div>
    </div>
  );
}

export function WorkspacesSortablePanels({
  renderPanel,
}: {
  renderPanel: (id: WorkspacesPanelId) => ReactNode;
}) {
  const { layout, setLayout, visibleOrderedPanels } = useWorkspacesLayout();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const a = active.id as WorkspacesPanelId;
    const o = over.id as WorkspacesPanelId;
    const oldIndex = layout.order.indexOf(a);
    const newIndex = layout.order.indexOf(o);
    if (oldIndex < 0 || newIndex < 0) return;
    setLayout((prev) => ({
      ...prev,
      order: arrayMove(prev.order, oldIndex, newIndex),
    }));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={visibleOrderedPanels} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {visibleOrderedPanels.map((id) => (
            <SortablePanelRow key={id} id={id}>
              {renderPanel(id)}
            </SortablePanelRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
