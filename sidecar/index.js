// Daylattice WhatsApp sidecar.
//
// Speaks newline-delimited JSON with the Rust core over stdio:
//   Rust -> us  (stdin):  {"type":"connect"} | {"type":"disconnect"} | {"type":"send","to","text"}
//   us -> Rust (stdout):  {"type":"qr","data"} | {"type":"status","status"} |
//                         {"type":"message","from","text","audioBase64?","mime?"} |
//                         {"type":"log","message"}
//
// IMPORTANT: stdout carries the protocol only. All diagnostics go to stderr so we
// never corrupt the JSON stream.

import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  downloadMediaMessage,
  Browsers,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";

const sessionDir = process.argv[2] || "./wa-session";

// A silent logger that satisfies Baileys' pino-shaped interface.
const noop = () => {};
const logger = {
  level: "silent",
  trace: noop,
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  fatal: noop,
  child: () => logger,
};

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}
function logLine(message) {
  process.stderr.write(`[daylattice-wa] ${message}\n`);
}

let sock = null;
let stopping = false;
let reconnecting = false;

async function start() {
  reconnecting = false;
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  // Use the CURRENT WhatsApp Web version. Skipping this makes WhatsApp reject
  // the handshake with code 405 (Connection Failure) before any QR is issued.
  let version;
  try {
    const latest = await fetchLatestBaileysVersion();
    version = latest.version;
    logLine(`using WA web version ${version?.join(".")}`);
  } catch (e) {
    logLine("could not fetch latest WA version, using bundled default: " + e);
  }

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const dataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
        send({ type: "qr", data: dataUrl });
        send({ type: "status", status: "connecting" });
      } catch (e) {
        logLine("qr render failed: " + e);
      }
    }

    if (connection === "open") {
      send({ type: "status", status: "connected" });
      logLine("connected");
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      logLine(`connection closed (code=${code}, loggedOut=${loggedOut})`);

      // Detach this dead socket's listeners so it can't keep firing.
      try {
        sock?.ev.removeAllListeners("connection.update");
      } catch {
        /* ignore */
      }

      if (loggedOut || stopping) {
        send({ type: "status", status: "disconnected" });
        if (stopping) process.exit(0);
      } else if (!reconnecting) {
        // Transient drop (incl. 405) — reconnect once with a fresh socket.
        reconnecting = true;
        send({ type: "status", status: "connecting" });
        setTimeout(() => start().catch((e) => logLine("reconnect failed: " + e)), 2500);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    logLine(`messages.upsert type=${type} count=${messages.length}`);
    if (type !== "notify") return;
    for (const msg of messages) {
      try {
        await handleMessage(msg);
      } catch (e) {
        logLine("message handling failed: " + e);
      }
    }
  });
}

async function handleMessage(msg) {

  if (!msg.message || msg.key.fromMe) return;
  const from = msg.key.remoteJid;
  if (!from || from === "status@broadcast" || from.endsWith("@g.us")) return; // skip status & groups

  const m = msg.message;
  const text =
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    "";

  const audio = m.audioMessage;
  if (audio) {
    try {
      const buffer = await downloadMediaMessage(
        msg,
        "buffer",
        {},
        { logger, reuploadRequest: sock.updateMediaMessage },
      );
      send({
        type: "message",
        from,
        text: text || "",
        audioBase64: buffer.toString("base64"),
        mime: audio.mimetype || "audio/ogg",
      });
      return;
    } catch (e) {
      logLine("audio download failed: " + e);
    }
  }

  if (text.trim()) {
    send({ type: "message", from, text });
  }
}

// ---- stdin command loop ----
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (line) handleCommand(line);
  }
});

async function handleCommand(line) {
  let cmd;
  try {
    cmd = JSON.parse(line);
  } catch {
    return;
  }
  switch (cmd.type) {
    case "connect":
      if (!sock) start().catch((e) => logLine("start failed: " + e));
      break;
    case "disconnect":
      stopping = true;
      try {
        await sock?.logout();
      } catch {
        /* ignore */
      }
      send({ type: "status", status: "disconnected" });
      process.exit(0);
      break;
    case "send":
      try {
        await sock?.sendMessage(cmd.to, { text: cmd.text });
      } catch (e) {
        logLine("send failed: " + e);
      }
      break;
    default:
      break;
  }
}

process.on("uncaughtException", (e) => logLine("uncaught: " + e));
process.on("unhandledRejection", (e) => logLine("unhandled: " + e));

logLine("sidecar started");
