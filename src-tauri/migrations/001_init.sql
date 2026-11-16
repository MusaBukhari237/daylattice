-- Initial app schema.
-- Everything here is "exportable" data. Secrets (Gemini key, WhatsApp session)
-- live OUTSIDE the database by design and are never part of a backup.

PRAGMA foreign_keys = ON;

CREATE TABLE profile (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    output_language TEXT,                 -- NULL => Sam mirrors the user's language
    theme           TEXT NOT NULL DEFAULT 'light',  -- 'light' | 'dark' | 'system'
    onboarded       INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL
);

CREATE TABLE lists (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    knowledge   TEXT NOT NULL DEFAULT '',
    color       TEXT NOT NULL DEFAULT '#6366f1',
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE sections (
    id          TEXT PRIMARY KEY,
    list_id     TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    position    INTEGER NOT NULL DEFAULT 0,
    is_default  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tasks (
    id           TEXT PRIMARY KEY,
    list_id      TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    section_id   TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    priority     TEXT NOT NULL DEFAULT 'none',  -- none|low|med|high|urgent
    due_date     TEXT,                          -- ISO-8601 or NULL
    position     INTEGER NOT NULL DEFAULT 0,
    ai_enhanced  INTEGER NOT NULL DEFAULT 0,
    ai_metadata  TEXT,                          -- JSON: original values + suggestions
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE TABLE labels (
    id       TEXT PRIMARY KEY,
    list_id  TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    name     TEXT NOT NULL,
    color    TEXT NOT NULL DEFAULT '#94a3b8'
);

CREATE TABLE task_labels (
    task_id  TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, label_id)
);

CREATE TABLE sam_messages (
    id         TEXT PRIMARY KEY,
    list_id    TEXT REFERENCES lists(id) ON DELETE CASCADE,  -- NULL => global chat
    role       TEXT NOT NULL,            -- 'user' | 'sam'
    content    TEXT NOT NULL,
    source     TEXT NOT NULL DEFAULT 'ui',  -- 'ui' | 'voice' | 'whatsapp'
    created_at TEXT NOT NULL
);

CREATE INDEX idx_tasks_list_section_pos ON tasks(list_id, section_id, position);
CREATE INDEX idx_sections_list_pos      ON sections(list_id, position);
CREATE INDEX idx_labels_list            ON labels(list_id);
CREATE INDEX idx_task_labels_task       ON task_labels(task_id);
CREATE INDEX idx_sam_messages_list      ON sam_messages(list_id, created_at);
