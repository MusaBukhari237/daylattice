import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { Button, Input } from "@/components/common";
import * as ipc from "@/lib/ipc";

export function NewProfile({
  onBack,
  onDone,
}: {
  onBack: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await ipc.createProfile(name.trim(), language.trim() || null);
      onDone();
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
        <div className="mb-5 flex items-center gap-2 text-accent">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-medium">Hi, I’m your task assistant</span>
        </div>
        <h1 className="text-xl font-semibold">What should I call you?</h1>
        <p className="mt-1.5 text-sm text-fg-subtle">
          I'll help you manage your tasks — by text, voice, or even WhatsApp.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="label-text mb-1 block">Your name</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="label-text mb-1 block">
              Preferred language for the assistant (optional)
            </label>
            <Input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="Leave blank to match your messages"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy || !name.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                Continue <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
