import { useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { Toolbar } from "@/components/Toolbar";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { TableView } from "@/components/table/TableView";
import { SamPanel, SamFab } from "@/components/sam/SamPanel";
import { TaskDrawer } from "@/components/task/TaskDrawer";
import { Button } from "@/components/common";
import { Plus, ListTodo } from "lucide-react";
import type { Priority } from "@/lib/types";

export function ListView() {
  const {
    lists,
    activeListId,
    sections,
    tasks,
    labels,
    view,
    setView,
    samOpen,
    openListSettings,
    addTask,
  } = useStore();

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");

  const list = lists.find((l) => l.id === activeListId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (q && !t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [tasks, search, priorityFilter]);

  if (!list) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <ListTodo className="mb-3 h-10 w-10 text-fg-subtle/50" />
        <p className="text-sm text-fg-subtle">No list selected.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        <Toolbar
          list={list}
          view={view}
          setView={setView}
          onAddTask={() =>
            addTask({ title: "New task", section_id: sections[0]?.id, enhance: false })
          }
          onGear={() => openListSettings(list.id)}
          search={search}
          setSearch={setSearch}
          priorityFilter={priorityFilter}
          setPriorityFilter={setPriorityFilter}
        />

        <div className="flex-1 overflow-hidden">
          {sections.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-fg-subtle">This list has no columns yet.</p>
              <Button variant="primary" size="sm" onClick={() => addTask({ title: "First task" })}>
                <Plus className="h-4 w-4" /> Add a task
              </Button>
            </div>
          ) : view === "kanban" ? (
            <KanbanBoard sections={sections} tasks={filtered} labels={labels} />
          ) : (
            <TableView sections={sections} tasks={filtered} labels={labels} />
          )}
        </div>
      </div>

      {samOpen ? <SamPanel /> : <SamFab />}
      <TaskDrawer />
    </div>
  );
}
