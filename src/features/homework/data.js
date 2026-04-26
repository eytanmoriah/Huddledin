// Supabase read/write helpers for homework + exercises

function _supa() { return window.HUD?._supa; }
function _session() { return window.HUD?.session; }

export async function createHomework({ homework, exercises }) {
  const supa = _supa();
  const sess = _session();
  if (!supa || !sess) throw new Error('Not authenticated');

  const specId = sess.specialistId || sess.id;
  const specName = sess.displayName || sess.name || 'Specialist';

  const { data: hw, error: hwErr } = await supa.from('homework_tasks').insert({
    child_id: homework.childId,
    household_id: String(homework.householdId),
    specialist_id: specId,
    specialist_name: specName,
    title: homework.title,
    description: homework.description || null,
    recurrence: homework.recurrence || 'daily',
    specific_days: homework.specificDays || null,
    duration_type: homework.durationType || 'open_ended',
    end_date: homework.endDate || null,
    time_of_day: homework.timeOfDay || '',
    is_pinned: homework.isPinned || false,
    is_paused: false,
    status: 'active',
    attached_file_urls: homework.attachedFileUrls || [],
    attached_file_names: homework.attachedFileNames || [],
  }).select('*').single();

  if (hwErr) { console.error('\u274c homework insert:', hwErr); throw hwErr; }

  const exRows = (exercises || []).map((ex, i) => ({
    homework_id: hw.id,
    position: i,
    title: ex.title,
    instructions: ex.instructions || null,
    reps: ex.reps || null,
    sets: ex.sets || null,
    duration_seconds: ex.durationSeconds || null,
    measure_unit: ex.measureUnit || null,
    override_recurrence: ex.overrideRecurrence || null,
    override_specific_days: ex.overrideSpecificDays || null,
    override_time_of_day: ex.overrideTimeOfDay || null,
    attached_file_urls: ex.attachedFileUrls || [],
    attached_file_names: ex.attachedFileNames || [],
  }));

  if (exRows.length) {
    const { error: exErr } = await supa.from('homework_exercises').insert(exRows);
    if (exErr) {
      console.error('\u274c exercises insert:', exErr);
      await supa.from('homework_tasks').delete().eq('id', hw.id);
      throw exErr;
    }
  }

  return { homeworkId: hw.id, homeworkRow: hw };
}

export async function updateHomework({ homeworkId, homework, exercises }) {
  const supa = _supa();
  if (!supa) throw new Error('Not authenticated');

  const { error: hwErr } = await supa.from('homework_tasks').update({
    title: homework.title,
    description: homework.description || null,
    recurrence: homework.recurrence || 'daily',
    specific_days: homework.specificDays || null,
    duration_type: homework.durationType || 'open_ended',
    end_date: homework.endDate || null,
    time_of_day: homework.timeOfDay || '',
    is_pinned: homework.isPinned || false,
    attached_file_urls: homework.attachedFileUrls || [],
    attached_file_names: homework.attachedFileNames || [],
    updated_at: new Date().toISOString(),
  }).eq('id', homeworkId);

  if (hwErr) { console.error('\u274c homework update:', hwErr); throw hwErr; }

  const { data: existing, error: exLoadErr } = await supa.from('homework_exercises')
    .select('id').eq('homework_id', homeworkId);
  if (exLoadErr) console.error('\u274c load exercises:', exLoadErr);

  const existingIds = new Set((existing || []).map(e => e.id));
  const toInsert = [];
  const toUpdate = [];

  (exercises || []).forEach((ex, i) => {
    const row = {
      homework_id: homeworkId,
      position: i,
      title: ex.title,
      instructions: ex.instructions || null,
      reps: ex.reps || null,
      sets: ex.sets || null,
      duration_seconds: ex.durationSeconds || null,
      measure_unit: ex.measureUnit || null,
      override_recurrence: ex.overrideRecurrence || null,
      override_specific_days: ex.overrideSpecificDays || null,
      override_time_of_day: ex.overrideTimeOfDay || null,
      attached_file_urls: ex.attachedFileUrls || [],
      attached_file_names: ex.attachedFileNames || [],
      updated_at: new Date().toISOString(),
    };
    if (ex.id && existingIds.has(ex.id)) {
      toUpdate.push({ ...row, id: ex.id });
      existingIds.delete(ex.id);
    } else {
      toInsert.push(row);
    }
  });

  const toDelete = [...existingIds];
  const errors = [];
  if (toDelete.length) {
    const { error } = await supa.from('homework_exercises').delete().in('id', toDelete);
    if (error) { console.error('\u274c delete exercises:', error); errors.push(error); }
  }
  for (const ex of toUpdate) {
    const { id, ...patch } = ex;
    const { error } = await supa.from('homework_exercises').update(patch).eq('id', id);
    if (error) { console.error('\u274c update exercise:', error); errors.push(error); }
  }
  if (toInsert.length) {
    const { error } = await supa.from('homework_exercises').insert(toInsert);
    if (error) { console.error('\u274c insert exercises:', error); errors.push(error); }
  }

  return { homeworkId, updated: toUpdate.length, inserted: toInsert.length, deleted: toDelete.length, errors };
}

export async function loadHomeworkWithExercises(homeworkId) {
  const supa = _supa();
  if (!supa) return null;

  const [hwRes, exRes] = await Promise.all([
    supa.from('homework_tasks').select('*').eq('id', homeworkId).single(),
    supa.from('homework_exercises').select('*').eq('homework_id', homeworkId).order('position'),
  ]);

  if (hwRes.error) { console.error('\u274c load homework:', hwRes.error); return null; }
  return { homework: hwRes.data, exercises: exRes.data || [] };
}

export async function deleteHomework(homeworkId) {
  const supa = _supa();
  if (!supa) throw new Error('Not authenticated');
  const { error } = await supa.from('homework_tasks').update({ status: 'deleted', updated_at: new Date().toISOString() }).eq('id', homeworkId);
  if (error) { console.error('\u274c delete homework:', error); throw error; }
}
