// Shared types that mirror the Rust models in `src-tauri/src/models.rs`.

export type Priority = "none" | "low" | "med" | "high" | "urgent";

export type Theme = "light" | "dark" | "system";

export type WaStatus = "disconnected" | "connecting" | "connected";

export type SamSource = "ui" | "voice" | "whatsapp";

export interface Profile {
  id: string;
  name: string;
  output_language: string | null;
  theme: string;
  onboarded: boolean;
  created_at: string;
}

export interface List {
  id: string;
  name: string;
  knowledge: string;
  color: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: string;
  list_id: string;
  name: string;
  position: number;
  is_default: boolean;
}

export interface Task {
  id: string;
  list_id: string;
  section_id: string;
  title: string;
  description: string;
  priority: Priority;
  due_date: string | null;
  position: number;
  ai_enhanced: boolean;
  ai_metadata: unknown | null;
  created_at: string;
  updated_at: string;
  label_ids: string[];
}

export interface Label {
  id: string;
  list_id: string;
  name: string;
  color: string;
}

export interface SamMessage {
  id: string;
  list_id: string | null;
  role: "user" | "sam";
  content: string;
  source: SamSource;
  created_at: string;
}

export interface VoiceSettings {
  shortcut: string;
  hold_ms: number;
}

export interface Settings {
  name: string;
  output_language: string | null;
  theme: string;
  has_api_key: boolean;
  api_key_preview: string | null;
  autostart_enabled: boolean;
  wa_status: string;
  wa_control_number: string | null;
  default_list_id: string | null;
}

// ---- Command input payloads ----

export interface CreateListInput {
  name: string;
  knowledge?: string;
  color?: string;
}

export interface UpdateListInput {
  id: string;
  name?: string;
  knowledge?: string;
  color?: string;
}

export interface CreateTaskInput {
  list_id: string;
  section_id?: string;
  title: string;
  description?: string;
  priority?: Priority;
  due_date?: string | null;
  enhance?: boolean;
}

export interface UpdateTaskInput {
  id: string;
  title?: string;
  description?: string;
  priority?: Priority;
  due_date?: string | null;
  section_id?: string;
}

export interface MoveTaskInput {
  id: string;
  section_id: string;
  position: number;
}
