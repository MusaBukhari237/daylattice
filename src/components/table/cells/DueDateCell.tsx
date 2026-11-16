import { useStore } from "@/store/useStore";
import { cn, fromDateInputValue, isOverdue, toDateInputValue } from "@/lib/utils";
import type { Task } from "@/lib/types";

export function DueDateCell({ task }: { task: Task }) {
  const patchTask = useStore((s) => s.patchTask);
  const overdue = isOverdue(task.due_date);
  return (
    <input
      type="date"
      value={toDateInputValue(task.due_date)}
      onChange={(e) =>
        patchTask(task.id, { due_date: fromDateInputValue(e.target.value) })
      }
      className={cn(
        "cursor-pointer rounded-md bg-transparent px-1.5 py-0.5 text-xs outline-none hover:bg-muted focus:ring-2 focus:ring-accent/40",
        overdue ? "text-rose-500" : "text-fg-subtle",
        !task.due_date && "opacity-60",
      )}
    />
  );
}
