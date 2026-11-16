-- Push-to-talk voice hotkey settings (global shortcut + hold-to-activate delay).
ALTER TABLE profile ADD COLUMN voice_shortcut TEXT NOT NULL DEFAULT 'Control+Shift+Space';
ALTER TABLE profile ADD COLUMN voice_hold_ms INTEGER NOT NULL DEFAULT 1000;
