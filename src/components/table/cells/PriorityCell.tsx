import { useStore } from "@/store/useStore";
import { PRIORITIES, PRIORITY_LABEL, PRIORITY_STYLE, cn } from "@/lib/utils";
import type { Priority, Task } from "@/lib/types";

export function PriorityCell({ task }: { task: Task }) {
  const patchTask = useStore((s) => s.patchTask);
  return (
    <div className="relative inline-flex">
      <select
        value={task.priority}
        onChange={(e) => patchTask(task.id, { priority: e.target.value as Priority })}
        className={cn(
          "cursor-pointer appearance-none rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide outline-none focus:ring-2 focus:ring-accent/40",
          PRIORITY_STYLE[task.priority],
        )}
      >
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </option>
        ))}
      </select>
    </div>
  );
}
