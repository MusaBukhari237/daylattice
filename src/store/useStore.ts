import { create } from "zustand";
import * as ipc from "@/lib/ipc";
import type {
  CreateTaskInput,
  Label,
  List,
  Priority,
  Profile,
  SamMessage,
  Section,
  Settings,
  Task,
  Theme,
  WaStatus,
} from "@/lib/types";

type View = "kanban" | "table";
type Route = "list" | "settings";

interface StoreState {
  booted: boolean;
  profile: Profile | null;
  lists: List[];
  activeListId: string | null;

  sections: Section[];
  tasks: Task[];
  labels: Label[];

  settings: Settings | null;

  view: View;
  route: Route;
  theme: Theme;
  sidebarCollapsed: boolean;
  samOpen: boolean;
  drawerTaskId: string | null;
  listSettingsId: string | null;

  samMessages: SamMessage[];
  samStreaming: string;
  samBusy: boolean;
  samTranscript: string | null;

  // whatsapp
  waStatus: WaStatus;
  waQr: string | null;

  // lifecycle
  boot: () => Promise<void>;
  applyTheme: (theme: Theme) => void;
  setTheme: (theme: Theme) => Promise<void>;

  // lists
  refreshLists: () => Promise<void>;
  selectList: (id: string) => Promise<void>;
  refreshActiveList: () => Promise<void>;
  createList: (name: string, knowledge?: string, color?: string) => Promise<List>;
  updateActiveListMeta: (patch: {
    name?: string;
    knowledge?: string;
    color?: string;
  }) => Promise<void>;
  deleteList: (id: string) => Promise<void>;

  // sections
  createSection: (name: string) => Promise<void>;
  renameSection: (id: string, name: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;

  // tasks
  addTask: (input: Omit<CreateTaskInput, "list_id">) => Promise<void>;
  patchTask: (
    id: string,
    patch: Partial<
      Pick<Task, "title" | "description" | "priority" | "due_date" | "section_id">
    >,
  ) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  moveTask: (id: string, section_id: string, position: number) => Promise<void>;
  bulkUpdate: (
    ids: string[],
    priority?: Priority,
    section_id?: string,
  ) => Promise<void>;

  // labels
  createLabel: (name: string, color?: string) => Promise<void>;
  deleteLabel: (id: string) => Promise<void>;
  toggleLabel: (task_id: string, label_id: string) => Promise<void>;

  // ui
  setView: (view: View) => void;
  setRoute: (route: Route) => void;
  toggleSidebar: () => void;
  toggleSam: () => void;
  openDrawer: (taskId: string) => void;
  closeDrawer: () => void;
  openListSettings: (id: string) => void;
  closeListSettings: () => void;

  // settings
  refreshSettings: () => Promise<void>;

  // whatsapp
  setWaStatus: (status: WaStatus) => void;
  setWaQr: (qr: string | null) => void;
  connectWhatsApp: () => Promise<void>;
  disconnectWhatsApp: () => Promise<void>;

  // sam
  loadSamMessages: () => Promise<void>;
  sendSamText: (message: string) => Promise<void>;
  sendSamVoice: (audioBase64: string, mime: string) => Promise<void>;
  appendSamToken: (text: string) => void;
  setSamTranscript: (text: string) => void;
  finishSam: () => Promise<void>;
  clearSam: () => Promise<void>;
}

const prefersDark = () =>
  window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;

export const useStore = create<StoreState>((set, get) => ({
  booted: false,
  profile: null,
  lists: [],
  activeListId: null,
  sections: [],
  tasks: [],
  labels: [],
  settings: null,
  view: "kanban",
  route: "list",
  theme: "light",
  sidebarCollapsed: false,
  samOpen: window.innerWidth >= 1440,
  drawerTaskId: null,
  listSettingsId: null,
  samMessages: [],
  samStreaming: "",
  samBusy: false,
  samTranscript: null,
  waStatus: "disconnected",
  waQr: null,

  boot: async () => {
    const profile = await ipc.getProfile();
    const theme = (profile?.theme as Theme) ?? "light";
    get().applyTheme(theme);
    set({ profile, theme });

    if (profile?.onboarded) {
      const lists = await ipc.getLists();
      set({ lists });
      await get().refreshSettings();
      if (lists.length > 0) {
        // Prefer the persisted default list, fall back to the first.
        const defaultId = await ipc.getDefaultList().catch(() => null);
        const target = lists.find((l) => l.id === defaultId)?.id ?? lists[0].id;
        await get().selectList(target);
      }
    }
    set({ booted: true });
  },

  applyTheme: (theme) => {
    const dark = theme === "dark" || (theme === "system" && prefersDark());
    document.documentElement.classList.toggle("dark", dark);
  },

  setTheme: async (theme) => {
    get().applyTheme(theme);
    set({ theme });
    await ipc.setTheme(theme);
    if (get().profile) set({ profile: { ...get().profile!, theme } });
  },

  refreshLists: async () => {
    const lists = await ipc.getLists();
    set({ lists });
  },

  selectList: async (id) => {
    set({ activeListId: id, route: "list" });
    await get().refreshActiveList();
    await get().loadSamMessages();
  },

  refreshActiveList: async () => {
    const id = get().activeListId;
    if (!id) {
      set({ sections: [], tasks: [], labels: [] });
      return;
    }
    const [sections, tasks, labels] = await Promise.all([
      ipc.getSections(id),
      ipc.getTasks(id),
      ipc.getLabels(id),
    ]);
    set({ sections, tasks, labels });
  },

  createList: async (name, knowledge, color) => {
    const list = await ipc.createList({ name, knowledge, color });
    await get().refreshLists();
    await get().selectList(list.id);
    return list;
  },

  updateActiveListMeta: async (patch) => {
    const id = get().listSettingsId ?? get().activeListId;
    if (!id) return;
    await ipc.updateList({ id, ...patch });
    await get().refreshLists();
  },

  deleteList: async (id) => {
    await ipc.deleteList(id);
    await get().refreshLists();
    const remaining = get().lists;
    if (get().activeListId === id) {
      if (remaining.length > 0) await get().selectList(remaining[0].id);
      else set({ activeListId: null, sections: [], tasks: [], labels: [] });
    }
  },

  createSection: async (name) => {
    const id = get().activeListId;
    if (!id) return;
    await ipc.createSection(id, name);
    await get().refreshActiveList();
  },

  renameSection: async (id, name) => {
    await ipc.updateSection(id, name);
    await get().refreshActiveList();
  },

  deleteSection: async (id) => {
    await ipc.deleteSection(id);
    await get().refreshActiveList();
  },

  addTask: async (input) => {
    const list_id = get().activeListId;
    if (!list_id) return;
    await ipc.createTask({ ...input, list_id });
    await get().refreshActiveList();
  },

  patchTask: async (id, patch) => {
    // Optimistic update for snappy editing.
    set({
      tasks: get().tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
    await ipc.updateTask({ id, ...patch });
  },

  removeTask: async (id) => {
    set({ tasks: get().tasks.filter((t) => t.id !== id), drawerTaskId: null });
    await ipc.deleteTask(id);
  },

  moveTask: async (id, section_id, position) => {
    // Optimistic: reflect the move locally before the round-trip.
    set({
      tasks: get().tasks.map((t) =>
        t.id === id ? { ...t, section_id, position } : t,
      ),
    });
    await ipc.moveTask({ id, section_id, position });
    await get().refreshActiveList();
  },

  bulkUpdate: async (ids, priority, section_id) => {
    await ipc.bulkUpdateTasks(ids, priority, section_id);
    await get().refreshActiveList();
  },

  createLabel: async (name, color) => {
    const id = get().activeListId;
    if (!id) return;
    await ipc.createLabel(id, name, color);
    await get().refreshActiveList();
  },

  deleteLabel: async (id) => {
    await ipc.deleteLabel(id);
    await get().refreshActiveList();
  },

  toggleLabel: async (task_id, label_id) => {
    const task = get().tasks.find((t) => t.id === task_id);
    const has = task?.label_ids.includes(label_id);
    if (has) await ipc.unassignLabel(task_id, label_id);
    else await ipc.assignLabel(task_id, label_id);
    await get().refreshActiveList();
  },

  setView: (view) => set({ view }),
  setRoute: (route) => set({ route }),
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
  toggleSam: () => set({ samOpen: !get().samOpen }),
  openDrawer: (taskId) => set({ drawerTaskId: taskId }),
  closeDrawer: () => set({ drawerTaskId: null }),
  openListSettings: (id) => set({ listSettingsId: id }),
  closeListSettings: () => set({ listSettingsId: null }),

  refreshSettings: async () => {
    const settings = await ipc.getSettings();
    set({ settings });
    // Keep the live WA status in sync when we don't already have a stronger
    // signal from events (avoid downgrading a freshly "connecting" state).
    const current = get().waStatus;
    const fromSettings = (settings.wa_status as WaStatus) ?? "disconnected";
    if (current === "disconnected" || fromSettings === "connected") {
      set({ waStatus: fromSettings });
    }
  },

  setWaStatus: (status) =>
    set({ waStatus: status, waQr: status === "connected" ? null : get().waQr }),
  setWaQr: (qr) => set({ waQr: qr }),

  connectWhatsApp: async () => {
    set({ waStatus: "connecting", waQr: null });
    await ipc.waConnect();
  },

  disconnectWhatsApp: async () => {
    await ipc.waDisconnect();
    set({ waStatus: "disconnected", waQr: null });
  },

  loadSamMessages: async () => {
    const messages = await ipc.getSamMessages(get().activeListId);
    set({ samMessages: messages });
  },

  sendSamText: async (message) => {
    const list_id = get().activeListId;
    const optimistic: SamMessage = {
      id: `tmp-${Date.now()}`,
      list_id,
      role: "user",
      content: message,
      source: "ui",
      created_at: new Date().toISOString(),
    };
    set({
      samMessages: [...get().samMessages, optimistic],
      samBusy: true,
      samStreaming: "",
      samTranscript: null,
    });
    try {
      await ipc.samTextCommand(list_id, message);
    } catch (e) {
      set({
        samStreaming: "",
        samBusy: false,
        samMessages: [
          ...get().samMessages,
          {
            id: `err-${Date.now()}`,
            list_id,
            role: "sam",
            content: String(e),
            source: "ui",
            created_at: new Date().toISOString(),
          },
        ],
      });
    }
  },

  sendSamVoice: async (audioBase64, mime) => {
    const list_id = get().activeListId;
    set({ samBusy: true, samStreaming: "", samTranscript: null });
    try {
      await ipc.samVoiceCommand(list_id, audioBase64, mime);
    } catch (e) {
      set({
        samBusy: false,
        samStreaming: "",
        samMessages: [
          ...get().samMessages,
          {
            id: `err-${Date.now()}`,
            list_id,
            role: "sam",
            content: String(e),
            source: "voice",
            created_at: new Date().toISOString(),
          },
        ],
      });
    }
  },

  appendSamToken: (text) => set({ samStreaming: get().samStreaming + text }),

  setSamTranscript: (text) => {
    const list_id = get().activeListId;
    set({
      samTranscript: text,
      samMessages: [
        ...get().samMessages,
        {
          id: `tmp-v-${Date.now()}`,
          list_id,
          role: "user",
          content: text,
          source: "voice",
          created_at: new Date().toISOString(),
        },
      ],
    });
  },

  finishSam: async () => {
    set({ samBusy: false, samStreaming: "" });
    await get().loadSamMessages();
  },

  clearSam: async () => {
    await ipc.clearSamMessages(get().activeListId);
    set({ samMessages: [], samStreaming: "" });
  },
}));
