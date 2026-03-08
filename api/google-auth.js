export default function handler(req, res) {
  const { userId } = req.query;
  if (!userId) return res.status(400).send('Missing userId');

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
    state: userId
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
