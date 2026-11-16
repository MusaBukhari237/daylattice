import { useRef, useState } from "react";
import { Mic, Square, Loader2, Sparkles } from "lucide-react";
import { useStore } from "@/store/useStore";
import { Modal, Button, Input, Textarea, toast } from "@/components/common";
import { LIST_COLORS, cn } from "@/lib/utils";
import * as ipc from "@/lib/ipc";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function NewListWizard({ open, onClose, onCreated }: Props) {
  const { createList, settings } = useStore();
  const [name, setName] = useState("");
  const [knowledge, setKnowledge] = useState("");
  const [color, setColor] = useState(LIST_COLORS[0]);
  const [busy, setBusy] = useState(false);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const reset = () => {
    setName("");
    setKnowledge("");
    setColor(LIST_COLORS[0]);
  };

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createList(name.trim(), knowledge.trim() || undefined, color);
      toast("List created", "success");
      reset();
      onCreated?.();
      onClose();
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: mime });
          const buf = await blob.arrayBuffer();
          const b64 = btoa(
            new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ""),
          );
          const text = await ipc.samTranscribe(b64, mime);
          setKnowledge((k) => (k ? k + " " : "") + text);
        } catch (e) {
          toast(String(e), "error");
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast("Microphone permission denied.", "error");
    }
  };

  const stopRec = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New list"
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={create} disabled={busy || !name.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create list"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label-text mb-1 block">List name</label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="e.g. Work, Home, Side project…"
          />
        </div>

        <div>
          <label className="label-text mb-1 block">Color</label>
          <div className="flex flex-wrap gap-2">
            {LIST_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn("h-7 w-7 rounded-full transition")}
                style={{
                  backgroundColor: c,
                  boxShadow: color === c ? `0 0 0 2px ${c}` : undefined,
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label-text flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Knowledge for the assistant (optional)
            </label>
            {settings?.has_api_key && (
              <button
                onClick={recording ? stopRec : startRec}
                disabled={transcribing}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition",
                  recording
                    ? "bg-rose-500 text-white"
                    : "bg-surface-2 text-fg-subtle hover:text-fg",
                )}
              >
                {transcribing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : recording ? (
                  <Square className="h-3 w-3" />
                ) : (
                  <Mic className="h-3 w-3" />
                )}
                {transcribing ? "Transcribing…" : recording ? "Stop" : "Dictate"}
              </button>
            )}
          </div>
          <Textarea
            rows={5}
            value={knowledge}
            onChange={(e) => setKnowledge(e.target.value)}
            placeholder="Describe this list so the assistant understands it — what it's for, how to prioritize, any conventions…"
          />
        </div>
      </div>
    </Modal>
  );
}
