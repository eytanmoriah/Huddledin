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
      console.error('No refresh token:', tokens);
      return res.redirect('https://huddledin.com/#google-auth-error');
    }

    // Update Supabase via REST — no SDK needed
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
        body: JSON.stringify({
          google_refresh_token: tokens.refresh_token,
          google_calendar_enabled: true
        })
      }
    );

    if (!supaRes.ok) {
      console.error('Supabase update failed:', await supaRes.text());
      return res.redirect('https://huddledin.com/#google-auth-error');
    }

    res.redirect('https://huddledin.com/#google-auth-success');

  } catch (err) {
    console.error('Google callback error:', err);
    res.redirect('https://huddledin.com/#google-auth-error');
  }
}
