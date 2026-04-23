// Specialist phrase library — CRUD for specialist_phrases table

export async function loadPhrases() {
  const { _supa, session } = window.HUD || {};
  if (!_supa || !session) return [];
  try {
    const { data, error } = await _supa.from('specialist_phrases').select('*').eq('specialist_id', session.id).order('updated_at', { ascending: false });
    if (error) { console.error('\u274c loadPhrases:', error.message); return []; }
    return data || [];
  } catch (e) { console.error('\u274c loadPhrases:', e); return []; }
}

export async function savePhrase({ phraseId, name, content }) {
  const { _supa, session } = window.HUD || {};
  if (!_supa || !session) return { error: 'Not authenticated' };
  const n = (name || '').trim();
  const c = (content || '').trim();
  if (!n || n.length > 100) return { error: 'Name must be 1\u2013100 characters' };
  if (!c || c.length > 5000) return { error: 'Content must be 1\u20135000 characters' };
  try {
    if (phraseId) {
      const { error } = await _supa.from('specialist_phrases').update({ name: n, content: c, updated_at: new Date().toISOString() }).eq('id', phraseId);
      if (error) { console.error('\u274c savePhrase update:', error); return { error: error.message }; }
      return { id: phraseId };
    }
    const { data, error } = await _supa.from('specialist_phrases').insert({ specialist_id: session.id, name: n, content: c }).select('id').single();
    if (error) { console.error('\u274c savePhrase insert:', error); return { error: error.message }; }
    return { id: data.id };
  } catch (e) {
    console.error('\u274c savePhrase:', e);
    return { error: e.message };
  }
}

export async function deletePhrase(phraseId) {
  const { _supa } = window.HUD || {};
  if (!_supa) return { error: 'Not authenticated' };
  try {
    const { error } = await _supa.from('specialist_phrases').delete().eq('id', phraseId);
    if (error) { console.error('\u274c deletePhrase:', error); return { error: error.message }; }
    return {};
  } catch (e) {
    console.error('\u274c deletePhrase:', e);
    return { error: e.message };
  }
}
