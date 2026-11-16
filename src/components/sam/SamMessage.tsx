import { Sparkles, Mic, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SamMessage as SamMsg } from "@/lib/types";

const sourceIcon = {
  ui: null,
  voice: <Mic className="h-3 w-3" />,
  whatsapp: <MessageCircle className="h-3 w-3" />,
};

export function SamMessage({ message }: { message: SamMsg }) {
  const isSam = message.role === "sam";
  return (
    <div className={cn("flex gap-2.5", isSam ? "justify-start" : "justify-end")}>
      {isSam && (
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[82%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isSam
            ? "rounded-tl-sm bg-surface-2 text-fg"
            : "rounded-tr-sm bg-accent text-accent-fg",
        )}
      >
        {message.content}
        {message.source !== "ui" && (
          <span
            className={cn(
              "ml-1.5 inline-flex translate-y-0.5 items-center gap-0.5 text-[10px] opacity-70",
            )}
          >
            {sourceIcon[message.source]}
          </span>
        )}
      </div>
    </div>
  );
}
