import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import { Button, toast } from "./common";
import { cn } from "@/lib/utils";
import * as ipc from "@/lib/ipc";

const MODIFIER_CODES = [
  "ControlLeft",
  "ControlRight",
  "ShiftLeft",
  "ShiftRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
];

const DURATIONS = [
  { label: "Instant", ms: 0 },
  { label: "1 sec", ms: 1000 },
  { label: "3 sec", ms: 3000 },
  { label: "5 sec", ms: 5000 },
];

/** Pretty-print a Tauri accelerator like "Control+Shift+KeyV" → "Ctrl + Shift + V". */
function pretty(accel: string): string {
  const isMac = navigator.platform.toLowerCase().includes("mac");
  return accel
    .split("+")
    .map((p) => {
      if (p === "Control") return "Ctrl";
      if (p === "Super" || p === "Meta") return isMac ? "Cmd" : "Win";
      if (p.startsWith("Key")) return p.slice(3);
      if (p.startsWith("Digit")) return p.slice(5);
      if (p.startsWith("Arrow")) return p.slice(5);
      return p;
    })
    .join(" + ");
}

export function VoiceHotkeySettings() {
  const [shortcut, setShortcut] = useState("Control+Shift+Space");
  const [holdMs, setHoldMs] = useState(1000);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    ipc
      .getVoiceSettings()
      .then((v) => {
        setShortcut(v.shortcut);
        setHoldMs(v.hold_ms);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setCapturing(false);
        return;
      }
      if (MODIFIER_CODES.includes(e.code)) return; // wait for a real key
      const mods: string[] = [];
      if (e.ctrlKey) mods.push("Control");
      if (e.altKey) mods.push("Alt");
      if (e.shiftKey) mods.push("Shift");
      if (e.metaKey) mods.push("Super");
      const accel = [...mods, e.code].join("+");
      setCapturing(false);
      void save(accel, holdMs);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturing, holdMs]);

  const save = async (sc: string, hm: number) => {
    const prev = { sc: shortcut, hm: holdMs };
    setShortcut(sc);
    setHoldMs(hm);
    try {
      await ipc.setVoiceSettings(sc, hm);
      toast("Voice hotkey updated", "success");
    } catch (e) {
      setShortcut(prev.sc);
      setHoldMs(prev.hm);
      toast(String(e), "error");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="label-text mb-1 block">Shortcut</label>
        <div className="flex items-center gap-2">
          <div className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-border bg-surface-2 px-3">
            <Keyboard className="h-4 w-4 text-fg-subtle" />
            {capturing ? (
              <span className="text-sm text-accent">Press a key combination…</span>
            ) : (
              <kbd className="text-sm font-medium">{pretty(shortcut)}</kbd>
            )}
          </div>
          <Button
            variant={capturing ? "secondary" : "primary"}
            onClick={() => setCapturing((c) => !c)}
          >
            {capturing ? "Cancel" : "Change"}
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-fg-subtle">
          Tip: include a modifier (Ctrl/Alt/Shift) to avoid clashing with normal
          typing. Works even when Daylattice is hidden in the tray.
        </p>
      </div>

      <div>
        <label className="label-text mb-1 block">Hold to activate</label>
        <div className="flex gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d.ms}
              onClick={() => save(shortcut, d.ms)}
              className={cn(
                "flex-1 rounded-xl border px-2 py-2 text-sm font-medium transition",
                holdMs === d.ms
                  ? "border-accent bg-accent-soft text-fg"
                  : "border-border text-fg-subtle hover:bg-muted",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-fg-subtle">
          How long to hold the shortcut before the voice panel opens. Then speak,
          and release to send it to the assistant.
        </p>
      </div>
    </div>
  );
}
