import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Trash2, Sparkles, Tag as TagIcon, Plus } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button, Input, Textarea, Select, Tag, toast } from "../common";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  LIST_COLORS,
  fromDateInputValue,
  toDateInputValue,
} from "@/lib/utils";
import { samEnhanceTask } from "@/lib/ipc";
import type { Priority } from "@/lib/types";

export function TaskDrawer() {
  const {
    drawerTaskId,
    tasks,
    sections,
    labels,
    closeDrawer,
    patchTask,
    removeTask,
    toggleLabel,
    createLabel,
    settings,
  } = useStore();

  const task = tasks.find((t) => t.id === drawerTaskId) ?? null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
    }
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) return null;

  const commitTitle = () => {
    if (title.trim() && title !== task.title) patchTask(task.id, { title: title.trim() });
  };
  const commitDescription = () => {
    if (description !== task.description) patchTask(task.id, { description });
  };

  const original = (task.ai_metadata as { original?: { title?: string } } | null)?.original;

  return (
    <AnimatePresence>
      {drawerTaskId && (
        <motion.div
          className="fixed inset-0 z-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/30" onClick={closeDrawer} />
          <motion.div
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-soft-lg"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2">
                {task.ai_enhanced && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                    <Sparkles className="h-3 w-3" /> Enhanced
                  </span>
                )}
                <span className="text-xs text-fg-subtle">Task</span>
              </div>
              <button
                onClick={closeDrawer}
                className="rounded-lg p-1 text-fg-subtle transition hover:bg-muted hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <div>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={commitTitle}
                  className="text-base font-semibold"
                  placeholder="Task title"
                />
                {original?.title && original.title !== task.title && (
                  <p className="mt-1.5 px-1 text-xs text-fg-subtle">
                    Original: <span className="line-through">{original.title}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-text mb-1 block">Status</label>
                  <Select
                    value={task.section_id}
                    onChange={(e) => patchTask(task.id, { section_id: e.target.value })}
                  >
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="label-text mb-1 block">Priority</label>
                  <Select
                    value={task.priority}
                    onChange={(e) =>
                      patchTask(task.id, { priority: e.target.value as Priority })
                    }
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABEL[p]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <label className="label-text mb-1 block">Due date</label>
                <Input
                  type="date"
                  value={toDateInputValue(task.due_date)}
                  onChange={(e) =>
                    patchTask(task.id, { due_date: fromDateInputValue(e.target.value) })
                  }
                />
              </div>

              <div>
                <label className="label-text mb-1 block">Description</label>
                <Textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={commitDescription}
                  placeholder="Add more detail…"
                />
              </div>

              <div>
                <label className="label-text mb-1.5 flex items-center gap-1.5">
                  <TagIcon className="h-3.5 w-3.5" /> Labels
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {labels.map((l) => {
                    const on = task.label_ids.includes(l.id);
                    return (
                      <button key={l.id} onClick={() => toggleLabel(task.id, l.id)}>
                        <Tag
                          color={on ? l.color : undefined}
                          className={on ? "ring-1 ring-inset" : "opacity-60"}
                          style={on ? { boxShadow: `inset 0 0 0 1px ${l.color}55` } : {}}
                        >
                          {l.name}
                        </Tag>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newLabel.trim()) {
                        const color = LIST_COLORS[labels.length % LIST_COLORS.length];
                        createLabel(newLabel.trim(), color);
                        setNewLabel("");
                      }
                    }}
                    placeholder="New label…"
                    className="h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newLabel.trim()) {
                        const color = LIST_COLORS[labels.length % LIST_COLORS.length];
                        createLabel(newLabel.trim(), color);
                        setNewLabel("");
                      }
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!settings?.has_api_key) {
                    toast("Add a Gemini key in Settings to use the assistant.", "info");
                    return;
                  }
                  samEnhanceTask(task.id);
                  toast("the assistant is enhancing this task…", "info");
                }}
              >
                <Sparkles className="h-3.5 w-3.5" /> Enhance with the assistant
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40"
                onClick={() => removeTask(task.id)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
