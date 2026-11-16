// Builds the Daylattice WhatsApp sidecar into a standalone executable using Node's
// Single Executable Application (SEA) feature, and places it in
// ../src-tauri/binaries/ with the platform target-triple suffix Tauri expects.

import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  rmSync,
  chmodSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { inject } from "postject";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "dist");
const binDir = join(__dirname, "..", "src-tauri", "binaries");
const bundlePath = join(distDir, "bundle.cjs");
const seaConfigPath = join(distDir, "sea-config.json");
const blobPath = join(distDir, "sea-prep.blob");

const isWin = process.platform === "win32";
const isMac = process.platform === "darwin";
const SENTINEL = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

function log(msg) {
  console.log(`[sidecar:build] ${msg}`);
}

/** Determine the Rust target triple Tauri expects in the binary filename. */
function targetTriple() {
  try {
    const out = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
    const m = out.match(/host:\s*(\S+)/);
    if (m) return m[1];
  } catch {
    /* rustc not on PATH — fall back to a best-effort mapping */
  }
  const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
  if (isWin) return `${arch}-pc-windows-msvc`;
  if (isMac) return `${arch}-apple-darwin`;
  return `${arch}-unknown-linux-gnu`;
}

async function main() {
  if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
  mkdirSync(binDir, { recursive: true });

  // 1. Bundle the sidecar (ESM) into a single CommonJS file for SEA.
  log("bundling with esbuild…");
  await build({
    entryPoints: [join(__dirname, "index.js")],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: bundlePath,
    // Optional Baileys media/preview deps we don't use — keep them out of the
    // bundle. Their code paths are never hit (e.g. printQRInTerminal is false).
    external: [
      "qrcode-terminal",
      "sharp",
      "jimp",
      "link-preview-js",
      "audio-decode",
    ],
    logLevel: "info",
  });

  // 2. Generate the SEA blob.
  log("creating SEA blob…");
  writeFileSync(
    seaConfigPath,
    JSON.stringify(
      {
        main: bundlePath,
        output: blobPath,
        disableExperimentalSEAWarning: true,
        useSnapshot: false,
        useCodeCache: false,
      },
      null,
      2,
    ),
  );
  execFileSync(process.execPath, ["--experimental-sea-config", seaConfigPath], {
    stdio: "inherit",
  });

  // 3. Copy the running Node binary to the output path.
  const triple = targetTriple();
  const ext = isWin ? ".exe" : "";
  const outName = `daylattice-wa-${triple}${ext}`;
  const outPath = join(binDir, outName);
  log(`producing ${outName}`);
  copyFileSync(process.execPath, outPath);

  // macOS: strip the signature before injecting so the binary stays loadable.
  if (isMac) {
    try {
      execFileSync("codesign", ["--remove-signature", outPath]);
    } catch {
      /* not signed — ignore */
    }
  }

  // 4. Inject the blob with postject (programmatic API — robust to spaces in paths).
  log("injecting blob with postject…");
  await inject(outPath, "NODE_SEA_BLOB", readFileSync(blobPath), {
    sentinelFuse: SENTINEL,
    machoSegmentName: isMac ? "NODE_SEA" : undefined,
  });

  // macOS: ad-hoc re-sign.
  if (isMac) {
    try {
      execFileSync("codesign", ["--sign", "-", outPath]);
    } catch (e) {
      log("warning: ad-hoc codesign failed: " + e);
    }
  }

  if (!isWin) chmodSync(outPath, 0o755);

  log(`done → ${outPath}`);
}

main().catch((e) => {
  console.error("[sidecar:build] failed:", e);
  process.exit(1);
});
