export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const userRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.SUPABASE_SERVICE_KEY }
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Invalid token' });
    const user = await userRes.json();
    if (user.email !== 'admin@huddledin.com') return res.status(403).json({ error: 'Forbidden' });

    const q = async (table, params = '') => {
      const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}?${params}`, {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        }
      });
      if (!r.ok) {
        console.error(`Query failed for ${table}:`, await r.text());
        return [];
      }
      return r.json();
    };

    const now = Date.now();
    const weekAgo = new Date(now - 7*24*60*60*1000).toISOString();
    const monthAgo = new Date(now - 30*24*60*60*1000).toISOString();

    // Fetch auth users for last_sign_in_at (from admin API)
    const authUsersRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
      }
    });
    const authData = authUsersRes.ok ? await authUsersRes.json() : { users: [] };
    const authUsers = authData.users || [];

    const [profiles, children, appointments, messages, files, todos, requests, chats, notes] = await Promise.all([
      q('profiles', 'select=id,role,created_at,household_id,google_calendar_enabled'),
      q('children', 'select=id,household_id,created_at'),
      q('appointments', 'select=id,created_at,household_id,child_id,type'),
      q('messages', 'select=id,created_at,chat_id'),
      q('files', 'select=id,created_at,household_id'),
      q('todos', 'select=id,created_at,completed,user_id'),
      q('specialist_requests', 'select=specialist_id,household_id,status,created_at'),
      q('chats', 'select=id,household_id,created_at,type'),
      q('vault_notes', 'select=id,created_at,specialist_id,published')
    ]);

    const parents = profiles.filter(p => p.role === 'parent');
    const specialists = profiles.filter(p => p.role === 'specialist');
    const approvedReqs = requests.filter(r => r.status === 'approved');
    const pendingReqs = requests.filter(r => r.status === 'pending');
    const households = new Set(profiles.filter(p => p.household_id).map(p => p.household_id));
    const householdsWithSpec = new Set(approvedReqs.map(r => r.household_id));
    const specsWithFamily = new Set(approvedReqs.map(r => r.specialist_id));

    // Retention from auth users
    const activeUsersWeek = authUsers.filter(u => u.last_sign_in_at > weekAgo).length;
    const activeUsersMonth = authUsers.filter(u => u.last_sign_in_at > monthAgo).length;
    const dormantUsers = authUsers.filter(u => u.last_sign_in_at && u.last_sign_in_at < monthAgo).length;

    const householdsWithChildren = new Set(children.map(c => c.household_id));
    const emptyHouseholds = [...households].filter(hid => !householdsWithChildren.has(hid)).length;

    const householdsUsingApts = new Set(appointments.map(a => a.household_id).filter(Boolean));
    const householdsUsingFiles = new Set(files.map(f => f.household_id).filter(Boolean));
    const householdsUsingChats = new Set(chats.map(c => c.household_id).filter(Boolean));

    const specsNoFamily = specialists.filter(s => !specsWithFamily.has(s.id)).length;

    const specFamilyCount = {};
    approvedReqs.forEach(r => { specFamilyCount[r.specialist_id] = (specFamilyCount[r.specialist_id]||0)+1; });
    const powerSpecialists = Object.values(specFamilyCount).filter(c => c >= 2).length;

    // Growth: signups by week for last 8 weeks
    const weeklySignups = [];
    for (let i = 7; i >= 0; i--) {
      const start = new Date(now - (i+1)*7*24*60*60*1000).toISOString();
      const end = new Date(now - i*7*24*60*60*1000).toISOString();
      const label = new Date(now - i*7*24*60*60*1000).toLocaleDateString('en',{month:'short',day:'numeric'});
      weeklySignups.push({
        label,
        users: profiles.filter(p => p.created_at >= start && p.created_at < end).length,
        appointments: appointments.filter(a => a.created_at >= start && a.created_at < end).length,
        messages: messages.filter(m => m.created_at >= start && m.created_at < end).length
      });
    }

    const childrenPerHousehold = {};
    children.forEach(c => { childrenPerHousehold[c.household_id] = (childrenPerHousehold[c.household_id]||0)+1; });
    const childDist = { one: 0, two: 0, threePlus: 0 };
    Object.values(childrenPerHousehold).forEach(n => {
      if(n===1) childDist.one++;
      else if(n===2) childDist.two++;
      else childDist.threePlus++;
    });

    const aptTypes = {};
    appointments.forEach(a => { const t=a.type||'other'; aptTypes[t]=(aptTypes[t]||0)+1; });

    res.status(200).json({
      overview: {
        totalUsers: profiles.length,
        parents: parents.length,
        specialists: specialists.length,
        households: households.size,
        children: children.length,
        newUsersWeek: profiles.filter(p => p.created_at > weekAgo).length,
        pendingRequests: pendingReqs.length,
        gcalConnected: profiles.filter(p => p.google_calendar_enabled).length
      },
      retention: {
        activeWeek: activeUsersWeek,
        activeMonth: activeUsersMonth,
        dormant: dormantUsers,
        emptyHouseholds,
        householdsNoSpec: households.size - householdsWithSpec.size
      },
      engagement: {
        appointments: appointments.length,
        appointmentsWeek: appointments.filter(a => a.created_at > weekAgo).length,
        messages: messages.length,
        messagesWeek: messages.filter(m => m.created_at > weekAgo).length,
        files: files.length,
        filesWeek: files.filter(f => f.created_at > weekAgo).length,
        todos: todos.length,
        todosCompleted: todos.filter(t => t.completed).length,
        notes: notes.length,
        notesPublished: notes.filter(n => n.published).length,
        chats: chats.length,
        householdsUsingApts: householdsUsingApts.size,
        householdsUsingFiles: householdsUsingFiles.size,
        householdsUsingChats: householdsUsingChats.size,
        aptTypes
      },
      specialists: {
        total: specialists.length,
        active: specsWithFamily.size,
        noFamily: specsNoFamily,
        powerUsers: powerSpecialists,
        gcal: profiles.filter(p => p.google_calendar_enabled && p.role==='specialist').length,
        pendingRequests: pendingReqs.length
      },
      growth: {
        weekly: weeklySignups,
        childDist
      }
    });

  } catch (err) {
    console.error('admin-stats error:', err);
    res.status(500).json({ error: err.message });
  }
}
