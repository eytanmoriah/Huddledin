import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { code, state: userId } = req.query;

  if (!code || !userId) {
    return res.status(400).send('Missing code or userId');
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenRes.json();

    if (!tokens.refresh_token) {
      console.error('No refresh token returned:', tokens);
      return res.redirect('https://huddledin.com/#google-auth-error');
    }

    const supa = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    await supa.from('profiles').update({
      google_refresh_token: tokens.refresh_token,
      google_calendar_enabled: true
    }).eq('id', userId);

    res.redirect('https://huddledin.com/#google-auth-success');

  } catch (err) {
    console.error('Google callback error:', err);
    res.redirect('https://huddledin.com/#google-auth-error');
  }
}
