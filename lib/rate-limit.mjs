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

// `limit` defaults to 20 (the original constant) for backward compat with
// existing callers (api/ai-summary.mjs, api/report-ai.mjs).
// On DB lookup error this now FAILS CLOSED (returns ok:false + retryAfter)
// instead of silently allowing — closes audit Report 06 #11.
export async function checkRateLimit(userId, endpoint, limit = LIMIT) {
  if (userId === 'demo') return { ok: true, count: 0 };

  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const retryAfter = WINDOW_MS / 1000;

  let count, error;
  try {
    const supa = getSupa();
    const r = await supa
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('called_at', since);
    count = r.count;
    error = r.error;
  } catch (e) {
    error = e;
  }

  if (error) {
    console.error('❌ rate-limit lookup:', error);
    // Fail CLOSED — refuse the request when we can't verify the count.
    return { ok: false, count: 0, retryAfter };
  }

  if (count >= limit) {
    console.warn(`⚠️ rate-limit HIT user=${userId} endpoint=${endpoint} count=${count} limit=${limit}`);
    return { ok: false, count, retryAfter };
  }

  // Best-effort insert. Note: this remains fire-and-forget per existing behavior;
  // audit Report 06 #12 (race-window before insert lands) is a separate concern.
  getSupa().from('ai_usage').insert({ user_id: userId, endpoint }).then(r => {
    if (r.error) console.error('❌ ai_usage insert:', r.error);
  });

  return { ok: true, count };
}

export const RATE_LIMIT = LIMIT;
export const RATE_WINDOW_SECONDS = WINDOW_MS / 1000;
