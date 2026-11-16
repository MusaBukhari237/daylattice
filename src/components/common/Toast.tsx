import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

let counter = 0;
const listeners = new Set<(t: ToastItem) => void>();

/** Fire a toast from anywhere (including outside React). */
export function toast(message: string, kind: ToastKind = "info") {
  const item = { id: ++counter, kind, message };
  listeners.forEach((l) => l(item));
}

const icons = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  error: <AlertCircle className="h-4 w-4 text-rose-500" />,
  info: <Info className="h-4 w-4 text-accent" />,
};

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (t: ToastItem) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== t.id));
      }, 3800);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="card pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 text-sm shadow-soft-lg"
          >
            {icons[t.kind]}
            <span className="max-w-sm">{t.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
