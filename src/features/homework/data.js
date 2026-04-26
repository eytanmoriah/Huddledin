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

export async function loadHomeworksForChild(childId, includeArchived = false) {
  const supa = _supa();
  if (!supa) return [];
  const statuses = includeArchived ? ['active', 'archived'] : ['active'];
  const { data: tasks, error: tErr } = await supa.from('homework_tasks')
    .select('*')
    .eq('child_id', childId)
    .in('status', statuses)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (tErr) { console.error('\u274c loadHomeworksForChild:', tErr); return []; }
  if (!tasks?.length) return [];

  const taskIds = tasks.map(t => t.id);
  const { data: exercises, error: eErr } = await supa.from('homework_exercises')
    .select('*')
    .in('homework_id', taskIds)
    .order('position');
  if (eErr) console.error('\u274c loadExercisesForHomeworks:', eErr);

  const exMap = {};
  (exercises || []).forEach(ex => {
    if (!exMap[ex.homework_id]) exMap[ex.homework_id] = [];
    exMap[ex.homework_id].push(ex);
  });

  return tasks.map(t => ({ ...t, exercises: exMap[t.id] || [] }));
}

const _pad = n => String(n).padStart(2, '0');
const _fmtLocal = d => d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate());

// Reads from local DB.homeworkOccurrences cache; accuracy depends on realtime sync (~500ms debounce).
export function computeWeekStats(homeworks, occurrences) {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = _fmtLocal(weekStart);
  const sundayEnd = new Date(weekStart);
  sundayEnd.setDate(sundayEnd.getDate() + 6);
  const weekEndStr = _fmtLocal(sundayEnd);

  const stats = {};
  homeworks.forEach(hw => {
    const hwOccs = (occurrences || []).filter(o =>
      o.taskId === hw.id && o.date >= weekStartStr && o.date <= weekEndStr
    );
    const scheduled = hwOccs.length;
    const done = hwOccs.filter(o => o.status === 'completed').length;
    stats[hw.id] = { done, scheduled };
  });
  return stats;
}

export async function loadHomeworkDetail(homeworkId) {
  const supa = _supa();
  if (!supa) return null;

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const sinceStr = _fmtLocal(fourteenDaysAgo);

  const [hwRes, exRes, occRes, compRes, cmtRes] = await Promise.all([
    supa.from('homework_tasks').select('*').eq('id', homeworkId).single(),
    supa.from('homework_exercises').select('*').eq('homework_id', homeworkId).order('position'),
    supa.from('homework_occurrences').select('*').eq('task_id', homeworkId).gte('scheduled_date', sinceStr).order('scheduled_date'),
    supa.from('homework_completions').select('*').eq('task_id', homeworkId).order('completed_at', { ascending: false }),
    supa.from('homework_comments').select('*').eq('task_id', homeworkId).order('created_at'),
  ]);

  if (hwRes.error) { console.error('\u274c loadHomeworkDetail hw:', hwRes.error); return null; }
  if (exRes.error) console.error('\u274c loadHomeworkDetail ex:', exRes.error);
  if (occRes.error) console.error('\u274c loadHomeworkDetail occ:', occRes.error);
  if (compRes.error) console.error('\u274c loadHomeworkDetail comp:', compRes.error);
  if (cmtRes.error) console.error('\u274c loadHomeworkDetail cmt:', cmtRes.error);

  return {
    homework: hwRes.data,
    exercises: exRes.data || [],
    occurrences: occRes.data || [],
    completions: compRes.data || [],
    comments: cmtRes.data || [],
  };
}

export async function postComment({ completionId, taskId, childId, householdId, comment }) {
  const supa = _supa();
  const sess = _session();
  if (!supa || !sess) throw new Error('Not authenticated');
  const specId = sess.specialistId || sess.id;

  const { data, error } = await supa.from('homework_comments').insert({
    completion_id: completionId,
    task_id: taskId,
    specialist_id: specId,
    comment,
    household_id: String(householdId),
    child_id: childId,
  }).select('id, created_at').single();

  if (error) { console.error('\u274c postComment:', error); throw error; }
  return { id: data.id, createdAt: data.created_at };
}

// ── Schedule resolution helpers ──

export function resolveExerciseSchedule(homework, exercise) {
  return {
    recurrence: exercise.override_recurrence || homework.recurrence || 'daily',
    // A1: nullish coalescing for array — [] is a valid override meaning "no days"
    specificDays: exercise.override_specific_days ?? homework.specific_days ?? [],
    timeSlots: (exercise.override_time_of_day || homework.time_of_day || 'morning')
      .split(',').filter(Boolean),
  };
}

export function isExerciseScheduledOn(homework, exercise, date) {
  if (homework.is_paused) return false;
  if (homework.status !== 'active') return false;

  const sched = resolveExerciseSchedule(homework, exercise);
  const dateStr = _fmtLocal(date);

  // Never scheduled before homework was created
  const createdDate = new Date(homework.created_at || Date.now());
  const startStr = _fmtLocal(createdDate);
  if (dateStr < startStr) return false;

  // End date check
  if (homework.duration_type === 'end_date' && homework.end_date && dateStr > homework.end_date) return false;

  // Recurrence rules
  // A3: 'once' uses creation date (matches v1 — once = today only)
  if (sched.recurrence === 'once') return dateStr === startStr;
  if (sched.recurrence === 'daily') return true;
  if (sched.recurrence === 'every_other_day') {
    // A2: DST-safe day diff using local midnight
    const dayMs = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((dayMs(date) - dayMs(createdDate)) / 86400000);
    return diffDays >= 0 && diffDays % 2 === 0;
  }
  if (sched.recurrence === 'specific_days') {
    const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];
    return (sched.specificDays || []).includes(dayKey);
  }
  return false;
}

export function exerciseSlotsOn(homework, exercise, date) {
  if (!isExerciseScheduledOn(homework, exercise, date)) return [];
  return resolveExerciseSchedule(homework, exercise).timeSlots;
}

// ── Parent reads ──

export async function loadHomeworkForParent(childId) {
  const supa = _supa();
  if (!supa) return [];
  const { data: tasks, error: tErr } = await supa.from('homework_tasks')
    .select('*')
    .eq('child_id', childId)
    .eq('status', 'active')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (tErr) { console.error('\u274c loadHomeworkForParent:', tErr); return []; }
  if (!tasks?.length) return [];

  const taskIds = tasks.map(t => t.id);
  const { data: exercises, error: eErr } = await supa.from('homework_exercises')
    .select('*')
    .in('homework_id', taskIds)
    .order('position');
  if (eErr) console.error('\u274c loadExercisesForParent:', eErr);

  const exMap = {};
  (exercises || []).forEach(ex => {
    if (!exMap[ex.homework_id]) exMap[ex.homework_id] = [];
    exMap[ex.homework_id].push(ex);
  });

  return tasks.map(t => ({ ...t, exercises: exMap[t.id] || [] }));
}

export async function loadCompletionsV2(childId, sinceDate) {
  const supa = _supa();
  if (!supa) return [];
  const sinceStr = _fmtLocal(sinceDate);
  const { data, error } = await supa.from('homework_completions_v2')
    .select('*')
    .eq('child_id', childId)
    .gte('scheduled_date', sinceStr)
    .order('logged_at', { ascending: false });
  if (error) { console.error('\u274c loadCompletionsV2:', error); return []; }
  return data || [];
}

export async function logExerciseCompletion({ homework, exercise, scheduledDate, slot, status, note, photoUrl, actualValue, childId }) {
  const supa = _supa();
  const sess = _session();
  if (!supa || !sess) throw new Error('Not authenticated');

  const { error: v2Err } = await supa.from('homework_completions_v2').insert({
    homework_exercise_id: exercise.id,
    homework_id: homework.id,
    child_id: childId,
    household_id: String(homework.household_id),
    scheduled_date: scheduledDate,
    slot: slot || null,
    status,
    note: note || null,
    photo_url: photoUrl || null,
    actual_value: actualValue ?? null,
    logged_by: sess.id,
  });

  if (v2Err) {
    if (v2Err.code === '23505' || /duplicate key|unique constraint/i.test(v2Err.message || '')) {
      return { alreadyMarked: true };
    }
    console.error('\u274c logExerciseCompletion v2:', v2Err);
    throw v2Err;
  }

  // Dual-write to v1 only for 'done' status (old schema can't represent skipped/cant_do)
  if (status === 'done') {
    try {
      const { data: occ } = await supa.from('homework_occurrences')
        .select('id')
        .eq('task_id', homework.id)
        .eq('scheduled_date', scheduledDate)
        .eq('time_of_day', slot || 'morning')
        .limit(1);
      if (occ?.length) {
        const { error: occErr } = await supa.from('homework_occurrences').update({ status: 'completed' }).eq('id', occ[0].id);
        if (occErr) console.error('\u274c v1 occurrence update:', occErr);
        const { error: compErr } = await supa.from('homework_completions').insert({
          occurrence_id: occ[0].id,
          task_id: homework.id,
          child_id: childId,
          completed_by: sess.id,
          note: note || null,
          photo_url: photoUrl || null,
          completed_at: new Date().toISOString(),
        });
        if (compErr) console.error('\u274c v1 completion insert:', compErr);
      }
    } catch (e) { console.error('\u274c v1 dual-write:', e); }
  }

  // Notification to specialist
  const H = window.HUD || {};
  if (status === 'done' || status === 'cant_do') {
    try {
      const child = H.DB?.children?.find(c => c.id === childId);
      const notifMsg = status === 'done'
        ? H.T?.('notif_task_completed', { child: child?.name || 'Child', title: exercise.title?.slice(0, 42) || homework.title?.slice(0, 42) })
        : H.T?.('hw4_notif_cant_do', { child: child?.name || 'Child', title: exercise.title?.slice(0, 42) || homework.title?.slice(0, 42) });
      await H.notifyOtherParty?.('homework', notifMsg, childId, 'homework', null, homework.specialist_id || null);
    } catch (e) { console.error('\u274c completion notify:', e); }
  }

  return { alreadyMarked: false };
}

export async function deleteHomework(homeworkId) {
  const supa = _supa();
  if (!supa) throw new Error('Not authenticated');
  const { error } = await supa.from('homework_tasks').update({ status: 'deleted', updated_at: new Date().toISOString() }).eq('id', homeworkId);
  if (error) { console.error('\u274c delete homework:', error); throw error; }
}
