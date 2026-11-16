# Contributing to Daylattice

Follow [Run from source](README.md#run-from-source) for platform setup. Use synthetic lists and messages when demonstrating bugs.

Run `pnpm lint`, `pnpm build`, and `pnpm sidecar:build`. With your platform’s Tauri prerequisites installed, run `cargo test --locked --manifest-path src-tauri/Cargo.toml --lib`. Exercise the affected workflow in the desktop app.

The React frontend lives in `src/`. The Rust core, migrations, and native capabilities are in `src-tauri/`. The optional WhatsApp bridge is built from `sidecar/`. Keep new native permissions narrow and describe any additional external data flows in your pull request.
