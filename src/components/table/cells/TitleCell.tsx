import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useStore } from "@/store/useStore";
import type { Task } from "@/lib/types";

export function TitleCell({ task }: { task: Task }) {
  const patchTask = useStore((s) => s.patchTask);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setValue(task.title), [task.title]);
  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const v = value.trim();
    if (v && v !== task.title) patchTask(task.id, { title: v });
    else setValue(task.title);
  };

  return (
    <div className="flex items-center gap-1.5">
      {task.ai_enhanced && <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />}
      {editing ? (
        <input
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setValue(task.title);
              setEditing(false);
            }
          }}
          className="w-full rounded-md bg-surface px-1.5 py-0.5 text-sm outline-none ring-2 ring-accent/40"
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className="block w-full cursor-text truncate rounded-md px-1.5 py-0.5 text-sm hover:bg-muted"
        >
          {task.title}
        </span>
      )}
    </div>
  );
}
