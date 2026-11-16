import { useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Tag } from "../../common";
import type { Label, Task } from "@/lib/types";

export function LabelsCell({ task, labels }: { task: Task; labels: Label[] }) {
  const toggleLabel = useStore((s) => s.toggleLabel);
  const [open, setOpen] = useState(false);
  const assigned = labels.filter((l) => task.label_ids.includes(l.id));

  return (
    <div className="relative flex flex-wrap items-center gap-1">
      {assigned.map((l) => (
        <Tag key={l.id} color={l.color}>
          {l.name}
        </Tag>
      ))}
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-md p-0.5 text-fg-subtle transition hover:bg-muted hover:text-fg"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="card absolute left-0 top-7 z-20 max-h-56 w-44 overflow-y-auto p-1 shadow-soft-lg">
            {labels.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-fg-subtle">No labels yet</p>
            )}
            {labels.map((l) => {
              const on = task.label_ids.includes(l.id);
              return (
                <button
                  key={l.id}
                  onClick={() => toggleLabel(task.id, l.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-muted"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                  <span className="flex-1 truncate">{l.name}</span>
                  {on && <span className="text-accent">✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
