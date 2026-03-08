function parse12hr(t) {
  if (!t) return '09:00';
  const parts = t.trim().split(' ');
  const modifier = parts[1] || '';
  const [h, m] = parts[0].split(':');
  let hours = parseInt(h);
  if (modifier.toUpperCase() === 'PM' && hours !== 12) hours += 12;
  if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${m || '00'}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { userId, appointment } = req.body;
  if (!userId || !appointment) {
    return res.status(400).json({ error: 'Missing userId or appointment' });
  }

  try {
    // Get profile from Supabase via REST
    const profileRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=google_refresh_token,google_calendar_enabled`,
      {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        }
      }
    );
    const profiles = await profileRes.json();
    const profile = profiles?.[0];

    if (!profile?.google_calendar_enabled || !profile?.google_refresh_token) {
      return res.status(200).json({ skipped: true, reason: 'Not connected' });
    }

    // Get fresh access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: profile.google_refresh_token,
        grant_type: 'refresh_token'
      })
    });

    const { access_token, error: tokenError } = await tokenRes.json();

    if (tokenError || !access_token) {
      // Token revoked — disable
      await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ google_calendar_enabled: false, google_refresh_token: null })
        }
      );
      return res.status(200).json({ skipped: true, reason: 'Token revoked' });
    }

    // Build event
    const dateStr = appointment.date;
    const time24 = parse12hr(appointment.time);
    const [h, m] = time24.split(':');
    const endHour = String(parseInt(h) + 1).padStart(2, '0');

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

    const calRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      }
    );

    const calData = await calRes.json();
    if (!calRes.ok) {
      console.error('Google Calendar error:', calData);
      return res.status(500).json({ error: calData.error?.message || 'Failed' });
    }

    res.status(200).json({ ok: true, eventId: calData.id });

  } catch (err) {
    console.error('google-push-event error:', err);
    res.status(500).json({ error: err.message });
  }
}
