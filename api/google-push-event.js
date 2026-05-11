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

function parseTime(t) {
  if (!t) return '09:00';
  t = t.trim();
  if (t.toUpperCase().includes('AM') || t.toUpperCase().includes('PM')) {
    const parts = t.split(' ');
    const modifier = parts[1].toUpperCase();
    const [h, m] = parts[0].split(':');
    let hours = parseInt(h);
    if (modifier === 'PM' && hours !== 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${m || '00'}`;
  }
  return t.slice(0, 5);
}

async function getAccessToken(refreshToken) {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  const { access_token, error } = await tokenRes.json();
  if (error || !access_token) return null;
  return access_token;
}

async function pushEventToCalendar(accessToken, event) {
  const calRes = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    }
  );
  const data = await calRes.json();
  return { ok: calRes.ok, data };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}(\s*[AP]M)?$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Auth — verify caller is authenticated. user_id is sourced from the JWT,
  // never trusted from the request body.
  let user;
  try {
    user = await verifyAuth(req);
  } catch (e) {
    console.error('❌ google-push-event auth:', e);
    return res.status(500).json({ error: 'Auth verification failed' });
  }
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { appointment } = req.body || {};

  // Validation — all failures collapse to a single "Invalid input" 400.
  if (!appointment || typeof appointment !== 'object') {
    return res.status(400).json({ error: 'Invalid input' });
  }
  if (typeof appointment.title !== 'string' || appointment.title.length === 0 || appointment.title.length > 200) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  if (typeof appointment.date !== 'string' || !DATE_RE.test(appointment.date)) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  if (appointment.time != null && (typeof appointment.time !== 'string' || !TIME_RE.test(appointment.time))) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  if (appointment.childName != null && (typeof appointment.childName !== 'string' || appointment.childName.length > 100)) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  if (appointment.specialistName != null && (typeof appointment.specialistName !== 'string' || appointment.specialistName.length > 100)) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  if (appointment.type != null && (typeof appointment.type !== 'string' || appointment.type.length > 50)) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  // Source identity from JWT; derive household from authenticated user's profile.
  const userId = user.id;
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://smgbojgrdezasxciloll.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: profileRow, error: profileErr } = await supa
    .from('profiles')
    .select('household_id')
    .eq('id', userId)
    .limit(1);
  if (profileErr) {
    console.error('❌ google-push-event profile lookup:', profileErr);
    return res.status(500).json({ error: 'Sync failed' });
  }
  const householdId = profileRow?.[0]?.household_id || null;

  // Rate limit — 20/hr per authenticated user. Failure mode: fail closed.
  // Dynamic import: lib/rate-limit.mjs is ESM, this file is CJS.
  const { checkRateLimit } = await import('../lib/rate-limit.mjs');
  const rl = await checkRateLimit(userId, 'google-push-event', 20);
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter || 3600));
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    // Build the calendar event object
    const dateStr = appointment.date;
    const time24 = parseTime(appointment.time);
    const [h, m] = time24.split(':');
    const endHour = String((parseInt(h) + 1) % 24).padStart(2, '0');
    const event = {
      summary: appointment.title,
      description: [
        appointment.childName ? `Child: ${appointment.childName}` : '',
        appointment.specialistName ? `With: ${appointment.specialistName}` : '',
        'Added via Huddledin'
      ].filter(Boolean).join('\n'),
      start: { dateTime: `${dateStr}T${time24}:00`, timeZone: 'UTC' },
      end: { dateTime: `${dateStr}T${endHour}:${m}:00`, timeZone: 'UTC' }
    };

    const pushResults = [];

    // 1. Push to the creating user's calendar
    const myProfile = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_google_calendar`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ user_id: userId })
      }
    ).then(r => r.json());

    const myToken = myProfile?.[0]?.google_refresh_token;
    if (myProfile?.[0]?.google_calendar_enabled && myToken) {
      const accessToken = await getAccessToken(myToken);
      if (accessToken) {
        const result = await pushEventToCalendar(accessToken, event);
        pushResults.push({ who: 'creator', ok: result.ok });
      }
    }

    // 2. Also push to all parents in the household (if different from creator)
    if (householdId) {
      const householdRes = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/get_household_google_users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          },
          body: JSON.stringify({ p_household_id: householdId })
        }
      );
      const householdUsers = await householdRes.json();
      if (Array.isArray(householdUsers)) {
        for (const u of householdUsers) {
          // Skip if same token as creator (already pushed above)
          if (u.google_refresh_token === myToken) continue;
          const accessToken = await getAccessToken(u.google_refresh_token);
          if (accessToken) {
            const result = await pushEventToCalendar(accessToken, event);
            pushResults.push({ who: 'parent', ok: result.ok });
          }
        }
      }
    }

    console.log('Push results:', JSON.stringify(pushResults));
    res.status(200).json({ ok: true, pushed: pushResults.length });

  } catch (err) {
    console.error('❌ google-push-event:', err.message);
    res.status(500).json({ error: 'Sync failed' });
  }
}
