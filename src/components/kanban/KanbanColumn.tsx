import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Pencil } from "lucide-react";
import { KanbanCard } from "./KanbanCard";
import { useStore } from "@/store/useStore";
import { Input } from "../common";
import { cn } from "@/lib/utils";
import type { Label, Section, Task } from "@/lib/types";

function SortableCard({
  task,
  labels,
  onOpen,
}: {
  task: Task;
  labels: Label[];
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { sectionId: task.section_id } });
  return (
    <KanbanCard
      ref={setNodeRef}
      task={task}
      labels={labels}
      dragging={isDragging}
      onClick={onOpen}
      className="cursor-grab active:cursor-grabbing"
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
    />
  );
}

interface Props {
  section: Section;
  tasks: Task[];
  labels: Label[];
  accent: string;
}

export function KanbanColumn({ section, tasks, labels, accent }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: section.id });
  const { addTask, openDrawer, renameSection } = useStore();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(section.name);

  const submit = async () => {
    if (title.trim()) {
      await addTask({ title: title.trim(), section_id: section.id, enhance: true });
    }
    setTitle("");
    setAdding(false);
  };

  const commitName = () => {
    setEditingName(false);
    const v = name.trim();
    if (v && v !== section.name) renameSection(section.id, v);
    else setName(section.name);
  };

  return (
    <div className="group/col flex h-full w-[306px] shrink-0 flex-col">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2 px-1.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
        {editingName ? (
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setName(section.name);
                setEditingName(false);
              }
            }}
            className="h-7 flex-1 py-0 text-sm font-semibold"
          />
        ) : (
          <>
            <h3
              onDoubleClick={() => setEditingName(true)}
              className="text-sm font-semibold"
              title="Double-click to rename"
            >
              {section.name}
            </h3>
            <span
              className="rounded-full px-1.5 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: `${accent}1f`, color: accent }}
            >
              {tasks.length}
            </span>
            <button
              onClick={() => setEditingName(true)}
              className="ml-auto rounded-md p-1 text-fg-subtle opacity-0 transition hover:bg-muted hover:text-fg group-hover/col:opacity-100"
              title="Rename column"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Body / drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border-2 border-transparent bg-surface-2/60 p-2 transition-all duration-150",
        )}
        style={
          isOver
            ? {
                borderColor: accent,
                backgroundColor: `${accent}14`,
                boxShadow: `0 0 0 3px ${accent}22`,
              }
            : undefined
        }
      >
        {/* Accent strip */}
        <div className="h-1 w-10 shrink-0 rounded-full" style={{ backgroundColor: `${accent}55` }} />

        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableCard
              key={task.id}
              task={task}
              labels={labels}
              onOpen={() => openDrawer(task.id)}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && !adding && (
          <div
            className={cn(
              "flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/70 py-8 text-xs text-fg-subtle transition-colors",
              isOver && "text-fg",
            )}
          >
            {isOver ? "Drop here" : "No tasks"}
          </div>
        )}

        {adding ? (
          <div className="card p-2">
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={submit}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") {
                  setTitle("");
                  setAdding(false);
                }
              }}
              placeholder="Task title…"
              className="h-8 text-sm"
            />
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-0.5 flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-medium text-fg-subtle transition hover:bg-surface hover:text-fg"
          >
            <Plus className="h-3.5 w-3.5" />
            Add task
          </button>
        )}
      </div>
    </div>
  );
}
