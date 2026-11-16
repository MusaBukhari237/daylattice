import { useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { useStore } from "@/store/useStore";
import { toast } from "../common";
import { cn } from "@/lib/utils";

/** Records a short clip via MediaRecorder and sends it to the assistant as a voice command. */
export function MicButton({ disabled }: { disabled?: boolean }) {
  const sendSamVoice = useStore((s) => s.sendSamVoice);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const buf = await blob.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ""),
        );
        await sendSamVoice(base64, mime);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast("Microphone permission denied.", "error");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={recording ? stop : start}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border transition disabled:opacity-50",
        recording
          ? "animate-pulse bg-rose-500 text-white"
          : "bg-surface-2 text-fg-subtle hover:text-fg",
      )}
      title={recording ? "Stop recording" : "Voice command"}
    >
      {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}
