import clsx, { type ClassValue } from "clsx";
import type { Priority } from "./types";

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

export const PRIORITIES: Priority[] = ["none", "low", "med", "high", "urgent"];

export const PRIORITY_LABEL: Record<Priority, string> = {
  none: "None",
  low: "Low",
  med: "Medium",
  high: "High",
  urgent: "Urgent",
};

// Tailwind classes for priority chips (token-independent, intentionally vivid).
export const PRIORITY_STYLE: Record<Priority, string> = {
  none: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  low: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  med: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  urgent: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

export const LIST_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
];

// Accent colors for Kanban columns. Common statuses get intuitive colors;
// anything else cycles through a pleasant palette by position.
const NAMED_SECTION_ACCENTS: Record<string, string> = {
  new: "#6366f1", // indigo
  todo: "#6366f1",
  backlog: "#64748b", // slate
  "in progress": "#f59e0b", // amber
  doing: "#f59e0b",
  review: "#a855f7", // purple
  blocked: "#ef4444", // red
  done: "#10b981", // emerald
  complete: "#10b981",
  completed: "#10b981",
};

const SECTION_PALETTE = [
  "#6366f1",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#f43f5e",
];

export function sectionAccent(name: string, index: number): string {
  const key = name.trim().toLowerCase();
  return NAMED_SECTION_ACCENTS[key] ?? SECTION_PALETTE[index % SECTION_PALETTE.length];
}

export function formatDueDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function fromDateInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
