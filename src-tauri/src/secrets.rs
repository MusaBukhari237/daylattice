//! OS-keychain storage for the Gemini API key. The raw key never touches the
//! database, an export, or the renderer — only "is a key set" + a masked preview
//! are exposed (see `commands/settings.rs`).

use crate::error::AppResult;
use keyring::Entry;

const SERVICE: &str = "io.github.musabukhari237.daylattice";
const ACCOUNT: &str = "gemini_api_key";

fn entry() -> AppResult<Entry> {
    Ok(Entry::new(SERVICE, ACCOUNT)?)
}

pub fn set_api_key(key: &str) -> AppResult<()> {
    entry()?.set_password(key)?;
    Ok(())
}

pub fn get_api_key() -> Option<String> {
    let e = entry().ok()?;
    match e.get_password() {
        Ok(k) if !k.trim().is_empty() => Some(k),
        _ => None,
    }
}

pub fn clear_api_key() -> AppResult<()> {
    if let Ok(e) = entry() {
        // Deleting a non-existent credential is not an error we care about.
        let _ = e.delete_credential();
    }
    Ok(())
}

pub fn has_api_key() -> bool {
    get_api_key().is_some()
}

/// A masked preview like "AIza…1b2c" for display in Settings.
pub fn masked_preview() -> Option<String> {
    let key = get_api_key()?;
    let n = key.chars().count();
    if n <= 8 {
        return Some("•".repeat(n));
    }
    let head: String = key.chars().take(4).collect();
    let tail: String = key.chars().skip(n - 4).collect();
    Some(format!("{head}…{tail}"))
}
