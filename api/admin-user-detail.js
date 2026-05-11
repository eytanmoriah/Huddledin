import { createClient } from '@supabase/supabase-js';

async function verifyAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return { user: null, error: 'unauthenticated' };
  const token = authHeader.split(' ')[1];
  const url = process.env.SUPABASE_URL || 'https://smgbojgrdezasxciloll.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { user: null, error: 'unauthenticated' };
  const supa = createClient(url, serviceKey);
  const { data: { user }, error: authErr } = await supa.auth.getUser(token);
  if (authErr || !user) return { user: null, error: 'unauthenticated' };
  const { data: rows } = await supa.from('profiles').select('is_admin').eq('id', user.id).limit(1);
  if (!rows?.[0]?.is_admin) return { user: null, error: 'forbidden' };
  return { user, error: null };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { user, error: authError } = await verifyAdmin(req);
  if (authError === 'unauthenticated') return res.status(401).json({ error: 'Unauthorized' });
  if (authError === 'forbidden') return res.status(403).json({ error: 'Forbidden' });

  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const q = async (table, params) => {
      const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}?${params}`, {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        }
      });
      if (!r.ok) { console.error(`Query failed ${table}:`, await r.text()); return []; }
      return r.json();
    };

    // Get profile
    const profiles = await q('profiles', `id=eq.${userId}&select=id,role,household_id,display_name`);
    const profile = profiles?.[0];
    if (!profile) return res.status(404).json({ error: 'User not found' });

    const { role, household_id } = profile;

    // Run all queries in parallel — use multiple filter approaches to catch all records
    const [
      aptsByHH, aptsById,
      msgsByHH, msgsById,
      filesByHH,
      todosData,
      notesData,
      reqsAsSpec, reqsAsParent,
      children
    ] = await Promise.all([
      household_id ? q('appointments', `household_id=eq.${household_id}&select=id,title,date,type`) : Promise.resolve([]),
      q('appointments', `parent_id=eq.${userId}&select=id,title,date,type`),
      household_id ? q('messages', `household_id=eq.${household_id}&select=id,created_at,body`) : Promise.resolve([]),
      q('messages', `sender_id=eq.${userId}&select=id,created_at,body`),
      household_id ? q('files', `household_id=eq.${household_id}&select=id,name,created_at`) : Promise.resolve([]),
      q('todos', `user_id=eq.${userId}&select=id,title,completed,created_at`),
      q('vault_notes', `specialist_id=eq.${userId}&select=id,title,published,created_at`),
      q('specialist_requests', `specialist_id=eq.${userId}&select=id,status,requested_at,role,specialist_name`),
      household_id ? q('specialist_requests', `household_id=eq.${household_id}&select=id,status,requested_at,specialist_name,role`) : Promise.resolve([]),
      household_id ? q('children', `household_id=eq.${household_id}&select=id,name,created_at`) : Promise.resolve([])
    ]);

    // Deduplicate appointments and messages by id
    const aptMap = {};
    [...aptsByHH, ...aptsById].forEach(a => { aptMap[a.id] = a; });
    const allApts = Object.values(aptMap);

    const msgMap = {};
    [...msgsByHH, ...msgsById].forEach(m => { msgMap[m.id] = m; });
    const allMsgs = Object.values(msgMap);

    // Connections = approved requests
    const connections = role === 'specialist'
      ? reqsAsSpec.filter(r => r.status === 'approved').length
      : reqsAsParent.filter(r => r.status === 'approved').length;

    res.status(200).json({
      appointments: allApts.length,
      recentApts: allApts.sort((a,b) => (b.date||'').localeCompare(a.date||'')).slice(0,5),
      messages: allMsgs.length,
      files: filesByHH.length,
      recentFiles: filesByHH.sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0,5),
      todos: todosData.length,
      todosCompleted: todosData.filter(t => t.completed).length,
      notes: notesData.length,
      notesPublished: notesData.filter(n => n.published).length,
      connections,
      children: children.length,
      childrenList: children,
      // Specialist-specific
      pendingRequests: reqsAsSpec.filter(r => r.status === 'pending').length,
      approvedFamilies: reqsAsSpec.filter(r => r.status === 'approved'),
      // Parent-specific
      teamMembers: reqsAsParent.filter(r => r.status === 'approved')
    });

  } catch (err) {
    console.error('admin-user-detail error:', err);
    res.status(500).json({ error: err.message });
  }
}
