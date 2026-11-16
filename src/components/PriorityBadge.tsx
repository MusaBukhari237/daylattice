import { cn } from "@/lib/utils";
import { PRIORITY_LABEL, PRIORITY_STYLE } from "@/lib/utils";
import type { Priority } from "@/lib/types";

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  if (priority === "none") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        PRIORITY_STYLE[priority],
        className,
      )}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
