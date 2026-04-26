// Homework template picker + save-as-template

const T = (k, p) => window.HUD?.T?.(k, p) || k;

function _supa() { return window.HUD?._supa; }
function _session() { return window.HUD?.session; }

export async function loadHomeworkTemplates() {
  const supa = _supa();
  const sess = _session();
  if (!supa || !sess) return [];
  const specId = sess.specialistId || sess.id;
  const { data, error } = await supa.from('homework_templates').select('*').eq('specialist_id', specId).order('times_used', { ascending: false });
  if (error) { console.error('\u274c load hw templates:', error); return []; }
  return data || [];
}

export async function saveHomeworkTemplate({ title, description, recurrence, specificDays, durationType, timeOfDay, exercisesJson }) {
  const supa = _supa();
  const sess = _session();
  if (!supa || !sess) throw new Error('Not authenticated');
  const specId = sess.specialistId || sess.id;
  const { data, error } = await supa.from('homework_templates').insert({
    specialist_id: specId,
    title,
    description: description || null,
    recurrence: recurrence || 'daily',
    specific_days: specificDays || null,
    duration_type: durationType || 'open_ended',
    time_of_day: timeOfDay || 'morning',
    exercises_json: exercisesJson || null,
  }).select('id').single();
  if (error) { console.error('\u274c save hw template:', error); throw error; }
  return { id: data.id };
}

export async function incrementTemplateUseCount(templateId) {
  const supa = _supa();
  if (!supa || !templateId) return;
  const { data, error } = await supa.from('homework_templates').select('times_used').eq('id', templateId).single();
  if (error) { console.error('\u274c read template use_count:', error); return; }
  const { error: upErr } = await supa.from('homework_templates').update({ times_used: ((data?.times_used) || 0) + 1 }).eq('id', templateId);
  if (upErr) console.error('\u274c increment template use_count:', upErr);
}

export function openTemplatePicker({ onPick, onCancel }) {
  const H = window.HUD || {};
  const { openModal, el, toast } = H;
  if (!openModal) return;

  loadHomeworkTemplates().then(templates => {
    if (!templates.length) { toast?.('No templates saved yet. Create homework and check "Save as template".', 'info'); onCancel?.(); return; }
    openModal(T('hw2_pick_template'), (mb, close) => {
      templates.forEach(tmpl => {
        const row = el('div', { class: 'card hov', style: { marginBottom: '8px', padding: '13px', cursor: 'pointer' } });
        row.appendChild(el('div', { style: { fontWeight: 700, color: 'var(--navy)', fontSize: '.88rem', marginBottom: '3px' } }, [tmpl.title]));
        const meta = [];
        if (tmpl.recurrence) meta.push(tmpl.recurrence === 'daily' ? 'Daily' : tmpl.recurrence === 'specific_days' ? 'Some days' : tmpl.recurrence === 'once' ? 'Once' : 'Every other day');
        if (tmpl.exercises_json?.length) meta.push(tmpl.exercises_json.length + ' exercise' + (tmpl.exercises_json.length !== 1 ? 's' : ''));
        if (tmpl.times_used) meta.push('Used ' + tmpl.times_used + '\u00d7');
        if (meta.length) row.appendChild(el('div', { style: { fontSize: '.73rem', color: 'var(--slate)', fontWeight: 600 } }, [meta.join(' \u00b7 ')]));
        row.onclick = () => { close(); incrementTemplateUseCount(tmpl.id); onPick(tmpl); };
        mb.appendChild(row);
      });
    }, 480);
  });
}
