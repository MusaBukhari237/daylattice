//! Serde models mirrored on the TypeScript side in `src/lib/types.ts`.
//! These map 1:1 to rows in the SQLite schema (see `migrations/001_init.sql`).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub output_language: Option<String>,
    pub theme: String,
    pub onboarded: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct List {
    pub id: String,
    pub name: String,
    pub knowledge: String,
    pub color: String,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Section {
    pub id: String,
    pub list_id: String,
    pub name: String,
    pub position: i64,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub list_id: String,
    pub section_id: String,
    pub title: String,
    pub description: String,
    pub priority: String,
    pub due_date: Option<String>,
    pub position: i64,
    pub ai_enhanced: bool,
    pub ai_metadata: Option<serde_json::Value>,
    pub created_at: String,
    pub updated_at: String,
    /// Hydrated on read: ids of labels assigned to this task.
    #[serde(default)]
    pub label_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Label {
    pub id: String,
    pub list_id: String,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SamMessage {
    pub id: String,
    pub list_id: Option<String>,
    pub role: String,
    pub content: String,
    pub source: String,
    pub created_at: String,
}

/// Public settings surface for the frontend. Never contains the raw API key —
/// only whether one is configured and a masked preview.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub name: String,
    pub output_language: Option<String>,
    pub theme: String,
    pub has_api_key: bool,
    pub api_key_preview: Option<String>,
    pub autostart_enabled: bool,
    pub wa_status: String,
    pub wa_control_number: Option<String>,
    pub default_list_id: Option<String>,
}

// ---- Inputs (payloads from the frontend) ----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceSettings {
    pub shortcut: String,
    pub hold_ms: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateListInput {
    pub name: String,
    pub knowledge: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateListInput {
    pub id: String,
    pub name: Option<String>,
    pub knowledge: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateSectionInput {
    pub list_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateSectionInput {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateTaskInput {
    pub list_id: String,
    pub section_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub due_date: Option<String>,
    /// When true (and a key + enhancement are available) the assistant will auto-enhance.
    #[serde(default)]
    pub enhance: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateTaskInput {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub due_date: Option<Option<String>>,
    pub section_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MoveTaskInput {
    pub id: String,
    pub section_id: String,
    pub position: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateLabelInput {
    pub list_id: String,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateLabelInput {
    pub id: String,
    pub name: Option<String>,
    pub color: Option<String>,
}
