import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useStore } from "@/store/useStore";
import {
  Modal,
  Button,
  Input,
  Textarea,
  ConfirmDialog,
  toast,
} from "@/components/common";
import { LIST_COLORS, cn } from "@/lib/utils";

export function ListSettings() {
  const {
    listSettingsId,
    lists,
    closeListSettings,
    updateActiveListMeta,
    deleteList,
  } = useStore();

  const list = lists.find((l) => l.id === listSettingsId) ?? null;

  const [name, setName] = useState("");
  const [knowledge, setKnowledge] = useState("");
  const [color, setColor] = useState(LIST_COLORS[0]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (list) {
      setName(list.name);
      setKnowledge(list.knowledge);
      setColor(list.color);
    }
  }, [list?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!list) return null;

  const save = async () => {
    await updateActiveListMeta({ name: name.trim() || list.name, knowledge, color });
    toast("List updated", "success");
    closeListSettings();
  };

  return (
    <>
      <Modal
        open={!!listSettingsId}
        onClose={closeListSettings}
        title="List settings"
        width="max-w-xl"
        footer={
          <>
            <Button
              variant="ghost"
              className="mr-auto text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" /> Delete list
            </Button>
            <Button variant="ghost" onClick={closeListSettings}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-text mb-1 block">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="label-text mb-1 block">Color</label>
            <div className="flex flex-wrap gap-2">
              {LIST_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full transition",
                    color === c && "ring-2 ring-offset-2 ring-offset-surface",
                  )}
                  style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${c}` : undefined }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="label-text mb-1 block">
              Knowledge · context the assistant uses for this list
            </label>
            <Textarea
              rows={6}
              value={knowledge}
              onChange={(e) => setKnowledge(e.target.value)}
              placeholder="e.g. This is my freelance client work. Treat anything mentioning invoices as high priority. Default new tasks to the ‘New’ column…"
            />
            <p className="mt-1.5 text-xs text-fg-subtle">
              the assistant reads this whenever it acts on this list — for enhancing tasks and
              answering questions.
            </p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete list?"
        message={`“${list.name}” and all its tasks, columns, and labels will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          deleteList(list.id);
          closeListSettings();
          toast("List deleted", "success");
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
