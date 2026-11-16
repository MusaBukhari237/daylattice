//! Thin async client for the Google Gemini API (model `gemini-2.5-flash`).
//! Requests/responses use `serde_json::Value` to stay flexible against the
//! evolving function-calling shape. The key is passed per-call from the keychain.

use std::time::Duration;

use futures_util::StreamExt;
use serde_json::{json, Value};

use crate::error::{AppError, AppResult};

const MODEL: &str = "gemini-2.5-flash";
const BASE: &str = "https://generativelanguage.googleapis.com/v1beta/models";

fn client() -> AppResult<reqwest::Client> {
    Ok(reqwest::Client::builder()
        .user_agent("Daylattice/0.1")
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(120))
        .build()?)
}

/// POST JSON with a few retries on transport errors (DNS/TLS/reset/timeout),
/// which surface as reqwest "error sending request" and are often transient.
async fn post_with_retry(
    client: &reqwest::Client,
    url: &str,
    api_key: &str,
    body: &Value,
) -> AppResult<reqwest::Response> {
    let mut key = reqwest::header::HeaderValue::from_str(api_key)
        .map_err(|_| AppError::msg("Invalid Gemini API key format."))?;
    key.set_sensitive(true);
    let mut last: Option<reqwest::Error> = None;
    for attempt in 0..3 {
        match client.post(url).header("x-goog-api-key", key.clone()).json(body).send().await {
            Ok(resp) => return Ok(resp),
            Err(e) => {
                let e = e.without_url();
                log::warn!("Gemini request attempt {} failed: {e}", attempt + 1);
                last = Some(e);
                tokio::time::sleep(Duration::from_millis(500 * (attempt + 1))).await;
            }
        }
    }
    Err(AppError::Http(last.expect("retry loop ran at least once")))
}

fn system_instruction(text: &str) -> Value {
    json!({ "parts": [{ "text": text }] })
}

/// One non-streaming generation. Returns the first candidate's `content` object
/// (with its `parts`), which may contain text and/or `functionCall` parts.
pub async fn generate(
    api_key: &str,
    system: &str,
    contents: &Value,
    tools: Option<&Value>,
) -> AppResult<Value> {
    let url = format!("{BASE}/{MODEL}:generateContent");
    let mut body = json!({
        "systemInstruction": system_instruction(system),
        "contents": contents,
        "generationConfig": { "temperature": 0.4 }
    });
    if let Some(tools) = tools {
        body["tools"] = tools.clone();
        body["toolConfig"] = json!({ "functionCallingConfig": { "mode": "AUTO" } });
    }

    let resp = post_with_retry(&client()?, &url, api_key, &body).await?;
    let status = resp.status();
    if !status.is_success() {
        return Err(status_error(status));
    }
    let value: Value = resp.json().await?;

    let content = value
        .get("candidates")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("content"))
        .cloned()
        .unwrap_or_else(|| json!({ "role": "model", "parts": [] }));
    Ok(content)
}

/// Streaming generation. Invokes `on_token` for each text delta and returns the
/// fully accumulated text. Tools are intentionally not passed here — this is the
/// final natural-language turn.
pub async fn stream<F>(
    api_key: &str,
    system: &str,
    contents: &Value,
    mut on_token: F,
) -> AppResult<String>
where
    F: FnMut(&str),
{
    let url = format!("{BASE}/{MODEL}:streamGenerateContent?alt=sse");
    let body = json!({
        "systemInstruction": system_instruction(system),
        "contents": contents,
        "generationConfig": { "temperature": 0.6 }
    });

    let resp = post_with_retry(&client()?, &url, api_key, &body).await?;
    if !resp.status().is_success() {
        let status = resp.status();
        return Err(status_error(status));
    }

    let mut acc = String::new();
    let mut buf = Vec::new();
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        extend_stream(&mut buf, &chunk?, &mut acc, &mut on_token);
    }
    consume_frame(&buf, &mut acc, &mut on_token);
    Ok(acc)
}

fn status_error(status: reqwest::StatusCode) -> AppError {
    let detail = match status.as_u16() {
        400 => "Check the request and model configuration.",
        401 | 403 => "Check your Gemini API key and its permissions.",
        429 => "The Gemini quota or rate limit was reached.",
        500..=599 => "Gemini is temporarily unavailable.",
        _ => "Gemini rejected the request.",
    };
    AppError::msg(format!("Gemini ({status}): {detail}"))
}

fn extend_stream(buf: &mut Vec<u8>, chunk: &[u8], acc: &mut String, on_token: &mut impl FnMut(&str)) {
    buf.extend_from_slice(chunk);
    let mut consumed = 0;
    while let Some(end) = buf[consumed..].iter().position(|&b| b == b'\n') {
        let end = consumed + end;
        consume_frame(&buf[consumed..end], acc, on_token);
        consumed = end + 1;
    }
    buf.drain(..consumed);
}

fn consume_frame(frame: &[u8], acc: &mut String, on_token: &mut impl FnMut(&str)) {
    let Ok(line) = std::str::from_utf8(frame) else { return };
    let Some(payload) = line.trim().strip_prefix("data:") else { return };
    let Ok(value) = serde_json::from_str::<Value>(payload.trim()) else { return };
    for text in value["candidates"][0]["content"]["parts"].as_array().into_iter().flatten()
        .filter_map(|part| part["text"].as_str())
    {
        acc.push_str(text);
        on_token(text);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn streaming_keeps_multibyte_characters_across_chunks() {
        let data = "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\" café \"}]}}]}\r\n";
        let cut = data.find('é').unwrap() + 1;
        let mut buffer = Vec::new();
        let mut result = String::new();
        let mut events = Vec::new();
        let mut on_token = |text: &str| events.push(text.to_owned());
        extend_stream(&mut buffer, &data.as_bytes()[..cut], &mut result, &mut on_token);
        assert!(result.is_empty());
        extend_stream(&mut buffer, &data.as_bytes()[cut..], &mut result, &mut on_token);
        assert_eq!(result, " café ");
        assert_eq!(events, vec![" café "]);
        assert!(buffer.is_empty());
    }
}

/// Extract any `functionCall` parts from a model `content` object.
pub fn function_calls(content: &Value) -> Vec<Value> {
    content
        .get("parts")
        .and_then(|p| p.as_array())
        .map(|parts| {
            parts
                .iter()
                .filter_map(|p| p.get("functionCall").cloned())
                .collect()
        })
        .unwrap_or_default()
}

/// Concatenate any text parts from a model `content` object.
pub fn text_of(content: &Value) -> String {
    content
        .get("parts")
        .and_then(|p| p.as_array())
        .map(|parts| {
            parts
                .iter()
                .filter_map(|p| p.get("text").and_then(|t| t.as_str()))
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_default()
}

/// A single audio clip transcription/interpretation helper for voice commands.
/// Returns Gemini's textual understanding of the audio (used as the user turn).
pub async fn transcribe(api_key: &str, mime: &str, audio_b64: &str) -> AppResult<String> {
    let url = format!("{BASE}/{MODEL}:generateContent");
    let body = json!({
        "contents": [{
            "role": "user",
            "parts": [
                { "text": "Transcribe the following audio verbatim. Reply with only the transcription text, no commentary." },
                { "inlineData": { "mimeType": mime, "data": audio_b64 } }
            ]
        }]
    });
    let resp = post_with_retry(&client()?, &url, api_key, &body).await?;
    let status = resp.status();
    if !status.is_success() {
        return Err(status_error(status));
    }
    let value: Value = resp.json().await?;
    let content = value
        .get("candidates")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("content"))
        .cloned()
        .unwrap_or(json!({}));
    Ok(text_of(&content).trim().to_string())
}
