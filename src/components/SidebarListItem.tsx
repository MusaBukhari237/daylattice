import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { List } from "@/lib/types";

interface Props {
  list: List;
  active: boolean;
  collapsed: boolean;
  onSelect: () => void;
  onGear: () => void;
}

export function SidebarListItem({ list, active, collapsed, onSelect, onGear }: Props) {
  return (
    <div
      className={cn(
        "group flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors",
        active ? "bg-accent-soft text-fg" : "text-fg-subtle hover:bg-muted hover:text-fg",
      )}
      onClick={onSelect}
      title={collapsed ? list.name : undefined}
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: list.color }}
      />
      {!collapsed && (
        <>
          <span className="flex-1 truncate font-medium">{list.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onGear();
            }}
            className="rounded-md p-1 text-fg-subtle opacity-0 transition hover:bg-surface hover:text-fg group-hover:opacity-100"
            title="List settings"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
