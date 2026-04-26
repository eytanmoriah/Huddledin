// Supabase read/write helpers for homework + exercises

function _supa() { return window.HUD?._supa; }
function _session() { return window.HUD?.session; }

export async function createHomework({ childId, householdId, title, description, recurrence, specificDays, durationType, endDate, timeOfDay, isPinned, attachedFileUrls, attachedFileNames, exercises }) {
  const supa = _supa();
  const sess = _session();
  if (!supa || !sess) throw new Error('Not authenticated');

  const specId = sess.specialistId || sess.id;
  const specName = sess.displayName || sess.name || 'Specialist';

  const { data: hw, error: hwErr } = await supa.from('homework_tasks').insert({
    child_id: childId,
    household_id: householdId,
    specialist_id: specId,
    specialist_name: specName,
    title,
    description: description || null,
    recurrence: recurrence || 'daily',
    specific_days: specificDays || null,
    duration_type: durationType || 'open_ended',
    end_date: endDate || null,
    time_of_day: timeOfDay || 'morning',
    is_pinned: isPinned || false,
    is_paused: false,
    status: 'active',
    attached_file_urls: attachedFileUrls || [],
    attached_file_names: attachedFileNames || [],
  }).select('id').single();

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

  return { homeworkId: hw.id };
}

export async function updateHomework({ homeworkId, title, description, recurrence, specificDays, durationType, endDate, timeOfDay, isPinned, attachedFileUrls, attachedFileNames, exercises }) {
  const supa = _supa();
  if (!supa) throw new Error('Not authenticated');

  const { error: hwErr } = await supa.from('homework_tasks').update({
    title,
    description: description || null,
    recurrence: recurrence || 'daily',
    specific_days: specificDays || null,
    duration_type: durationType || 'open_ended',
    end_date: endDate || null,
    time_of_day: timeOfDay || 'morning',
    is_pinned: isPinned || false,
    attached_file_urls: attachedFileUrls || [],
    attached_file_names: attachedFileNames || [],
    updated_at: new Date().toISOString(),
  }).eq('id', homeworkId);

  if (hwErr) { console.error('\u274c homework update:', hwErr); throw hwErr; }

  const { data: existing, error: exLoadErr } = await supa.from('homework_exercises')
    .select('id').eq('homework_id', homeworkId);
  if (exLoadErr) console.error('\u274c load exercises:', exLoadErr);

  const existingIds = new Set((existing || []).map(e => e.id));
  const newExercises = [];
  const updateExercises = [];

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
      updateExercises.push({ ...row, id: ex.id });
      existingIds.delete(ex.id);
    } else {
      newExercises.push(row);
    }
  });

  const toDelete = [...existingIds];
  if (toDelete.length) {
    const { error } = await supa.from('homework_exercises').delete().in('id', toDelete);
    if (error) console.error('\u274c delete exercises:', error);
  }
  for (const ex of updateExercises) {
    const { id, ...patch } = ex;
    const { error } = await supa.from('homework_exercises').update(patch).eq('id', id);
    if (error) console.error('\u274c update exercise:', error);
  }
  if (newExercises.length) {
    const { error } = await supa.from('homework_exercises').insert(newExercises);
    if (error) console.error('\u274c insert exercises:', error);
  }

  return { homeworkId };
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
