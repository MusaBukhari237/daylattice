import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { useStore } from "@/store/useStore";
import { Input } from "../common";
import { sectionAccent } from "@/lib/utils";
import type { Label, Section, Task } from "@/lib/types";

interface Props {
  sections: Section[];
  tasks: Task[];
  labels: Label[];
}

export function KanbanBoard({ sections, tasks, labels }: Props) {
  const { moveTask, createSection } = useStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [columnName, setColumnName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const bySection = (sectionId: string) =>
    tasks
      .filter((t) => t.section_id === sectionId)
      .sort((a, b) => a.position - b.position);

  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  const onDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeTaskId = active.id as string;
    const overId = over.id as string;

    // Determine destination section + index.
    const isColumn = sections.some((s) => s.id === overId);
    let destSection: string;
    let index: number;

    if (isColumn) {
      destSection = overId;
      index = bySection(destSection).filter((t) => t.id !== activeTaskId).length;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;
      destSection = overTask.section_id;
      const ordered = bySection(destSection).filter((t) => t.id !== activeTaskId);
      index = ordered.findIndex((t) => t.id === overId);
      if (index < 0) index = ordered.length;
    }

    const current = tasks.find((t) => t.id === activeTaskId);
    if (!current) return;
    if (current.section_id === destSection && current.position === index) return;

    moveTask(activeTaskId, destSection, index);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex h-full gap-4 overflow-x-auto bg-gradient-to-b from-bg to-surface-2/40 px-5 py-4">
        {sections.map((section, i) => (
          <KanbanColumn
            key={section.id}
            section={section}
            tasks={bySection(section.id)}
            labels={labels}
            accent={sectionAccent(section.name, i)}
          />
        ))}

        <div className="w-[260px] shrink-0">
          {addingColumn ? (
            <Input
              autoFocus
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              onBlur={() => {
                if (columnName.trim()) createSection(columnName.trim());
                setColumnName("");
                setAddingColumn(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setColumnName("");
                  setAddingColumn(false);
                }
              }}
              placeholder="Column name…"
              className="h-9"
            />
          ) : (
            <button
              onClick={() => setAddingColumn(true)}
              className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-border px-3 py-2.5 text-sm font-medium text-fg-subtle transition hover:border-accent/40 hover:bg-accent-soft/30 hover:text-fg"
            >
              <Plus className="h-4 w-4" />
              Add column
            </button>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (
          <KanbanCard task={activeTask} labels={labels} className="rotate-2 shadow-soft-lg" />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
