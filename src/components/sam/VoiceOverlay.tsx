import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, Loader2, Sparkles } from "lucide-react";
import { useStore } from "@/store/useStore";
import { toast } from "../common";
import { onVoiceStart, onVoiceStop, onSamTranscript } from "@/lib/events";
import * as ipc from "@/lib/ipc";

type Phase = "idle" | "listening" | "processing";

/**
 * Full-screen push-to-talk overlay. Driven by the global voice hotkey
 * (`voice:start` / `voice:stop` events from the Rust core). Records while the
 * key is held, then hands the audio to the assistant on release.
 */
export function VoiceOverlay() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeRef = useRef("audio/webm");

  useEffect(() => {
    const start = async () => {
      if (recorderRef.current) return; // already recording
      setHeard("");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const mime = MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/ogg";
        mimeRef.current = mime;
        const recorder = new MediaRecorder(stream, { mimeType: mime });
        chunksRef.current = [];
        recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
        recorder.onstop = handleStop;
        recorder.start();
        recorderRef.current = recorder;
        setPhase("listening");
      } catch {
        toast("Microphone permission denied.", "error");
        setPhase("idle");
      }
    };

    const handleStop = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (!recorder) {
        setPhase("idle");
        return;
      }
      const blob = new Blob(chunksRef.current, { type: mimeRef.current });
      if (blob.size < 1200) {
        // Too short to be meaningful.
        setPhase("idle");
        return;
      }
      setPhase("processing");
      try {
        const buf = await blob.arrayBuffer();
        const b64 = btoa(
          new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ""),
        );
        const listId = useStore.getState().activeListId;
        // Ensure the assistant panel is open so the user sees the streamed reply.
        if (!useStore.getState().samOpen) useStore.setState({ samOpen: true });
        useStore.setState({ samBusy: true, samStreaming: "" });
        await ipc.samVoiceCommand(listId, b64, mimeRef.current);
      } catch (e) {
        toast(String(e), "error");
      } finally {
        setPhase("idle");
      }
    };

    const stop = () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop(); // triggers handleStop
      } else {
        setPhase("idle");
      }
    };

    const subs = [
      onVoiceStart(() => start()),
      onVoiceStop(() => stop()),
      onSamTranscript((p) => setHeard(p.text)),
    ];
    return () => {
      subs.forEach((s) => s.then((fn) => fn()));
    };
  }, []);

  return createPortal(
    <AnimatePresence>
      {phase !== "idle" && (
        <motion.div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-bg/70 backdrop-blur-xl" />

          <motion.div
            className="relative z-10 flex flex-col items-center"
            initial={{ scale: 0.9, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Pulsing mic */}
            <div className="relative flex h-44 w-44 items-center justify-center">
              {phase === "listening" &&
                [0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="absolute rounded-full bg-accent/30"
                    style={{ width: 96, height: 96 }}
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 2.4, opacity: 0 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.6,
                      ease: "easeOut",
                    }}
                  />
                ))}
              <motion.div
                className="relative flex h-24 w-24 items-center justify-center rounded-full bg-accent text-accent-fg shadow-soft-lg"
                animate={
                  phase === "listening"
                    ? { scale: [1, 1.08, 1] }
                    : { scale: 1 }
                }
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              >
                {phase === "processing" ? (
                  <Loader2 className="h-9 w-9 animate-spin" />
                ) : (
                  <Mic className="h-9 w-9" />
                )}
              </motion.div>
            </div>

            {/* Animated waveform */}
            {phase === "listening" && (
              <div className="mt-2 flex h-8 items-end gap-1">
                {Array.from({ length: 9 }).map((_, i) => (
                  <motion.span
                    key={i}
                    className="w-1 rounded-full bg-accent"
                    animate={{ height: [6, 26, 10, 22, 6] }}
                    transition={{
                      duration: 0.9,
                      repeat: Infinity,
                      delay: i * 0.08,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>
            )}

            <div className="mt-6 text-center">
              <p className="text-lg font-semibold">
                {phase === "listening" ? "Listening…" : "Working on it…"}
              </p>
              <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-fg-subtle">
                {phase === "listening" ? (
                  "Release the key when you're done"
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-accent" /> the assistant is on it
                  </>
                )}
              </p>
              {heard && (
                <p className="mx-auto mt-4 max-w-md rounded-2xl bg-surface px-4 py-2 text-sm text-fg shadow-soft">
                  “{heard}”
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
