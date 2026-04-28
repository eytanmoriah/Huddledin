-- Calendar v2 — Day-shift series function
-- Atomically shifts dates and updates fields for all future instances in a series.
-- Called from JS via supabase.rpc('day_shift_series', {...}).
-- Run manually via Supabase SQL editor on April 29, 2026.

CREATE OR REPLACE FUNCTION day_shift_series(
  p_series_id TEXT,
  p_from_date DATE,
  p_day_shift INTEGER,
  p_field_patch JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller UUID := auth.uid();
  _is_authorized BOOLEAN := false;
  _row RECORD;
  _updated_rows JSONB := '[]'::jsonb;
  _count INTEGER := 0;
BEGIN
  -- Authorization: caller must be specialist_id or created_by on at least one row in the series
  IF EXISTS (
    SELECT 1 FROM appointments
    WHERE series_id = p_series_id
      AND (specialist_id = _caller OR created_by = _caller)
    LIMIT 1
  ) THEN
    _is_authorized := true;
  END IF;

  -- Fallback: household membership (parent editing shared appointment)
  IF NOT _is_authorized AND EXISTS (
    SELECT 1 FROM appointments a
    JOIN profiles p ON p.household_id = a.household_id
    WHERE a.series_id = p_series_id
      AND p.id = _caller
    LIMIT 1
  ) THEN
    _is_authorized := true;
  END IF;

  IF NOT _is_authorized THEN
    RAISE EXCEPTION 'Not authorized to edit this series';
  END IF;

  FOR _row IN
    SELECT id, date FROM appointments
    WHERE series_id = p_series_id
      AND date >= p_from_date
      AND series_detached = false
      AND deleted_at IS NULL
    ORDER BY date
  LOOP
    UPDATE appointments SET
      date = _row.date + (p_day_shift || ' days')::interval,
      title = COALESCE(p_field_patch->>'title', title),
      time = COALESCE(p_field_patch->>'time', time),
      end_time = CASE WHEN p_field_patch ? 'end_time' THEN p_field_patch->>'end_time' ELSE end_time END,
      location = CASE WHEN p_field_patch ? 'location' THEN p_field_patch->>'location' ELSE location END,
      notes = CASE WHEN p_field_patch ? 'notes' THEN p_field_patch->>'notes' ELSE notes END
    WHERE id = _row.id;

    _updated_rows := _updated_rows || jsonb_build_object(
      'id', _row.id,
      'new_date', (_row.date + (p_day_shift || ' days')::interval)::date::text
    );
    _count := _count + 1;
  END LOOP;

  RETURN jsonb_build_object('count', _count, 'rows', _updated_rows);
END;
$$;

-- Verify after running:
-- SELECT day_shift_series('test_series_id', '2026-05-01', 1, '{"title":"test"}');
-- (Should raise 'Not authorized' unless called with a valid auth context)
