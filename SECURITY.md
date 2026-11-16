# Security policy

Report vulnerabilities privately through [GitHub security advisories](https://github.com/MusaBukhari237/daylattice/security/advisories/new). Include the version and a synthetic reproduction. Please keep credentials, database exports, and account identifiers out of the report.

## Data handling

- Daylattice stores profile, task, and assistant history data in local SQLite. Archives contain this data and are unencrypted.
- A Gemini key entered in Settings is stored in the operating system keychain. The interface reads the key’s configured state and a masked preview. Gemini receives requests directly from the Rust core over HTTPS. This can include prompts, list and task context, tool results, and audio submitted for transcription. Network errors shown by Daylattice use generic status messages.
- WhatsApp is optional. Linking a device stores its session files in the local app-data directory. Only direct messages matching the full configured international number can become remote commands. With a blank control number, all remote commands are ignored. Revoke the linked device from WhatsApp if you remove access.
- Exported backups omit keychain credentials, the configured WhatsApp control number, and WhatsApp session files. Importing replaces the local exported tables in one transaction. Inspect the source and retain a backup of your own before restoring.

Security fixes target the latest release.
