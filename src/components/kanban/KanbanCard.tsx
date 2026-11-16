import { forwardRef, type HTMLAttributes } from "react";
import { CalendarDays, Sparkles } from "lucide-react";
import { PriorityBadge } from "../PriorityBadge";
import { Tag } from "../common";
import { cn, formatDueDate, isOverdue } from "@/lib/utils";
import type { Label, Task } from "@/lib/types";

interface Props extends HTMLAttributes<HTMLDivElement> {
  task: Task;
  labels: Label[];
  dragging?: boolean;
}

export const KanbanCard = forwardRef<HTMLDivElement, Props>(
  ({ task, labels, dragging, className, ...rest }, ref) => {
    const taskLabels = labels.filter((l) => task.label_ids.includes(l.id));
    const overdue = isOverdue(task.due_date);

    return (
      <div
        ref={ref}
        className={cn(
          "card group cursor-pointer p-3 transition-shadow hover:shadow-soft",
          dragging && "opacity-50",
          className,
        )}
        {...rest}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug text-fg">{task.title}</p>
          {task.ai_enhanced && (
            <Sparkles
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
              aria-label="Enhanced by the assistant"
            />
          )}
        </div>

        {task.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-fg-subtle">
            {task.description}
          </p>
        )}

        {(taskLabels.length > 0 || task.priority !== "none" || task.due_date) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={task.priority} />
            {taskLabels.map((l) => (
              <Tag key={l.id} color={l.color}>
                {l.name}
              </Tag>
            ))}
            {task.due_date && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-medium",
                  overdue ? "text-rose-500" : "text-fg-subtle",
                )}
              >
                <CalendarDays className="h-3 w-3" />
                {formatDueDate(task.due_date)}
              </span>
            )}
          </div>
        )}
      </div>
    );
  },
);
KanbanCard.displayName = "KanbanCard";
