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

    // Use Supabase SQL RPC to bypass any RLS issues
    const sqlRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({
          query: `UPDATE profiles SET google_refresh_token = '${tokens.refresh_token.replace(/'/g, "''")}', google_calendar_enabled = true WHERE id = '${userId}'`
        })
      }
    );

    console.log('SQL RPC status:', sqlRes.status);

    // Fallback: try direct PATCH with different headers
    if (!sqlRes.ok) {
      console.log('RPC failed, trying direct PATCH...');
      const patchRes = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
            'Prefer': 'return=minimal',
            'Content-Profile': 'public'
          },
          body: JSON.stringify({
            google_refresh_token: tokens.refresh_token,
            google_calendar_enabled: true
          })
        }
      );
      console.log('PATCH status:', patchRes.status, await patchRes.text());
    }

    res.redirect('https://huddledin.com/#google-auth-success');

  } catch (err) {
    console.error('callback error:', err.message);
    res.redirect('https://huddledin.com/#google-auth-error');
  }
}
