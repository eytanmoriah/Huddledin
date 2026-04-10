import { createClient } from '@supabase/supabase-js';

async function verifySpecAiAccess(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return { ok: false, error: 'Missing auth token', status: 401 };
  const token = authHeader.split(' ')[1];
  const url = process.env.SUPABASE_URL || 'https://smgbojgrdezasxciloll.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) { console.error('SUPABASE_SERVICE_ROLE_KEY not set'); return { ok: false, error: 'Server misconfigured', status: 500 }; }
  const supa = createClient(url, serviceKey);
  const { data: { user }, error } = await supa.auth.getUser(token);
  if (error || !user) return { ok: false, error: 'Invalid or expired auth token', status: 401 };
  const { data: subs } = await supa.from('subscriptions').select('status,exempt,trial_ends_at').eq('user_id', user.id).eq('plan', 'specialist_ai').limit(1);
  const sub = subs?.[0];
  if (!sub) return { ok: false, error: 'No AI subscription found', status: 403 };
  if (sub.exempt) return { ok: true, user };
  if (sub.status === 'active') return { ok: true, user };
  if (sub.status === 'trial' && sub.trial_ends_at && new Date(sub.trial_ends_at) > new Date()) return { ok: true, user };
  return { ok: false, error: 'AI subscription expired', status: 403 };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verify auth + subscription
  let auth;
  try { auth = await verifySpecAiAccess(req); } catch (e) { console.error('Auth check failed:', e); return res.status(500).json({ error: 'Auth verification failed' }); }
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { notes, childName } = req.body;

  if (!notes || !notes.trim()) {
    return res.status(400).json({ error: 'No notes provided' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set');
    return res.status(500).json({ error: 'AI service not configured' });
  }

  const systemPrompt = `You are a specialist writing a brief parent-friendly summary of a therapy/clinical session.
Write 2-4 sentences that are warm, encouraging, and free of clinical jargon.
Focus on what the child worked on, any progress observed, and what parents can do at home.
Use the child's name naturally. Do not include greetings, sign-offs, or bullet points — just the summary paragraph.
IMPORTANT: Write your summary in the SAME LANGUAGE as the session notes. If the notes are in Hebrew, write the summary in Hebrew. If in English, write in English. Keep the tone warm and accessible regardless of language.`;

  const userPrompt = `Here are the session notes for ${childName || 'the child'}. Write a parent-friendly summary:\n\n${notes}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('Anthropic API error:', response.status, err);
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const summary = data.content?.[0]?.text || '';

    if (!summary) {
      return res.status(500).json({ error: 'Empty response from AI' });
    }

    res.status(200).json({ summary });
  } catch (err) {
    console.error('AI summary error:', err);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
}
