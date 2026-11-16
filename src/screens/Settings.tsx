import { useEffect, useState } from "react";
import {
  Key,
  Languages,
  MessageCircle,
  Palette,
  Power,
  Database,
  User,
  Check,
  Loader2,
  Download,
  Upload,
  Mic,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { Button, Input, toast } from "@/components/common";
import { WhatsAppSetup } from "@/components/whatsapp/WhatsAppSetup";
import { VoiceHotkeySettings } from "@/components/VoiceHotkeySettings";
import * as ipc from "@/lib/ipc";
import { cn } from "@/lib/utils";
import type { Theme } from "@/lib/types";

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-fg-subtle">{description}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export function Settings() {
  const {
    settings,
    refreshSettings,
    profile,
    theme,
    setTheme,
    refreshLists,
    waStatus,
    lists,
  } = useStore();

  const [name, setName] = useState("");
  const [language, setLanguage] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [waSetupOpen, setWaSetupOpen] = useState(false);
  const [waNumber, setWaNumber] = useState("");

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    if (settings) {
      setName(settings.name);
      setLanguage(settings.output_language ?? "");
      setWaNumber(settings.wa_control_number ?? "");
    }
  }, [settings]);

  const saveWaNumber = async () => {
    const trimmed = waNumber.trim();
    if ((settings?.wa_control_number ?? "") === trimmed) return;
    await ipc.setWaControlNumber(trimmed || null);
    await refreshSettings();
    toast(trimmed ? "Control number saved" : "Control number cleared", "success");
  };

  const changeDefaultList = async (listId: string | null) => {
    await ipc.setDefaultList(listId);
    await refreshSettings();
    toast("Default list updated", "success");
  };

  const saveName = async () => {
    if (name.trim() && name !== settings?.name) {
      await ipc.updateProfileName(name.trim());
      await refreshSettings();
      toast("Name updated", "success");
    }
  };

  const saveLanguage = async (value: string) => {
    setLanguage(value);
    await ipc.setLanguage(value.trim() || null);
    await refreshSettings();
  };

  const saveKey = async () => {
    if (!apiKey.trim()) return;
    setSavingKey(true);
    try {
      await ipc.setApiKey(apiKey.trim());
      setApiKey("");
      await refreshSettings();
      toast("Gemini key saved", "success");
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setSavingKey(false);
    }
  };

  const clearKey = async () => {
    await ipc.clearApiKey();
    await refreshSettings();
    toast("Gemini key cleared", "info");
  };

  const toggleAutostart = async () => {
    const next = !(settings?.autostart_enabled ?? false);
    await ipc.setAutostart(next);
    await refreshSettings();
    toast(next ? "Will open on startup" : "Won't open on startup", "info");
  };

  const doExport = async () => {
    try {
      const path = await ipc.exportBackup();
      if (path) toast("Backup exported", "success");
    } catch (e) {
      toast(String(e), "error");
    }
  };

  const doImport = async () => {
    if (
      !window.confirm(
        "Importing a backup will OVERWRITE all current data (lists, tasks, labels, chat). Your Gemini key and WhatsApp session are not affected. Continue?",
      )
    )
      return;
    try {
      const ok = await ipc.importBackup();
      if (ok) {
        await refreshLists();
        toast("Backup imported. Reconnect WhatsApp & re-enter your key.", "success");
      }
    } catch (e) {
      toast(String(e), "error");
    }
  };

  const themes: { value: Theme; label: string }[] = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-5 px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="mt-1 text-sm text-fg-subtle">
            Manage your profile, the assistant, WhatsApp, and data.
          </p>
        </div>

        {/* Profile */}
        <Section icon={<User className="h-4 w-4" />} title="Profile">
          <label className="label-text mb-1 block">Your name</label>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} />
          </div>
        </Section>

        {/* the assistant */}
        <Section
          icon={<Key className="h-4 w-4" />}
          title="Gemini API key"
          description="the assistant uses your own Google Gemini key. It is stored in your OS keychain and never exported."
        >
          {settings?.has_api_key ? (
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-emerald-500" />
                <span className="font-medium">Key configured</span>
                <code className="text-xs text-fg-subtle">{settings.api_key_preview}</code>
              </div>
              <Button variant="ghost" size="sm" onClick={clearKey}>
                Remove
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your Gemini API key…"
              />
              <Button variant="primary" onClick={saveKey} disabled={savingKey || !apiKey.trim()}>
                {savingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          )}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs text-accent hover:underline"
          >
            Get a free key from Google AI Studio →
          </a>
        </Section>

        {/* Language */}
        <Section
          icon={<Languages className="h-4 w-4" />}
          title="Assistant output language"
          description="Leave blank to let the assistant reply in whatever language you use."
        >
          <Input
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            onBlur={(e) => saveLanguage(e.target.value)}
            placeholder="e.g. English, Español, العربية…"
          />
        </Section>

        {/* WhatsApp */}
        <Section
          icon={<MessageCircle className="h-4 w-4" />}
          title="WhatsApp"
          description="Connect your number to manage todos by message or voice note. The session stays on this device and is never exported."
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                waStatus === "connected"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : waStatus === "connecting"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    : "bg-muted text-fg-subtle",
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {waStatus}
            </span>
            <div className="ml-auto flex gap-2">
              {waStatus === "connected" ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setWaSetupOpen(true)}
                  >
                    Manage
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      useStore
                        .getState()
                        .disconnectWhatsApp()
                        .catch((e) => toast(String(e), "error"))
                    }
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button variant="primary" size="sm" onClick={() => setWaSetupOpen(true)}>
                  {waStatus === "connecting" ? "Continue setup" : "Set up WhatsApp"}
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <div>
              <label className="label-text mb-1 block">Control number</label>
              <Input
                value={waNumber}
                onChange={(e) => setWaNumber(e.target.value)}
                onBlur={saveWaNumber}
                placeholder="e.g. +1 202 555 0142 (blank disables remote commands)"
                inputMode="tel"
              />
              <p className="mt-1.5 text-xs text-fg-subtle">
                the assistant only acts on messages from this number and replies in that chat.
                Message this number (or yourself) from WhatsApp to add tasks, switch
                lists, or ask “show my Work list”.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                disabled={waStatus !== "connected" || !waNumber.trim()}
                onClick={async () => {
                  try {
                    await ipc.waSendTest();
                    toast("Test message sent — check WhatsApp", "success");
                  } catch (e) {
                    toast(String(e), "error");
                  }
                }}
              >
                <MessageCircle className="h-3.5 w-3.5" /> Send test message
              </Button>
              {waStatus !== "connected" && (
                <span className="ml-2 text-xs text-fg-subtle">
                  Connect WhatsApp first to test.
                </span>
              )}
            </div>

            <div>
              <label className="label-text mb-1 block">Default list</label>
              <select
                value={settings?.default_list_id ?? ""}
                onChange={(e) => changeDefaultList(e.target.value || null)}
                className="input cursor-pointer appearance-none pr-8"
              >
                <option value="">Most recently used</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-fg-subtle">
                WhatsApp commands target this list by default. Say “switch to …” to
                change it anytime.
              </p>
            </div>
          </div>
        </Section>

        {/* Voice hotkey */}
        <Section
          icon={<Mic className="h-4 w-4" />}
          title="Voice hotkey"
          description="Hold a global shortcut to talk to the assistant from anywhere — even when Daylattice is in the tray."
        >
          <VoiceHotkeySettings />
        </Section>

        {/* Appearance */}
        <Section icon={<Palette className="h-4 w-4" />} title="Appearance">
          <label className="label-text mb-1 block">Theme</label>
          <div className="flex gap-2">
            {themes.map((t) => (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition",
                  theme === t.value
                    ? "border-accent bg-accent-soft text-fg"
                    : "border-border text-fg-subtle hover:bg-muted",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Startup */}
        <Section icon={<Power className="h-4 w-4" />} title="Startup">
          <button
            onClick={toggleAutostart}
            className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm transition hover:bg-muted"
          >
            <span>
              <span className="font-medium">Open on startup</span>
              <span className="ml-2 text-xs text-fg-subtle">
                Launch Daylattice when you sign in (starts hidden in the tray).
              </span>
            </span>
            <span
              className={cn(
                "relative h-5 w-9 rounded-full transition",
                settings?.autostart_enabled ? "bg-accent" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
                  settings?.autostart_enabled ? "left-[18px]" : "left-0.5",
                )}
              />
            </span>
          </button>
        </Section>

        {/* Data */}
        <Section
          icon={<Database className="h-4 w-4" />}
          title="Backup & data"
          description="Export a .daylattice file (secrets excluded) or import one to restore."
        >
          <div className="flex gap-2">
            <Button variant="secondary" onClick={doExport} className="flex-1">
              <Download className="h-4 w-4" /> Export backup
            </Button>
            <Button variant="secondary" onClick={doImport} className="flex-1">
              <Upload className="h-4 w-4" /> Import backup
            </Button>
          </div>
        </Section>

        <p className="pb-6 text-center text-xs text-fg-subtle">
          Daylattice v0.1.0 · {profile?.name}
        </p>
      </div>

      <WhatsAppSetup open={waSetupOpen} onClose={() => setWaSetupOpen(false)} />
    </div>
  );
}
