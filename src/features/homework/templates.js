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

// Schedule fields (recurrence, specific_days, duration_type, time_of_day) on homework_templates
// are dormant per locked design decision (May 7, 2026). Templates carry title + exercises only;
// schedule is configured fresh per patient. Columns retained for potential HIPAA-pass cleanup.
export async function saveHomeworkTemplate({ title, description, exercisesJson }) {
  const supa = _supa();
  const sess = _session();
  if (!supa || !sess) throw new Error('Not authenticated');
  const specId = sess.specialistId || sess.id;
  const { data, error } = await supa.from('homework_templates').insert({
    specialist_id: specId,
    title,
    description: description || null,
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

export async function loadHomeworkTemplate(id) {
  const supa = _supa();
  if (!supa) return null;
  const { data, error } = await supa.from('homework_templates').select('*').eq('id', id).single();
  if (error) { console.error('❌ load homework template:', error); return null; }
  return data;
}

export async function updateHomeworkTemplate(id, { title, description }) {
  const supa = _supa();
  if (!supa) throw new Error('Not authenticated');
  const patch = { updated_at: new Date().toISOString() };
  if (title !== undefined) patch.title = title;
  if (description !== undefined) patch.description = description || null;
  const { error } = await supa.from('homework_templates').update(patch).eq('id', id);
  if (error) { console.error('❌ update homework template:', error); throw error; }
}

export async function deleteHomeworkTemplate(id) {
  const supa = _supa();
  if (!supa) throw new Error('Not authenticated');
  const { error } = await supa.from('homework_templates').delete().eq('id', id);
  if (error) { console.error('❌ delete homework template:', error); throw error; }
}

// ── Exercise templates (Template Library Sub-commit 2 of 5) ──

export async function loadExerciseTemplates() {
  const supa = _supa();
  const sess = _session();
  if (!supa || !sess) return [];
  const { data, error } = await supa.from('exercise_templates').select('*').order('name', { ascending: true });
  if (error) { console.error('❌ load exercise templates:', error); return []; }
  return data || [];
}

export async function saveExerciseTemplate({ name, instructions, reps, sets, durationSeconds, measureUnit, attachedFilePaths, attachedFileNames }) {
  const supa = _supa();
  const sess = _session();
  if (!supa || !sess) throw new Error('Not authenticated');
  const specId = sess.specialistId || sess.id;
  const { data, error } = await supa.from('exercise_templates').insert({
    specialist_id: specId,
    name,
    instructions: instructions || null,
    reps: reps ?? null,
    sets: sets ?? null,
    duration_seconds: durationSeconds ?? null,
    measure_unit: measureUnit || null,
    attached_file_paths: attachedFilePaths || [],
    attached_file_names: attachedFileNames || [],
  }).select('id').single();
  if (error) { console.error('❌ save exercise template:', error); throw error; }
  return { id: data.id };
}

export async function updateExerciseTemplate(id, { name, instructions, reps, sets, durationSeconds, measureUnit, attachedFilePaths, attachedFileNames }) {
  const supa = _supa();
  if (!supa) throw new Error('Not authenticated');
  const patch = { updated_at: new Date().toISOString() };
  if (name !== undefined) patch.name = name;
  if (instructions !== undefined) patch.instructions = instructions || null;
  if (reps !== undefined) patch.reps = reps ?? null;
  if (sets !== undefined) patch.sets = sets ?? null;
  if (durationSeconds !== undefined) patch.duration_seconds = durationSeconds ?? null;
  if (measureUnit !== undefined) patch.measure_unit = measureUnit || null;
  if (attachedFilePaths !== undefined) patch.attached_file_paths = attachedFilePaths || [];
  if (attachedFileNames !== undefined) patch.attached_file_names = attachedFileNames || [];
  const { error } = await supa.from('exercise_templates').update(patch).eq('id', id);
  if (error) { console.error('❌ update exercise template:', error); throw error; }
}

export async function deleteExerciseTemplate(id) {
  const supa = _supa();
  if (!supa) throw new Error('Not authenticated');
  const { error } = await supa.from('exercise_templates').delete().eq('id', id);
  if (error) { console.error('❌ delete exercise template:', error); throw error; }
}

export async function incrementExerciseTemplateUseCount(id) {
  const supa = _supa();
  if (!supa || !id) return;
  const { data, error } = await supa.from('exercise_templates').select('times_used').eq('id', id).single();
  if (error) { console.error('❌ read exercise template use_count:', error); return; }
  const { error: upErr } = await supa.from('exercise_templates').update({ times_used: ((data?.times_used) || 0) + 1 }).eq('id', id);
  if (upErr) console.error('❌ increment exercise template use_count:', upErr);
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
