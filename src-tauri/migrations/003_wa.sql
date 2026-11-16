-- WhatsApp control number + a persisted default list for Sam (used by WhatsApp
-- and as the starting scope when the app opens).
ALTER TABLE profile ADD COLUMN default_list_id TEXT;
ALTER TABLE profile ADD COLUMN wa_control_number TEXT;
