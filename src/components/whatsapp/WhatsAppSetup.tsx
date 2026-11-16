import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MessageCircle,
  Loader2,
  CheckCircle2,
  Smartphone,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { Modal, Button, toast } from "../common";

interface Props {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  "Open WhatsApp on your phone.",
  "Tap Menu (⋮) or Settings → Linked Devices.",
  "Tap “Link a device”.",
  "Point your phone at this screen to scan the code.",
];

export function WhatsAppSetup({ open, onClose }: Props) {
  const { waStatus, waQr, connectWhatsApp, disconnectWhatsApp } = useStore();

  // Kick off pairing automatically when the dialog opens while disconnected.
  useEffect(() => {
    if (open && waStatus === "disconnected") {
      connectWhatsApp().catch((e) => toast(String(e), "error"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Set up WhatsApp" width="max-w-xl">
      <AnimatePresence mode="wait">
        {waStatus === "connected" ? (
          <motion.div
            key="connected"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center py-4 text-center"
          >
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3 className="text-base font-semibold">WhatsApp connected</h3>
            <p className="mt-1.5 max-w-sm text-sm text-fg-subtle">
              You can now message Daylattice from WhatsApp — send a task, ask for a
              summary, or record a voice note. the assistant replies in the same chat.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-fg-subtle">
              <ShieldCheck className="h-4 w-4 text-accent" />
              Your session stays on this device and is never included in backups.
            </div>
            <div className="mt-6 flex gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  disconnectWhatsApp().catch((e) => toast(String(e), "error"))
                }
              >
                Disconnect
              </Button>
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </motion.div>
        ) : waQr ? (
          <motion.div
            key="qr"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-5 sm:flex-row"
          >
            <div className="flex flex-col items-center">
              <div className="rounded-2xl border border-border bg-white p-3 shadow-soft">
                <img src={waQr} alt="WhatsApp pairing QR code" className="h-52 w-52" />
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-subtle">
                <Loader2 className="h-3 w-3 animate-spin" />
                Waiting for you to scan…
              </p>
            </div>

            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <ScanLine className="h-4 w-4 text-accent" />
                Link your phone
              </div>
              <ol className="space-y-2.5">
                {STEPS.map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
                      {i + 1}
                    </span>
                    <span className="text-fg-subtle">{step}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs text-fg-subtle">
                The code refreshes automatically — if it expires, a new one appears
                here.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="starting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center py-10 text-center"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              {waStatus === "connecting" ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <MessageCircle className="h-7 w-7" />
              )}
            </div>
            <h3 className="text-base font-semibold">
              {waStatus === "connecting" ? "Starting WhatsApp…" : "Connect WhatsApp"}
            </h3>
            <p className="mt-1.5 max-w-sm text-sm text-fg-subtle">
              {waStatus === "connecting"
                ? "Preparing a secure pairing code. This takes a few seconds."
                : "Link your number to manage todos by message or voice note."}
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-fg-subtle">
              <Smartphone className="h-4 w-4" />
              You'll scan a QR code with your phone.
            </div>
            {waStatus === "disconnected" && (
              <Button
                variant="primary"
                className="mt-6"
                onClick={() =>
                  connectWhatsApp().catch((e) => toast(String(e), "error"))
                }
              >
                Connect WhatsApp
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
