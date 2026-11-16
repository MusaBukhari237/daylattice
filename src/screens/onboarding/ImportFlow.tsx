import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { Button, toast } from "@/components/common";
import * as ipc from "@/lib/ipc";

export function ImportFlow({
  onBack,
  onImported,
}: {
  onBack: () => void;
  onImported: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    setBusy(true);
    try {
      const ok = await ipc.importBackup();
      if (ok) onImported();
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-md"
    >
      <div className="card p-7">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-fg-subtle">
          <Upload className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Import a backup</h1>
        <p className="mt-1.5 text-sm text-fg-subtle">
          Choose a <code className="text-xs">.daylattice</code> file to restore your data.
        </p>

        <div className="mt-4 flex gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-3.5 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This replaces any existing data on this device. Since you're setting up a
            new profile, there's nothing to lose yet.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button variant="primary" onClick={pick} disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Upload className="h-4 w-4" /> Choose file
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
