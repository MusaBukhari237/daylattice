import { motion } from "framer-motion";
import { ShieldCheck, KeyRound, MessageCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/common";

export function PostImportNotice({ onFinish }: { onFinish: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-lg"
    >
      <div className="card p-7">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Backup restored</h1>
        <p className="mt-1.5 text-sm text-fg-subtle">
          Your lists, tasks, labels, and chat history are back. For your security,
          two things were <strong>not</strong> included in the backup:
        </p>

        <div className="mt-5 space-y-3">
          <div className="flex gap-3 rounded-xl border border-border bg-surface-2 p-3.5">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <div className="text-sm">
              <p className="font-medium">Gemini API key</p>
              <p className="text-fg-subtle">
                Re-enter it in <strong>Settings → the assistant</strong> to use the assistant.
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-border bg-surface-2 p-3.5">
            <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <div className="text-sm">
              <p className="font-medium">WhatsApp session</p>
              <p className="text-fg-subtle">
                Reconnect in <strong>Settings → WhatsApp</strong> and scan the QR code
                again.
              </p>
            </div>
          </div>
        </div>

        <Button variant="primary" className="mt-6 w-full" onClick={onFinish}>
          Get started <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}
