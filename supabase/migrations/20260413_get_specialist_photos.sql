-- Security definer function to fetch specialist profile photos.
-- Bypasses RLS so parents can read specialist photo_url without a direct profiles policy.
CREATE OR REPLACE FUNCTION get_specialist_photos(p_specialist_ids uuid[])
RETURNS TABLE(id uuid, photo_url text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT p.id, p.photo_url FROM profiles p WHERE p.id = ANY(p_specialist_ids) AND p.photo_url IS NOT NULL;
$$;
