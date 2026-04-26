-- Homework Redesign Phase 2c: Add exercises_json to homework_templates
-- Stores a snapshot of exercises when saving a template from the v2 create flow.
-- Existing templates (v1, flat) have exercises_json = NULL and continue to work.

ALTER TABLE homework_templates ADD COLUMN IF NOT EXISTS exercises_json JSONB;
