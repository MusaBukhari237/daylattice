// Typed wrappers over Tauri's `invoke`. One function per backend command.
// Argument keys match the Rust command parameter names (snake_case).

import { invoke } from "@tauri-apps/api/core";
import type {
  CreateListInput,
  CreateTaskInput,
  Label,
  List,
  MoveTaskInput,
  Priority,
  Profile,
  SamMessage,
  Section,
  Settings,
  Task,
  UpdateListInput,
  UpdateTaskInput,
} from "./types";

// ---- profile ----
export const getProfile = () => invoke<Profile | null>("get_profile");
export const createProfile = (name: string, output_language: string | null) =>
  invoke<Profile>("create_profile", { name, outputLanguage: output_language });
export const completeOnboarding = () => invoke<void>("complete_onboarding");
export const updateProfileName = (name: string) =>
  invoke<Profile>("update_profile", { name });

// ---- lists ----
export const getLists = () => invoke<List[]>("get_lists");
export const createList = (input: CreateListInput) =>
  invoke<List>("create_list", { input });
export const updateList = (input: UpdateListInput) =>
  invoke<List>("update_list", { input });
export const deleteList = (id: string) => invoke<void>("delete_list", { id });
export const reorderLists = (ordered_ids: string[]) =>
  invoke<void>("reorder_lists", { orderedIds: ordered_ids, ordered_ids });

// ---- sections ----
export const getSections = (list_id: string) =>
  invoke<Section[]>("get_sections", { listId: list_id, list_id });
export const createSection = (list_id: string, name: string) =>
  invoke<Section>("create_section", { input: { list_id, name } });
export const updateSection = (id: string, name: string) =>
  invoke<Section>("update_section", { input: { id, name } });
export const deleteSection = (id: string) =>
  invoke<void>("delete_section", { id });
export const reorderSections = (ordered_ids: string[]) =>
  invoke<void>("reorder_sections", { orderedIds: ordered_ids, ordered_ids });

// ---- tasks ----
export const getTasks = (list_id: string) =>
  invoke<Task[]>("get_tasks", { listId: list_id, list_id });
export const createTask = (input: CreateTaskInput) =>
  invoke<Task>("create_task", { input });
export const updateTask = (input: UpdateTaskInput) =>
  invoke<Task>("update_task", { input });
export const deleteTask = (id: string) => invoke<void>("delete_task", { id });
export const moveTask = (input: MoveTaskInput) =>
  invoke<void>("move_task", { input });
export const bulkUpdateTasks = (
  ids: string[],
  priority?: Priority,
  section_id?: string,
) =>
  invoke<number>("bulk_update_tasks", {
    ids,
    priority: priority ?? null,
    sectionId: section_id ?? null,
    section_id: section_id ?? null,
  });

// ---- labels ----
export const getLabels = (list_id: string) =>
  invoke<Label[]>("get_labels", { listId: list_id, list_id });
export const createLabel = (list_id: string, name: string, color?: string) =>
  invoke<Label>("create_label", { input: { list_id, name, color } });
export const updateLabel = (id: string, name?: string, color?: string) =>
  invoke<Label>("update_label", { input: { id, name, color } });
export const deleteLabel = (id: string) => invoke<void>("delete_label", { id });
export const assignLabel = (task_id: string, label_id: string) =>
  invoke<void>("assign_label", {
    taskId: task_id,
    task_id,
    labelId: label_id,
    label_id,
  });
export const unassignLabel = (task_id: string, label_id: string) =>
  invoke<void>("unassign_label", {
    taskId: task_id,
    task_id,
    labelId: label_id,
    label_id,
  });

// ---- settings ----
export const getSettings = () => invoke<Settings>("get_settings");
export const setApiKey = (key: string) => invoke<void>("set_api_key", { key });
export const clearApiKey = () => invoke<void>("clear_api_key");
export const hasApiKey = () => invoke<boolean>("has_api_key");
export const setLanguage = (language: string | null) =>
  invoke<void>("set_language", { language });
export const setTheme = (theme: string) => invoke<void>("set_theme", { theme });
export const getAutostart = () => invoke<boolean>("get_autostart");
export const setAutostart = (enabled: boolean) =>
  invoke<void>("set_autostart", { enabled });
export const setWaControlNumber = (number: string | null) =>
  invoke<void>("set_wa_control_number", { number });
export const setDefaultList = (list_id: string | null) =>
  invoke<void>("set_default_list", { listId: list_id, list_id });
export const getDefaultList = () =>
  invoke<string | null>("get_default_list");

// ---- sam ----
export const getSamMessages = (list_id: string | null) =>
  invoke<SamMessage[]>("get_sam_messages", { listId: list_id, list_id });
export const samTextCommand = (
  list_id: string | null,
  message: string,
  source?: string,
) =>
  invoke<string>("sam_text_command", {
    listId: list_id,
    list_id,
    message,
    source: source ?? "ui",
  });
export const samVoiceCommand = (
  list_id: string | null,
  audio_base64: string,
  mime?: string,
) =>
  invoke<string>("sam_voice_command", {
    listId: list_id,
    list_id,
    audioBase64: audio_base64,
    audio_base64,
    mime: mime ?? "audio/webm",
  });
export const samEnhanceTask = (task_id: string) =>
  invoke<void>("sam_enhance_task", { taskId: task_id, task_id });
export const samTranscribe = (audio_base64: string, mime?: string) =>
  invoke<string>("sam_transcribe", {
    audioBase64: audio_base64,
    audio_base64,
    mime: mime ?? "audio/webm",
  });
export const clearSamMessages = (list_id: string | null) =>
  invoke<void>("clear_sam_messages", { listId: list_id, list_id });

// ---- voice hotkey ----
export const getVoiceSettings = () =>
  invoke<import("./types").VoiceSettings>("get_voice_settings");
export const setVoiceSettings = (shortcut: string, hold_ms: number) =>
  invoke<void>("set_voice_settings", { shortcut, holdMs: hold_ms, hold_ms });

// ---- whatsapp ----
export const waConnect = () => invoke<void>("wa_connect");
export const waDisconnect = () => invoke<void>("wa_disconnect");
export const waStatus = () => invoke<string>("wa_status");
export const waSendTest = () => invoke<void>("wa_send_test");

// ---- backup ----
export const exportBackup = () => invoke<string | null>("export_backup");
export const importBackup = () => invoke<boolean>("import_backup");

// ---- system ----
export const showWindow = () => invoke<void>("show_window");
export const hideWindow = () => invoke<void>("hide_window");
export const quitApp = () => invoke<void>("quit_app");
