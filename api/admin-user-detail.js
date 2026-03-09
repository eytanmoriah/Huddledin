export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const userRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.SUPABASE_SERVICE_KEY }
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Invalid token' });
    const adminUser = await userRes.json();
    if (adminUser.email !== 'admin@huddledin.com') return res.status(403).json({ error: 'Forbidden' });

    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const q = async (table, params) => {
      const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}?${params}`, {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        }
      });
      if (!r.ok) return [];
      return r.json();
    };

    // Get profile
    const profiles = await q('profiles', `id=eq.${userId}&select=id,role,household_id`);
    const profile = profiles?.[0];
    if (!profile) return res.status(404).json({ error: 'User not found' });

    const { role, household_id } = profile;

    let appointments = 0, messages = 0, files = 0, todos = 0, notes = 0, connections = 0;

    if (role === 'parent' && household_id) {
      const [apts, msgs, filesData, todosData, reqs] = await Promise.all([
        q('appointments', `household_id=eq.${household_id}&select=id`),
        q('messages', `household_id=eq.${household_id}&select=id`),
        q('files', `household_id=eq.${household_id}&select=id`),
        q('todos', `user_id=eq.${userId}&select=id`),
        q('specialist_requests', `household_id=eq.${household_id}&status=eq.approved&select=id`)
      ]);
      appointments = apts.length;
      messages = msgs.length;
      files = filesData.length;
      todos = todosData.length;
      connections = reqs.length;
    } else if (role === 'specialist') {
      const [notesData, reqs, msgs] = await Promise.all([
        q('vault_notes', `specialist_id=eq.${userId}&select=id`),
        q('specialist_requests', `specialist_id=eq.${userId}&status=eq.approved&select=id`),
        q('messages', `sender_id=eq.${userId}&select=id`)
      ]);
      notes = notesData.length;
      connections = reqs.length;
      messages = msgs.length;
    }

    res.status(200).json({ appointments, messages, files, todos, notes, connections });

  } catch (err) {
    console.error('admin-user-detail error:', err);
    res.status(500).json({ error: err.message });
  }
}
