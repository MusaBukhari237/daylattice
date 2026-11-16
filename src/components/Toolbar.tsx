import { useEffect, useRef, useState } from "react";
import { LayoutGrid, Table2, Plus, Search, Settings2 } from "lucide-react";
import { Button, Input, Select } from "./common";
import { useStore } from "@/store/useStore";
import { cn } from "@/lib/utils";
import { PRIORITIES, PRIORITY_LABEL } from "@/lib/utils";
import type { List, Priority } from "@/lib/types";

interface Props {
  list: List;
  view: "kanban" | "table";
  setView: (v: "kanban" | "table") => void;
  onAddTask: () => void;
  onGear: () => void;
  search: string;
  setSearch: (v: string) => void;
  priorityFilter: Priority | "all";
  setPriorityFilter: (v: Priority | "all") => void;
}

export function Toolbar({
  list,
  view,
  setView,
  onAddTask,
  onGear,
  search,
  setSearch,
  priorityFilter,
  setPriorityFilter,
}: Props) {
  const updateActiveListMeta = useStore((s) => s.updateActiveListMeta);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setName(list.name), [list.id, list.name]);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const v = name.trim();
    if (v && v !== list.name) updateActiveListMeta({ name: v });
    else setName(list.name);
  };

  return (
    <div className="flex items-center gap-3 border-b border-border bg-surface px-5 py-3 drag">
      <div className="flex min-w-0 items-center gap-2.5 no-drag">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: list.color }}
        />
        {editing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setName(list.name);
                setEditing(false);
              }
            }}
            className="min-w-0 rounded-lg bg-surface px-2 py-0.5 text-lg font-semibold outline-none ring-2 ring-accent/40"
          />
        ) : (
          <h1
            onDoubleClick={() => setEditing(true)}
            className="truncate text-lg font-semibold"
            title="Double-click to rename"
          >
            {list.name}
          </h1>
        )}
        <button
          onClick={onGear}
          className="rounded-lg p-1.5 text-fg-subtle transition hover:bg-muted hover:text-fg"
          title="List settings & knowledge"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2 no-drag">
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="h-9 w-44 pl-8 text-xs"
          />
        </div>

        <Select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as Priority | "all")}
          className="h-9 w-32 text-xs"
        >
          <option value="all">All priorities</option>
          {PRIORITIES.filter((p) => p !== "none").map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </Select>

        {/* View toggle */}
        <div className="flex items-center rounded-xl border border-border bg-surface-2 p-0.5">
          {(["kanban", "table"] as const).map((v) => (
            <button
              key={v}
              aria-label={v === "table" ? "Table" : "Kanban"}
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition",
                view === v
                  ? "bg-surface text-fg shadow-sm"
                  : "text-fg-subtle hover:text-fg",
              )}
            >
              {v === "kanban" ? (
                <LayoutGrid className="h-3.5 w-3.5" />
              ) : (
                <Table2 className="h-3.5 w-3.5" />
              )}
              <span className="capitalize">{v}</span>
            </button>
          ))}
        </div>

        <Button variant="primary" size="sm" className="h-9" onClick={onAddTask}>
          <Plus className="h-4 w-4" />
          Add task
        </Button>
      </div>
    </div>
  );
}
