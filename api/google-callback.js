export default async function handler(req, res) {
  const { code, state: userId } = req.query;

  console.log('callback received - userId:', userId, 'code present:', !!code);
  console.log('full query:', JSON.stringify(req.query));

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
    console.log('token exchange status:', tokenRes.status, 'has refresh_token:', !!tokens.refresh_token, 'error:', tokens.error || 'none');

    if (!tokens.refresh_token) {
      console.error('No refresh token:', JSON.stringify(tokens));
      return res.redirect('https://huddledin.com/#google-auth-error');
    }

    // Hardcode the query to be safe — use exact match
    const patchUrl = `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`;
    console.log('PATCH url:', patchUrl);

    const supaRes = await fetch(patchUrl, {
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
    console.log('Supabase status:', supaRes.status, 'rows updated:', Array.isArray(supaData) ? supaData.length : 'not array', 'data:', JSON.stringify(supaData).slice(0, 300));

    if (!supaRes.ok) {
      console.error('Supabase error');
      return res.redirect('https://huddledin.com/#google-auth-error');
    }

    if (Array.isArray(supaData) && supaData.length === 0) {
      console.error('0 rows matched — userId not found in profiles:', userId);
      return res.redirect('https://huddledin.com/#google-auth-error');
    }

    console.log('Success!');
    res.redirect('https://huddledin.com/#google-auth-success');

  } catch (err) {
    console.error('callback error:', err.message);
    res.redirect('https://huddledin.com/#google-auth-error');
  }
}
