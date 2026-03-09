export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Verify admin
    const userRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': process.env.SUPABASE_SERVICE_KEY }
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Invalid token' });
    const user = await userRes.json();
    if (user.email !== 'admin@huddledin.com') return res.status(403).json({ error: 'Forbidden' });

    const { action, payload } = req.body;

    const supa = async (method, path, body) => {
      const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=representation'
        },
        body: body ? JSON.stringify(body) : undefined
      });
      return { ok: r.ok, status: r.status, data: await r.json() };
    };

    // ── Approve specialist request ──
    if (action === 'approve_request') {
      const { requestId } = payload;
      const r = await supa('PATCH', `specialist_requests?id=eq.${requestId}`, { status: 'approved' });
      if (!r.ok) return res.status(500).json({ error: 'Failed to approve' });

      // Notify the specialist
      const req2 = r.data?.[0];
      if (req2?.specialist_id) {
        await supa('POST', 'notifications', [{
          id: 'n_adm_' + Date.now(),
          user_id: req2.specialist_id,
          household_id: req2.household_id || null,
          child_id: req2.child_id || null,
          type: 'team',
          message: '✅ Your access request has been approved by admin.',
          read: false
        }]);
      }
      return res.status(200).json({ ok: true });
    }

    // ── Reject specialist request ──
    if (action === 'reject_request') {
      const { requestId } = payload;
      const r = await supa('PATCH', `specialist_requests?id=eq.${requestId}`, { status: 'denied' });
      if (!r.ok) return res.status(500).json({ error: 'Failed to reject' });
      return res.status(200).json({ ok: true });
    }

    // ── Flag / unflag user ──
    if (action === 'flag_user') {
      const { userId, flagged } = payload;
      const r = await supa('PATCH', `profiles?id=eq.${userId}`, { flagged: flagged });
      if (!r.ok) return res.status(500).json({ error: 'Failed to flag user' });
      return res.status(200).json({ ok: true });
    }

    // ── Disable user (via Supabase Auth admin API) ──
    if (action === 'disable_user') {
      const { userId, disabled } = payload;
      const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ ban_duration: disabled ? '87600h' : 'none' })
      });
      if (!r.ok) return res.status(500).json({ error: 'Failed to update user' });
      return res.status(200).json({ ok: true });
    }

    // ── Broadcast notification ──
    if (action === 'broadcast') {
      const { message, audience } = payload; // audience: 'all' | 'parents' | 'specialists'

      // Get all profiles matching audience
      let profilesUrl = 'profiles?select=id,role,household_id';
      const profilesRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${profilesUrl}`, {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        }
      });
      const allProfiles = await profilesRes.json();
      const targets = allProfiles.filter(p => {
        if (p.id === user.id) return false; // skip admin
        if (audience === 'parents') return p.role === 'parent';
        if (audience === 'specialists') return p.role === 'specialist';
        return true; // 'all'
      });

      // Insert notifications in batches
      const notifs = targets.map(p => ({
        id: 'n_bc_' + Date.now() + '_' + p.id.slice(0,8),
        user_id: p.id,
        household_id: p.household_id || null,
        child_id: null,
        type: 'announcement',
        message: '📢 ' + message,
        read: false
      }));

      if (notifs.length === 0) return res.status(200).json({ ok: true, sent: 0 });

      // Insert in chunks of 50
      let sent = 0;
      for (let i = 0; i < notifs.length; i += 50) {
        const chunk = notifs.slice(i, i + 50);
        const r = await supa('POST', 'notifications', chunk);
        if (r.ok) sent += chunk.length;
      }
      return res.status(200).json({ ok: true, sent });
    }

    // ── Re-engagement nudge for stuck households ──
    if (action === 'nudge_stuck') {
      const { householdIds } = payload;

      // Get parent profiles for these households
      const profilesRes = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/profiles?household_id=in.(${householdIds.join(',')})&role=eq.parent&select=id,household_id`,
        {
          headers: {
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
          }
        }
      );
      const parents = await profilesRes.json();

      const notifs = parents.map(p => ({
        id: 'n_nudge_' + Date.now() + '_' + p.id.slice(0,8),
        user_id: p.id,
        household_id: p.household_id || null,
        child_id: null,
        type: 'announcement',
        message: '👋 Your Huddledin account is all set! Add your child\'s care team to start collaborating.',
        read: false
      }));

      let sent = 0;
      for (let i = 0; i < notifs.length; i += 50) {
        const r = await supa('POST', 'notifications', notifs.slice(i, i + 50));
        if (r.ok) sent += notifs.slice(i, i + 50).length;
      }
      return res.status(200).json({ ok: true, sent });
    }

    return res.status(400).json({ error: 'Unknown action: ' + action });

  } catch (err) {
    console.error('admin-action error:', err);
    res.status(500).json({ error: err.message });
  }
}
