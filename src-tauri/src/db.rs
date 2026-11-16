//! SQLite connection setup, migrations, and shared row-mapping helpers.

use std::path::Path;

use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};

use crate::models::{Label, List, Profile, SamMessage, Section, Task};

/// Current UTC timestamp as an RFC-3339 string (used for created/updated_at).
pub fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// Embedded migrations. Add new `M::up(...)` entries (never edit old ones).
fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("../migrations/001_init.sql")),
        M::up(include_str!("../migrations/002_voice.sql")),
        M::up(include_str!("../migrations/003_wa.sql")),
    ])
}

/// Open (or create) the database at `path`, apply pragmas and migrations.
pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    let mut conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;

    migrations()
        .to_latest(&mut conn)
        .expect("database migration failed");

    Ok(conn)
}

/// Open an in-memory database (used by unit tests).
#[cfg(test)]
pub fn open_in_memory() -> rusqlite::Result<Connection> {
    let mut conn = Connection::open_in_memory()?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    migrations().to_latest(&mut conn).unwrap();
    Ok(conn)
}

// ---- Row mappers (kept here so every command maps rows identically) ----

pub fn map_profile(row: &rusqlite::Row) -> rusqlite::Result<Profile> {
    Ok(Profile {
        id: row.get("id")?,
        name: row.get("name")?,
        output_language: row.get("output_language")?,
        theme: row.get("theme")?,
        onboarded: row.get::<_, i64>("onboarded")? != 0,
        created_at: row.get("created_at")?,
    })
}

pub fn map_list(row: &rusqlite::Row) -> rusqlite::Result<List> {
    Ok(List {
        id: row.get("id")?,
        name: row.get("name")?,
        knowledge: row.get("knowledge")?,
        color: row.get("color")?,
        position: row.get("position")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn map_section(row: &rusqlite::Row) -> rusqlite::Result<Section> {
    Ok(Section {
        id: row.get("id")?,
        list_id: row.get("list_id")?,
        name: row.get("name")?,
        position: row.get("position")?,
        is_default: row.get::<_, i64>("is_default")? != 0,
    })
}

pub fn map_task(row: &rusqlite::Row) -> rusqlite::Result<Task> {
    let ai_metadata: Option<String> = row.get("ai_metadata")?;
    Ok(Task {
        id: row.get("id")?,
        list_id: row.get("list_id")?,
        section_id: row.get("section_id")?,
        title: row.get("title")?,
        description: row.get("description")?,
        priority: row.get("priority")?,
        due_date: row.get("due_date")?,
        position: row.get("position")?,
        ai_enhanced: row.get::<_, i64>("ai_enhanced")? != 0,
        ai_metadata: ai_metadata.and_then(|s| serde_json::from_str(&s).ok()),
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        label_ids: Vec::new(),
    })
}

pub fn map_label(row: &rusqlite::Row) -> rusqlite::Result<Label> {
    Ok(Label {
        id: row.get("id")?,
        list_id: row.get("list_id")?,
        name: row.get("name")?,
        color: row.get("color")?,
    })
}

pub fn map_sam_message(row: &rusqlite::Row) -> rusqlite::Result<SamMessage> {
    Ok(SamMessage {
        id: row.get("id")?,
        list_id: row.get("list_id")?,
        role: row.get("role")?,
        content: row.get("content")?,
        source: row.get("source")?,
        created_at: row.get("created_at")?,
    })
}

/// Attach assigned label ids to a list of tasks (single extra query).
pub fn hydrate_labels(conn: &Connection, tasks: &mut [Task]) -> rusqlite::Result<()> {
    use std::collections::HashMap;
    let mut by_task: HashMap<String, Vec<String>> = HashMap::new();
    let mut stmt = conn.prepare("SELECT task_id, label_id FROM task_labels")?;
    let rows = stmt.query_map([], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
    })?;
    for r in rows {
        let (task_id, label_id) = r?;
        by_task.entry(task_id).or_default().push(label_id);
    }
    for t in tasks.iter_mut() {
        if let Some(ids) = by_task.remove(&t.id) {
            t.label_ids = ids;
        }
    }
    Ok(())
}

/// Seed the three default sections for a freshly created list.
pub fn seed_default_sections(conn: &Connection, list_id: &str) -> rusqlite::Result<()> {
    let defaults = ["New", "In Progress", "Done"];
    for (i, name) in defaults.iter().enumerate() {
        conn.execute(
            "INSERT INTO sections (id, list_id, name, position, is_default)
             VALUES (?1, ?2, ?3, ?4, 1)",
            rusqlite::params![uuid::Uuid::new_v4().to_string(), list_id, name, i as i64],
        )?;
    }
    Ok(())
}
