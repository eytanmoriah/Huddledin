import { createClient } from '@supabase/supabase-js';

const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = 20;

let _supa;
function getSupa() {
  if (_supa) return _supa;
  const url = process.env.SUPABASE_URL || 'https://smgbojgrdezasxciloll.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  _supa = createClient(url, key);
  return _supa;
}

export async function checkRateLimit(userId, endpoint) {
  if (userId === 'demo') return { ok: true, count: 0 };

  const supa = getSupa();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const { count, error } = await supa
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('called_at', since);

  if (error) {
    console.error('❌ rate-limit lookup:', error);
    return { ok: true, count: 0 };
  }

  if (count >= LIMIT) {
    console.warn(`⚠️ rate-limit HIT user=${userId} endpoint=${endpoint} count=${count}`);
    return { ok: false, count };
  }

  supa.from('ai_usage').insert({ user_id: userId, endpoint }).then(r => {
    if (r.error) console.error('❌ ai_usage insert:', r.error);
  });

  return { ok: true, count };
}

export const RATE_LIMIT = LIMIT;
export const RATE_WINDOW_SECONDS = WINDOW_MS / 1000;
