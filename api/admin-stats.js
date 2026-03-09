export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  // Verify the Authorization header contains a valid Supabase JWT
  // and that the user is admin@huddledin.com
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Verify the JWT by calling Supabase auth
    const userRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': process.env.SUPABASE_SERVICE_KEY
      }
    });

    if (!userRes.ok) return res.status(401).json({ error: 'Invalid token' });

    const user = await userRes.json();
    if (user.email !== 'admin@huddledin.com') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Helper to query Supabase REST
    const q = async (table, params = '') => {
      const r = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/${table}?${params}`,
        {
          headers: {
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
          }
        }
      );
      return r.json();
    };

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      profiles, children, appointments, messages,
      files, todos, requests
    ] = await Promise.all([
      q('profiles', 'select=id,role,created_at,household_id,google_calendar_enabled'),
      q('children', 'select=id,household_id'),
      q('appointments', 'select=id,created_at'),
      q('messages', 'select=id,created_at'),
      q('files', 'select=id'),
      q('todos', 'select=id,completed'),
      q('specialist_requests', 'select=specialist_id,household_id&status=eq.approved')
    ]);

    const parents = profiles.filter(p => p.role === 'parent');
    const specialists = profiles.filter(p => p.role === 'specialist');
    const households = new Set(profiles.filter(p => p.household_id).map(p => p.household_id));
    const householdsWithSpec = new Set(requests.map(r => r.household_id));
    const specsWithFamily = new Set(requests.map(r => r.specialist_id));
    const gcal = profiles.filter(p => p.google_calendar_enabled);

    res.status(200).json({
      users: {
        total: profiles.length,
        parents: parents.length,
        specialists: specialists.length,
        newThisWeek: profiles.filter(p => p.created_at > weekAgo).length
      },
      families: {
        households: households.size,
        children: children.length,
        withSpecialist: householdsWithSpec.size,
        noSpecialist: households.size - householdsWithSpec.size
      },
      activity: {
        appointments: appointments.length,
        appointmentsThisWeek: appointments.filter(a => a.created_at > weekAgo).length,
        messages: messages.length,
        messagesThisWeek: messages.filter(m => m.created_at > weekAgo).length,
        files: files.length,
        todos: todos.length,
        todosCompleted: todos.filter(t => t.completed).length
      },
      specialists: {
        total: specialists.length,
        active: specsWithFamily.size,
        googleCal: gcal.length
      }
    });

  } catch (err) {
    console.error('admin-stats error:', err);
    res.status(500).json({ error: err.message });
  }
}
