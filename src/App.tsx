import { useEffect } from "react";
import { useStore } from "@/store/useStore";
import type { WaStatus } from "@/lib/types";
import { Sidebar } from "@/components/Sidebar";
import { ListView } from "@/screens/ListView";
import { Settings } from "@/screens/Settings";
import { ListSettings } from "@/screens/ListSettings";
import { Onboarding } from "@/screens/onboarding/Onboarding";
import { VoiceOverlay } from "@/components/sam/VoiceOverlay";
import { ToastHost } from "@/components/common";
import { Spinner } from "@/components/common";
import {
  onSamToken,
  onSamDone,
  onSamTranscript,
  onSamRefresh,
  onDataChanged,
  onNavSettings,
  onNavList,
  onWaStatus,
  onWaQr,
} from "@/lib/events";

export default function App() {
  const {
    booted,
    profile,
    route,
    boot,
    appendSamToken,
    finishSam,
    setSamTranscript,
    refreshActiveList,
    refreshLists,
    refreshSettings,
    setRoute,
    setWaStatus,
    setWaQr,
    selectList,
  } = useStore();

  // Boot once.
  useEffect(() => {
    boot();
  }, [boot]);

  // Global event wiring.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        refreshActiveList();
        refreshLists();
      }, 120);
    };

    const subs = [
      onSamToken((p) => appendSamToken(p.text)),
      onSamDone(() => finishSam()),
      onSamTranscript((p) => setSamTranscript(p.text)),
      onSamRefresh((listId) => {
        // A turn from another channel (e.g. WhatsApp) landed — mirror it into the
        // in-app chat if we're viewing that list's scope.
        const active = useStore.getState().activeListId;
        if (listId === active || (listId == null && active == null)) {
          useStore.getState().loadSamMessages();
        }
      }),
      onDataChanged(() => debouncedRefresh()),
      onNavSettings(() => setRoute("settings")),
      onNavList((id) => {
        setRoute("list");
        selectList(id);
      }),
      onWaQr((p) => setWaQr(p.data)),
      onWaStatus((p) => {
        setWaStatus(p.status as WaStatus);
        refreshSettings();
      }),
    ];
    return () => {
      if (timer) clearTimeout(timer);
      subs.forEach((s) => s.then((fn) => fn()));
    };
  }, [
    appendSamToken,
    finishSam,
    setSamTranscript,
    refreshActiveList,
    refreshLists,
    refreshSettings,
    setRoute,
    setWaStatus,
    setWaQr,
    selectList,
  ]);

  if (!booted) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6 text-accent" />
      </div>
    );
  }

  if (!profile || !profile.onboarded) {
    return (
      <>
        <Onboarding />
        <ToastHost />
      </>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        {route === "settings" ? <Settings /> : <ListView />}
      </main>
      <ListSettings />
      <VoiceOverlay />
      <ToastHost />
    </div>
  );
}
