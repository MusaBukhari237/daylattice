import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Trash2, PanelRightClose } from "lucide-react";
import { useStore } from "@/store/useStore";
import { SamMessage } from "./SamMessage";
import { MicButton } from "./MicButton";
import { Button } from "../common";

export function SamPanel() {
  const {
    samMessages,
    samStreaming,
    samBusy,
    sendSamText,
    clearSam,
    toggleSam,
    settings,
    activeListId,
    lists,
  } = useStore();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasKey = settings?.has_api_key ?? false;
  const activeList = lists.find((l) => l.id === activeListId);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [samMessages, samStreaming]);

  const submit = async () => {
    const text = input.trim();
    if (!text || samBusy) return;
    setInput("");
    await sendSamText(text);
  };

  return (
    <div className="flex h-full w-[340px] shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent text-accent-fg">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none">Assistant</div>
            <div className="mt-0.5 text-[11px] text-fg-subtle">
              {activeList ? activeList.name : "Assistant"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={clearSam}
            className="rounded-lg p-1.5 text-fg-subtle transition hover:bg-muted hover:text-fg"
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={toggleSam}
            className="rounded-lg p-1.5 text-fg-subtle transition hover:bg-muted hover:text-fg"
            title="Hide the assistant"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!hasKey && (
        <div className="m-3 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
          Add your Gemini API key in Settings to chat with the assistant, enhance tasks, and
          use voice.
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {samMessages.length === 0 && !samStreaming && (
          <div className="mt-10 px-2 text-center text-sm text-fg-subtle">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-accent/60" />
            Ask the assistant to add, move, or summarize tasks — by text or voice.
            <div className="mt-3 space-y-1.5 text-xs">
              <p className="rounded-lg bg-surface-2 px-2 py-1.5">
                “Add ‘Email the client’ as high priority”
              </p>
              <p className="rounded-lg bg-surface-2 px-2 py-1.5">
                “Move everything in progress to done”
              </p>
            </div>
          </div>
        )}

        {samMessages.map((m) => (
          <SamMessage key={m.id} message={m} />
        ))}

        {(samStreaming || (samBusy && !samStreaming)) && (
          <div className="flex gap-2.5">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-surface-2 px-3 py-2 text-sm leading-relaxed">
              <span className={samStreaming ? "" : "sam-caret"}>{samStreaming}</span>
              {samStreaming && <span className="sam-caret" />}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <MicButton disabled={!hasKey || samBusy} />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            disabled={!hasKey}
            placeholder={hasKey ? "Message the assistant…" : "Add a Gemini key to chat"}
            className="input max-h-28 min-h-[40px] flex-1 resize-none py-2"
          />
          <Button
            variant="primary"
            size="icon"
            onClick={submit}
            disabled={!hasKey || samBusy || !input.trim()}
            className="h-10 w-10"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Floating button to reopen the assistant when the panel is hidden. */
export function SamFab() {
  const toggleSam = useStore((s) => s.toggleSam);
  return (
    <button
      onClick={toggleSam}
      className="fixed bottom-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-soft-lg transition hover:scale-105 active:scale-95"
      title="Open the assistant"
    >
      <Sparkles className="h-5 w-5" />
    </button>
  );
}
