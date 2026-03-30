export default function handler(req, res) {
  const country = req.headers['x-vercel-ip-country'] || 'US';
  res.json({ country });
}
