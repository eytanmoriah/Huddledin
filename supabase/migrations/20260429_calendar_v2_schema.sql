-- Calendar v2 — Phase D1 schema foundation
-- Adds series tracking, lifecycle, and attendance columns to appointments table.
-- See calendar-v2-design.md for full design rationale.
--
-- Pre-migration: deleted 2 existing rows with recurrence != 'none'.
-- These were: 1 inactive-user test appointment (Ryan vinokur, March 11)
-- and 1 specialist test appointment (Lauri, April 27). Neither had real
-- recurring instances since the recurrence column was never expanded.
--
-- Run manually via Supabase SQL editor on April 29, 2026.

-- Series tracking
ALTER TABLE appointments ADD COLUMN series_id TEXT NULL;
ALTER TABLE appointments ADD COLUMN series_position INTEGER NULL;
ALTER TABLE appointments ADD COLUMN series_total INTEGER NULL;
ALTER TABLE appointments ADD COLUMN series_detached BOOLEAN DEFAULT FALSE NOT NULL;

-- Lifecycle
ALTER TABLE appointments ADD COLUMN deleted_at TIMESTAMPTZ NULL;

-- Attendance
ALTER TABLE appointments ADD COLUMN attendance TEXT NULL
  CHECK (attendance IS NULL OR attendance IN ('attended', 'patient_cancelled', 'no_show', 'therapist_cancelled'));
ALTER TABLE appointments ADD COLUMN attendance_marked_at TIMESTAMPTZ NULL;
ALTER TABLE appointments ADD COLUMN attendance_marked_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_appointments_series ON appointments(series_id) WHERE series_id IS NOT NULL;
CREATE INDEX idx_appointments_date_household ON appointments(household_id, date) WHERE deleted_at IS NULL;
