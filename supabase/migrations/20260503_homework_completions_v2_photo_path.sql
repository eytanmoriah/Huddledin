-- Session 2 Sub-commit 1: photo_path column on homework_completions_v2
-- Sister-fix to homework attachment URL bug (Session B Commit 1).
-- Same architecture issue: 15-minute signed URLs stored at upload time expire silently.
-- complete-modal.js will capture {path, url} from SB.uploadFile and write both columns.
-- detail-view.js (sub-commit 2) will sign on-demand at render time, falling back to
-- legacy photo_url for old rows.
--
-- No backfill — old rows stay broken, same decision as homework attachments (A3).
-- v1 homework_completions table NOT touched; dual-write removal deferred per data.js:353 TODO.

ALTER TABLE homework_completions_v2 ADD COLUMN IF NOT EXISTS photo_path TEXT;

-- Verify after running:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='homework_completions_v2' AND column_name='photo_path';
-- Should return one row.
