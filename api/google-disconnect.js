import { createClient } from '@supabase/supabase-js';

async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const url = process.env.SUPABASE_URL || 'https://smgbojgrdezasxciloll.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  const supa = createClient(url, serviceKey);
  const { data: { user }, error } = await supa.auth.getUser(token);
  return (error || !user) ? null : user;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Auth — verify caller is authenticated. user_id is sourced from the JWT,
  // never trusted from the request body.
  let user;
  try {
    user = await verifyAuth(req);
  } catch (e) {
    console.error('❌ google-disconnect auth:', e);
    return res.status(500).json({ error: 'Auth verification failed' });
  }
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // Rate limit — 5/hr per authenticated user. Failure mode: fail closed.
  // Dynamic import: lib/rate-limit.mjs is ESM, this file is CJS.
  const { checkRateLimit } = await import('../lib/rate-limit.mjs');
  const rl = await checkRateLimit(user.id, 'google-disconnect', 5);
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter || 3600));
    return res.status(429).json({ error: 'Too many requests' });
  }

  const userId = user.id;

  try {
    const supaRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ google_refresh_token: null, google_calendar_enabled: false })
      }
    );

    if (!supaRes.ok) {
      const errText = await supaRes.text().catch(() => '');
      console.error('❌ google-disconnect supabase:', supaRes.status, errText);
      return res.status(500).json({ error: 'Disconnect failed' });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('❌ google-disconnect:', err.message);
    res.status(500).json({ error: 'Disconnect failed' });
  }
}
