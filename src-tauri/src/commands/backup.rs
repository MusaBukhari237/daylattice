//! Backup export/import. A `.daylattice` file is a zip containing `data.json` with
//! every exportable table. Secrets (Gemini key, WhatsApp session) live outside
//! the DB and are therefore impossible to include here.

use std::io::{Read, Write};

use rusqlite::types::Value as SqlValue;
use rusqlite::Connection;
use serde_json::{json, Map, Value};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::commands::emit_data_changed;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

const MAX_BACKUP_BYTES: u64 = 32 * 1024 * 1024;
const TABLES: &[&str] = &[
    "profile",
    "lists",
    "sections",
    "tasks",
    "labels",
    "task_labels",
    "sam_messages",
];

/// Read every row of `table` into JSON objects keyed by column name.
fn dump_table(conn: &Connection, table: &str) -> AppResult<Vec<Value>> {
    let mut stmt = conn.prepare(&format!("SELECT * FROM {table}"))?;
    let col_names: Vec<String> = stmt.column_names().map(str::to_owned).collect();
    let rows = stmt.query_map([], |row| {
        let mut obj = Map::new();
        for (i, name) in col_names.iter().enumerate() {
            if table == "profile" && name == "wa_control_number" { continue; }
            let v: SqlValue = row.get(i)?;
            obj.insert(name.clone(), sql_to_json(v));
        }
        Ok(Value::Object(obj))
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn sql_to_json(v: SqlValue) -> Value {
    match v {
        SqlValue::Null => Value::Null,
        SqlValue::Integer(i) => json!(i),
        SqlValue::Real(f) => json!(f),
        SqlValue::Text(s) => Value::String(s),
        SqlValue::Blob(b) => Value::String(base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            b,
        )),
    }
}

fn json_to_sql(v: &Value) -> SqlValue {
    match v {
        Value::Null => SqlValue::Null,
        Value::Bool(b) => SqlValue::Integer(if *b { 1 } else { 0 }),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                SqlValue::Integer(i)
            } else {
                SqlValue::Real(n.as_f64().unwrap_or(0.0))
            }
        }
        Value::String(s) => SqlValue::Text(s.clone()),
        // Nested arrays/objects (none expected from our schema) are stored as JSON text.
        other => SqlValue::Text(other.to_string()),
    }
}

#[tauri::command]
pub fn export_backup(app: AppHandle, state: State<AppState>) -> AppResult<Option<String>> {
    // Build the JSON payload first (short lock).
    let payload = {
        let conn = state.db.lock().unwrap();
        let mut data = Map::new();
        for table in TABLES {
            data.insert((*table).to_string(), Value::Array(dump_table(&conn, table)?));
        }
        json!({
            "format": "daylattice-backup",
            "version": 1,
            "exported_at": crate::db::now(),
            "tables": data
        })
    };

    let Some(file_path) = app
        .dialog()
        .file()
        .add_filter("Daylattice backup", &["daylattice"])
        .set_file_name("daylattice-backup.daylattice")
        .blocking_save_file()
    else {
        return Ok(None); // user cancelled
    };
    let path = file_path
        .into_path()
        .map_err(|e| AppError::msg(format!("invalid path: {e}")))?;

    let data = serde_json::to_vec_pretty(&payload)?;
    if data.len() as u64 > MAX_BACKUP_BYTES {
        return Err(AppError::msg("backup data exceeds 32 MiB"));
    }
    let file = std::fs::File::create(&path)?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    zip.start_file("data.json", options)?;
    zip.write_all(&data)?;
    zip.finish()?;

    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn import_backup(app: AppHandle, state: State<AppState>) -> AppResult<bool> {
    let Some(file_path) = app
        .dialog()
        .file()
        .add_filter("Task backups", &["daylattice", "samara"])
        .blocking_pick_file()
    else {
        return Ok(false); // user cancelled
    };
    let path = file_path
        .into_path()
        .map_err(|e| AppError::msg(format!("invalid path: {e}")))?;

    // Read data.json out of the zip.
    let file = std::fs::File::open(&path)?;
    let mut archive = zip::ZipArchive::new(file)?;
    let entry = archive
        .by_name("data.json")
        .map_err(|_| AppError::msg("invalid backup: missing data.json"))?;
    if entry.size() > MAX_BACKUP_BYTES {
        return Err(AppError::msg("backup data exceeds 32 MiB"));
    }
    let mut buf = String::new();
    entry.take(MAX_BACKUP_BYTES + 1).read_to_string(&mut buf)?;
    if buf.len() as u64 > MAX_BACKUP_BYTES {
        return Err(AppError::msg("backup data exceeds 32 MiB"));
    }
    let payload: Value = serde_json::from_str(&buf)?;
    restore_payload(&mut state.db.lock().unwrap(), &payload)?;
    emit_data_changed(&app);
    Ok(true)
}

fn restore_payload(conn: &mut Connection, payload: &Value) -> AppResult<()> {
    if !matches!(payload.get("format").and_then(Value::as_str), Some("daylattice-backup" | "samara-backup"))
        || payload.get("version").and_then(Value::as_u64) != Some(1)
    {
        return Err(AppError::msg("unsupported backup format or version"));
    }
    let tables = payload.get("tables").and_then(Value::as_object)
        .ok_or_else(|| AppError::msg("backup is missing its tables"))?;
    let tx = conn.transaction()?;
    for table in TABLES.iter().rev() {
        tx.execute(&format!("DELETE FROM {table}"), [])?;
    }
    for &table in TABLES {
        let rows = tables.get(table).and_then(Value::as_array)
            .ok_or_else(|| AppError::msg(format!("backup missing table {table}")))?;
        let columns: std::collections::HashSet<String> = {
            let mut stmt = tx.prepare("SELECT name FROM pragma_table_info(?1)")?;
            let result = stmt.query_map([table], |row| row.get(0))?
                .collect::<Result<_, _>>()?;
            result
        };
        for row in rows {
            let obj = row.as_object().filter(|row| !row.is_empty())
                .ok_or_else(|| AppError::msg(format!("invalid row in {table}")))?;
            if obj.keys().any(|name| !columns.contains(name)) {
                return Err(AppError::msg(format!("unrecognized column in {table}")));
            }
            let columns_to_insert = obj.iter().filter(|(name, _)| table != "profile" || name.as_str() != "wa_control_number");
            let names = columns_to_insert.clone().map(|(name, _)| format!("\"{}\"", name.replace('"', "\"\"")))
                .collect::<Vec<_>>().join(", ");
            let placeholders = vec!["?"; columns_to_insert.clone().count()].join(", ");
            let sql = format!("INSERT INTO {table} ({names}) VALUES ({placeholders})");
            tx.execute(&sql, rusqlite::params_from_iter(columns_to_insert.map(|(_, value)| json_to_sql(value))))?;
        }
    }
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn malformed_import_leaves_existing_data_intact() {
        let mut conn = crate::db::open_in_memory().unwrap();
        conn.execute("INSERT INTO profile (id, name, created_at) VALUES (1, 'Keep this', '2026-01-01')", []).unwrap();
        let mut tables: Map<String, Value> = TABLES.iter().map(|&table| (table.to_string(), json!([]))).collect();
        tables.insert("profile".to_string(), json!([{"id":1,"name":"Replacement","created_at":"2026-01-01"}]));
        tables.insert("lists".to_string(), json!([{"unexpected) SELECT 1 --":"test"}]));
        let payload = json!({"format":"daylattice-backup","version":1,"tables":tables});
        assert!(restore_payload(&mut conn, &payload).is_err());
        let name: String = conn.query_row("SELECT name FROM profile", [], |row| row.get(0)).unwrap();
        assert_eq!(name,"Keep this");
    }

    #[test]
    fn accepts_compatible_version_one_backups() {
        let mut conn = crate::db::open_in_memory().unwrap();
        let mut tables: Map<String, Value> = TABLES.iter().map(|&table| (table.to_string(), json!([]))).collect();
        tables.insert("profile".to_string(), json!([{"id":1,"name":"Example profile","created_at":"2026-01-01"}]));
        let payload = json!({"format":"samara-backup","version":1,"tables":tables});
        restore_payload(&mut conn, &payload).unwrap();
        let count: i64 = conn.query_row("SELECT count(*) FROM profile", [], |row| row.get(0)).unwrap();
        assert_eq!(count,1);
    }
}
