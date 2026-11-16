//! Newline-delimited JSON protocol spoken with the Node (Baileys) sidecar over
//! stdio. `Inbound` = sidecar → Rust; `Outbound` = Rust → sidecar.

use serde::{Deserialize, Serialize};

/// Messages received from the sidecar on its stdout.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Inbound {
    /// A QR code (as a data-url PNG) to display for pairing.
    Qr { data: String },
    /// Connection status changed.
    Status { status: String },
    /// An incoming WhatsApp message.
    Message {
        from: String,
        #[serde(default)]
        text: String,
        #[serde(default, rename = "audioBase64")]
        audio_base64: Option<String>,
        #[serde(default)]
        mime: Option<String>,
    },
    /// Diagnostic log line from the sidecar.
    Log { message: String },
}

/// Messages sent to the sidecar on its stdin.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Outbound {
    Connect,
    Disconnect,
    Send { to: String, text: String },
}

impl Outbound {
    /// Serialize as a single newline-terminated JSON line.
    pub fn to_line(&self) -> Vec<u8> {
        let mut s = serde_json::to_string(self).unwrap_or_default();
        s.push('\n');
        s.into_bytes()
    }
}
