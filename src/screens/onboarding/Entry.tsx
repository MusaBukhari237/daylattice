import { motion } from "framer-motion";
import { Sparkles, FilePlus2, Upload } from "lucide-react";

export function Entry({
  onNew,
  onImport,
}: {
  onNew: () => void;
  onImport: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-2xl"
    >
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-soft">
          <Sparkles className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to Daylattice</h1>
        <p className="mt-2 text-sm text-fg-subtle">
          A local-first todo app with the assistant, your AI assistant. Let's get you set up.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={onNew}
          className="card group flex flex-col items-start gap-3 p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <FilePlus2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Create new profile</h2>
            <p className="mt-1 text-sm text-fg-subtle">
              Start fresh. We'll set up your first list together.
            </p>
          </div>
        </button>

        <button
          onClick={onImport}
          className="card group flex flex-col items-start gap-3 p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-fg-subtle">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Import backup</h2>
            <p className="mt-1 text-sm text-fg-subtle">
              Restore from a <code className="text-xs">.daylattice</code> file.
            </p>
          </div>
        </button>
      </div>
    </motion.div>
  );
}
