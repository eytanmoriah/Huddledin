export default async function handler(req, res) {
  const { code, state: userId } = req.query;

  console.log('callback - userId:', userId);

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
    console.log('tokens - has refresh_token:', !!tokens.refresh_token, 'error:', tokens.error || 'none');

    if (!tokens.refresh_token) {
      console.error('No refresh token:', JSON.stringify(tokens));
      return res.redirect('https://huddledin.com/#google-auth-error');
    }

    // Call Supabase RPC function (security definer — bypasses RLS)
    const rpcRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rpc/set_google_calendar`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({
          user_id: userId,
          p_refresh_token: tokens.refresh_token,
          enabled: true
        })
      }
    );

    const rpcText = await rpcRes.text();
    console.log('RPC status:', rpcRes.status, 'response:', rpcText);

    if (!rpcRes.ok) {
      console.error('RPC failed:', rpcText);
      return res.redirect('https://huddledin.com/#google-auth-error');
    }

    console.log('Success — token saved');
    res.redirect('https://huddledin.com/#google-auth-success');

  } catch (err) {
    console.error('callback error:', err.message);
    res.redirect('https://huddledin.com/#google-auth-error');
  }
}
