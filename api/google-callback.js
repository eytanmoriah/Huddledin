export default async function handler(req, res) {
  const { code, state: userId } = req.query;

  console.log('google-callback: userId=', userId, 'code=', code ? 'present' : 'missing');

  if (!code || !userId) {
    return res.status(400).send('Missing code or userId');
  }

  try {
    // Exchange code for tokens
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
    console.log('Token exchange status:', tokenRes.status, 'has refresh_token:', !!tokens.refresh_token, 'error:', tokens.error || 'none');

    if (!tokens.refresh_token) {
      console.error('No refresh token. Full response:', JSON.stringify(tokens));
      return res.redirect('https://huddledin.com/#google-auth-error');
    }

    // Save to Supabase
    const supaUrl = `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`;
    console.log('Updating Supabase:', supaUrl);

    const supaRes = await fetch(supaUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        google_refresh_token: tokens.refresh_token,
        google_calendar_enabled: true
      })
    });

    const supaData = await supaRes.json();
    console.log('Supabase response status:', supaRes.status, 'data:', JSON.stringify(supaData).slice(0, 200));

    if (!supaRes.ok || !supaData?.length) {
      console.error('Supabase update failed or matched 0 rows');
      return res.redirect('https://huddledin.com/#google-auth-error');
    }

    console.log('Success — redirecting to app');
    res.redirect('https://huddledin.com/#google-auth-success');

  } catch (err) {
    console.error('Google callback error:', err.message);
    res.redirect('https://huddledin.com/#google-auth-error');
  }
}
