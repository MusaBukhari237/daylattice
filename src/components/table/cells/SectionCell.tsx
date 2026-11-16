import { useStore } from "@/store/useStore";
import type { Section, Task } from "@/lib/types";

export function SectionCell({ task, sections }: { task: Task; sections: Section[] }) {
  const patchTask = useStore((s) => s.patchTask);
  return (
    <select
      value={task.section_id}
      onChange={(e) => patchTask(task.id, { section_id: e.target.value })}
      className="cursor-pointer rounded-md border border-border bg-surface px-2 py-0.5 text-xs outline-none focus:ring-2 focus:ring-accent/40"
    >
      {sections.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
