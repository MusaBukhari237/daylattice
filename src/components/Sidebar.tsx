import { useState } from "react";
import { PanelLeftClose, PanelLeft, Plus, Settings } from "lucide-react";
import { useStore } from "@/store/useStore";
import { SidebarListItem } from "./SidebarListItem";
import { Button } from "./common";
import { NewListWizard } from "@/screens/onboarding/NewListWizard";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const {
    lists,
    activeListId,
    sidebarCollapsed,
    toggleSidebar,
    selectList,
    openListSettings,
    setRoute,
    route,
    profile,
  } = useStore();
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-surface transition-all duration-200 ease-smooth",
        sidebarCollapsed ? "w-[64px]" : "w-[252px]",
      )}
    >
      {/* Brand / header */}
      <div className="flex items-center justify-between px-3 py-3.5 drag">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 pl-1 no-drag">
            <img className="h-8 w-8" src="/Daylattice.svg" alt="" />
            <span className="text-sm font-semibold">Daylattice</span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="no-drag rounded-lg p-1.5 text-fg-subtle transition hover:bg-muted hover:text-fg"
          title={sidebarCollapsed ? "Expand" : "Collapse"}
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Lists */}
      <div className="flex-1 overflow-y-auto px-2.5 py-1">
        {!sidebarCollapsed && (
          <div className="px-1.5 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            Lists
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          {lists.map((list) => (
            <SidebarListItem
              key={list.id}
              list={list}
              active={route === "list" && activeListId === list.id}
              collapsed={sidebarCollapsed}
              onSelect={() => selectList(list.id)}
              onGear={() => openListSettings(list.id)}
            />
          ))}
        </div>

        <button
          onClick={() => setWizardOpen(true)}
          className={cn(
            "mt-1 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-fg-subtle transition hover:bg-muted hover:text-fg",
            sidebarCollapsed && "justify-center",
          )}
          title="New list"
        >
          <Plus className="h-4 w-4" />
          {!sidebarCollapsed && "New List"}
        </button>
      </div>

      {/* Footer */}
      <div className="border-t border-border p-2.5">
        <Button
          variant={route === "settings" ? "secondary" : "ghost"}
          className={cn("w-full", sidebarCollapsed && "px-0 justify-center")}
          onClick={() => setRoute("settings")}
        >
          <Settings className="h-4 w-4" />
          {!sidebarCollapsed && <span className="flex-1 text-left">Settings</span>}
        </Button>
        {!sidebarCollapsed && profile && (
          <div className="mt-2 truncate px-2 text-xs text-fg-subtle">
            {profile.name}
          </div>
        )}
      </div>

      <NewListWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </aside>
  );
}
