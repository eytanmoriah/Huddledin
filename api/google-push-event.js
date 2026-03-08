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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, householdId, appointment } = req.body;
  if (!userId || !appointment) {
    return res.status(400).json({ error: 'Missing userId or appointment' });
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
      `${process.env.SUPABASE_URL}/rest/v1/rpc/get_google_calendar`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
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
        `${process.env.SUPABASE_URL}/rest/v1/rpc/get_household_google_users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
          },
          body: JSON.stringify({ p_household_id: householdId })
        }
      );
      const householdUsers = await householdRes.json();
      if (Array.isArray(householdUsers)) {
        for (const user of householdUsers) {
          // Skip if same token as creator (already pushed above)
          if (user.google_refresh_token === myToken) continue;
          const accessToken = await getAccessToken(user.google_refresh_token);
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
    console.error('google-push-event error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
