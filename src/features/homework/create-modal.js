// Homework creation/edit modal

import { createHomework, updateHomework, loadHomeworkWithExercises, deleteHomework } from './data.js';
import { renderScheduleBlock, scheduleSummary } from './schedule.js';
import { renderExerciseRows } from './exercises.js';
import { saveHomeworkTemplate } from './templates.js';
import { injectHomeworkStyles } from './styles.js';

const T = (k, p) => window.HUD?.T?.(k, p) || k;

export function mountHomeworkCreateModal(opts = {}) {
  injectHomeworkStyles();
  const { childId, homeworkId, template } = opts;
  const H = window.HUD || {};
  const child = H.DB?.children?.find(c => c.id === childId);
  const childName = child?.name || 'Patient';
  const isEdit = !!homeworkId;

  const state = {
    homework: {
      childId,
      householdId: child?.householdId || H.session?.householdId || null,
      title: '',
      description: '',
      recurrence: 'daily',
      specificDays: [],
      timeOfDay: 'morning',  // C1: default to 'morning', not ''
      durationType: 'open_ended',
      endDate: null,
      isPinned: false,
      attachedFileUrls: [],
      attachedFileNames: [],
    },
    exercises: [
      { title: '', instructions: '', reps: null, sets: null, durationSeconds: null, measureUnit: null, overrideRecurrence: null, overrideSpecificDays: null, overrideTimeOfDay: null, attachedFileUrls: [], attachedFileNames: [], _ui: { expanded: false } }
    ],
    saving: false,
    dirty: false,
  };

  // Pre-fill from template
  if (template && !isEdit) {
    state.homework.title = template.title || '';
    state.homework.description = template.description || '';
    state.homework.recurrence = template.recurrence || 'daily';
    state.homework.specificDays = template.specific_days || [];
    state.homework.timeOfDay = template.time_of_day || 'morning';
    state.homework.durationType = template.duration_type || 'open_ended';
    if (template.exercises_json?.length) {
      state.exercises = template.exercises_json.map(ex => ({
        title: ex.title || '', instructions: ex.instructions || '', reps: ex.reps || null, sets: ex.sets || null,
        durationSeconds: ex.durationSeconds || null, measureUnit: ex.measureUnit || null,
        overrideRecurrence: ex.overrideRecurrence || null, overrideSpecificDays: ex.overrideSpecificDays || null,
        overrideTimeOfDay: ex.overrideTimeOfDay || null, attachedFileUrls: [], attachedFileNames: [], _ui: { expanded: false },
      }));
    }
  }

  // ── Modal shell ──
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:450;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;';

  const card = document.createElement('div');
  card.className = 'hw2-modal';

  function closeModal() {
    if (state.dirty) {
      const c = H.openConfirm;
      if (c) { c(T('hw2_discard_title'), T('hw2_discard_body'), true, () => overlay.remove()); return; }
    }
    overlay.remove();
  }

  // ── Sticky header ──
  const header = document.createElement('div');
  header.className = 'hw2-header';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '\u2715';
  closeBtn.style.cssText = 'width:32px;height:32px;border-radius:50%;border:none;background:#e8f4f2;cursor:pointer;font-size:16px;color:#64748b;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
  closeBtn.onclick = closeModal;
  header.appendChild(closeBtn);

  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'flex:1;text-align:center;font-size:15px;font-weight:700;color:#0f1a18;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 8px;';
  titleEl.textContent = (isEdit ? T('hw2_edit_title') : T('hw2_new_title')) + ' \u00b7 ' + childName;
  header.appendChild(titleEl);

  // C6: "Save quietly" button (create mode only, skips notification)
  let quietBtn = null;
  if (!isEdit) {
    quietBtn = document.createElement('button');
    quietBtn.textContent = T('hw2_save_quiet');
    quietBtn.style.cssText = 'padding:6px 10px;border:1.5px solid #d1e0dd;border-radius:8px;background:#fff;color:#64748b;font-size:12px;cursor:pointer;font-family:inherit;font-weight:500;flex-shrink:0;';
    quietBtn.disabled = true;
    header.appendChild(quietBtn);
  }

  const saveBtn = document.createElement('button');
  saveBtn.textContent = isEdit ? T('hw2_save_changes') : T('hw2_save_send');
  saveBtn.style.cssText = 'padding:6px 14px;border:none;border-radius:8px;background:#0d9488;color:#fff;font-size:13px;cursor:pointer;font-family:inherit;font-weight:600;flex-shrink:0;';
  saveBtn.disabled = true;
  header.appendChild(saveBtn);

  card.appendChild(header);

  // ── Body ──
  const body = document.createElement('div');
  body.className = 'hw2-body';

  // Title input
  const titleInp = document.createElement('input');
  titleInp.type = 'text';
  titleInp.className = 'hw2-input';
  titleInp.placeholder = T('hw2_title_placeholder');
  titleInp.maxLength = 200;
  titleInp.style.cssText += 'font-weight:600;font-size:16px;margin-bottom:12px;';
  titleInp.oninput = () => { state.homework.title = titleInp.value; state.dirty = true; _updateSaveBtn(); };
  body.appendChild(titleInp);

  // Notes for parents
  const notesLabel = document.createElement('div');
  notesLabel.className = 'hw2-section-label';
  notesLabel.textContent = T('hw2_notes_label');
  body.appendChild(notesLabel);

  const notesInp = document.createElement('textarea');
  notesInp.className = 'hw2-input hw2-textarea';
  notesInp.placeholder = T('hw2_notes_placeholder');
  notesInp.style.marginBottom = '8px';
  notesInp.oninput = () => { state.homework.description = notesInp.value; state.dirty = true; };
  body.appendChild(notesInp);

  // Attach buttons
  const attachRow = document.createElement('div');
  attachRow.style.cssText = 'display:flex;gap:8px;margin-bottom:16px;';
  const attachFileBtn = document.createElement('button');
  attachFileBtn.className = 'hw2-ghost-btn';
  attachFileBtn.textContent = '\ud83d\udcce ' + T('hw2_attach_file');
  attachFileBtn.onclick = () => _uploadFiles();
  attachRow.appendChild(attachFileBtn);
  body.appendChild(attachRow);

  // File preview area
  const filePreview = document.createElement('div');
  filePreview.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;';
  body.appendChild(filePreview);

  function _renderFiles() {
    filePreview.innerHTML = '';
    state.homework.attachedFileUrls.forEach((url, i) => {
      const chip = document.createElement('div');
      chip.style.cssText = 'display:flex;align-items:center;gap:4px;background:#f0fdf9;border:1px solid #d1e0dd;border-radius:6px;padding:4px 8px;font-size:12px;color:#0f1a18;';
      const isImg = /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);
      if (isImg) { const img = document.createElement('img'); img.src = url; img.style.cssText = 'width:20px;height:20px;object-fit:cover;border-radius:3px;'; chip.appendChild(img); }
      else chip.appendChild(document.createTextNode('\ud83d\udcc4'));
      chip.appendChild(document.createTextNode(state.homework.attachedFileNames[i] || 'File'));
      const rm = document.createElement('button');
      rm.textContent = '\u2715';
      rm.style.cssText = 'background:none;border:none;cursor:pointer;color:#94a3b8;font-size:12px;padding:0 2px;';
      rm.onclick = () => { state.homework.attachedFileUrls.splice(i, 1); state.homework.attachedFileNames.splice(i, 1); state.dirty = true; _renderFiles(); };
      chip.appendChild(rm);
      filePreview.appendChild(chip);
    });
  }

  async function _uploadFiles() {
    const fi = document.createElement('input');
    fi.type = 'file'; fi.multiple = true; fi.accept = 'image/*,video/*,.pdf,.doc,.docx';
    fi.onchange = async (ev) => {
      attachFileBtn.disabled = true; attachFileBtn.textContent = 'Uploading\u2026';
      try {
        for (const f of Array.from(ev.target.files)) {
          const { url } = await H.SB.uploadFile('homework/' + childId, f);
          state.homework.attachedFileUrls.push(url);
          state.homework.attachedFileNames.push(f.name);
        }
        state.dirty = true;
        _renderFiles();
      } catch (e) { console.error('hw file upload:', e); H.toast?.('Could not upload file.', 'error'); }
      attachFileBtn.disabled = false; attachFileBtn.textContent = '\ud83d\udcce ' + T('hw2_attach_file');
    };
    fi.click();
  }

  // Exercises section
  const exLabel = document.createElement('div');
  exLabel.className = 'hw2-section-label';
  exLabel.style.marginTop = '8px';
  function _updateExLabel() { exLabel.textContent = T('hw2_exercises_label') + ' \u00b7 ' + state.exercises.length + ' added'; }
  _updateExLabel();
  body.appendChild(exLabel);

  let exContainer = document.createElement('div');
  body.appendChild(exContainer);

  function _renderEx() {
    const newEl = renderExerciseRows(state.exercises, (exs) => { state.exercises = exs; state.dirty = true; _updateSaveBtn(); _updateExLabel(); }, state.homework);
    exContainer.replaceWith(newEl);
    exContainer = newEl;
  }

  // C5: schedule section with re-render helper
  const schLabel = document.createElement('div');
  schLabel.className = 'hw2-section-label';
  schLabel.textContent = T('hw2_when_label');
  schLabel.style.marginTop = '16px';
  body.appendChild(schLabel);

  let schContainer = document.createElement('div');
  body.appendChild(schContainer);

  function _renderSch() {
    const newEl = renderScheduleBlock(state.homework, (s) => { Object.assign(state.homework, s); state.dirty = true; });
    schContainer.replaceWith(newEl);
    schContainer = newEl;
  }

  // Save as template (create mode only)
  let _saveAsTemplate = false;
  let _tmplNameInp = null;
  if (!isEdit) {
    const tmplWrap = document.createElement('div');
    tmplWrap.style.cssText = 'margin-top:16px;padding-top:12px;border-top:1px solid #f1f5f9;';
    const tmplRow = document.createElement('div');
    tmplRow.style.cssText = 'display:flex;align-items:center;gap:10px;cursor:pointer;';
    const tmplChk = document.createElement('div');
    tmplChk.className = 'hw2-chk';
    tmplRow.onclick = () => {
      _saveAsTemplate = !_saveAsTemplate;
      tmplChk.className = 'hw2-chk' + (_saveAsTemplate ? ' checked' : '');
      tmplChk.textContent = _saveAsTemplate ? '\u2713' : '';
      tmplNameWrap.style.display = _saveAsTemplate ? 'block' : 'none';
    };
    tmplRow.appendChild(tmplChk);
    tmplRow.appendChild(document.createTextNode(T('hw2_save_template')));
    tmplWrap.appendChild(tmplRow);
    const tmplNameWrap = document.createElement('div');
    tmplNameWrap.style.cssText = 'display:none;margin-top:8px;';
    _tmplNameInp = document.createElement('input');
    _tmplNameInp.type = 'text';
    _tmplNameInp.className = 'hw2-input';
    _tmplNameInp.placeholder = T('hw2_template_name_placeholder');
    tmplNameWrap.appendChild(_tmplNameInp);
    tmplWrap.appendChild(tmplNameWrap);
    body.appendChild(tmplWrap);
  }

  // Delete button (edit mode only)
  if (isEdit) {
    const delWrap = document.createElement('div');
    delWrap.style.cssText = 'margin-top:24px;padding-top:16px;border-top:1px solid #f1f5f9;text-align:center;';
    const delBtn = document.createElement('button');
    delBtn.textContent = T('hw2_delete');
    delBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:#ef4444;font-size:13px;font-weight:500;font-family:inherit;';
    delBtn.onclick = () => {
      const c = H.openConfirm;
      if (c) c(T('hw2_delete_title'), T('hw2_delete_body'), true, async () => {
        try {
          await deleteHomework(homeworkId);
          overlay.remove();
          const all = H.DB?.homeworkTasks || [];
          const i = all.findIndex(t => t.id === homeworkId);
          if (i > -1) { all[i].status = 'deleted'; H.DB.homeworkTasks = all; }
          H.re?.(); H.toast?.(T('hw2_deleted'));
        } catch (e) { H.toast?.('Could not delete.', 'error'); }
      });
    };
    delWrap.appendChild(delBtn);
    body.appendChild(delWrap);
  }

  card.appendChild(body);
  overlay.appendChild(card);
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  document.body.appendChild(overlay);

  // ── Validation + save ──
  function _updateSaveBtn() {
    const hasTitle = state.homework.title.trim().length > 0;
    const hasExTitle = state.exercises.some(ex => (ex.title || '').trim().length > 0);
    const ok = hasTitle && hasExTitle && !state.saving;
    saveBtn.disabled = !ok;
    saveBtn.style.opacity = ok ? '1' : '0.5';
    if (quietBtn) { quietBtn.disabled = !ok; quietBtn.style.opacity = ok ? '1' : '0.5'; }
  }

  async function _doSave(notify) {
    const hw = state.homework;
    if (!hw.title.trim()) { H.toast?.(T('hw_title_required'), 'error'); return; }
    if (!state.exercises.some(ex => (ex.title || '').trim())) { H.toast?.(T('hw2_exercise_required'), 'error'); return; }
    if (hw.recurrence === 'specific_days' && (!hw.specificDays || !hw.specificDays.length)) { H.toast?.(T('hw_select_day'), 'error'); return; }
    if (hw.durationType === 'end_date' && !hw.endDate) { H.toast?.(T('hw_select_end_date'), 'error'); return; }
    const times = (hw.timeOfDay || '').split(',').filter(Boolean);
    if (!times.length) { H.toast?.('Pick at least one time of day.', 'error'); return; }

    state.saving = true;
    _updateSaveBtn();
    saveBtn.textContent = T('btn_loading');
    if (quietBtn) quietBtn.textContent = T('btn_loading');

    // C7: filter empty exercises with feedback
    const allEx = state.exercises;
    const cleanExercises = allEx.filter(ex => (ex.title || '').trim()).map(({ _ui, ...rest }) => rest);
    const dropped = allEx.length - cleanExercises.length;
    if (dropped > 0) H.toast?.('Removed ' + dropped + ' empty exercise' + (dropped !== 1 ? 's' : '') + '.');

    try {
      if (isEdit) {
        await updateHomework({ homeworkId, homework: hw, exercises: cleanExercises });
        const all = H.DB?.homeworkTasks || [];
        const idx = all.findIndex(t => t.id === homeworkId);
        if (idx > -1) {
          all[idx] = { ...all[idx], title: hw.title, description: hw.description, recurrence: hw.recurrence, specificDays: hw.specificDays || [], durationType: hw.durationType, endDate: hw.endDate, timeOfDay: hw.timeOfDay, isPinned: hw.isPinned, attachedFileUrls: hw.attachedFileUrls, attachedFileNames: hw.attachedFileNames };
          H.DB.homeworkTasks = all;
        }
        overlay.remove(); H.re?.(); H.toast?.(T('hw_task_updated'));
      } else {
        const result = await createHomework({ homework: hw, exercises: cleanExercises });
        // TODO(Phase 6e): Remove this call once v1 reads are gone. See PHASE_6_7_DEFERRED.md.
        if (typeof H._generateOccurrences === 'function') {
          try { await H._generateOccurrences(result.homeworkRow); } catch (e) { console.error('generate occurrences:', e); }
        }
        // C4: use real created_at from DB response
        const all = H.DB?.homeworkTasks || [];
        if (result.homeworkRow) all.unshift({ id: result.homeworkRow.id, childId: result.homeworkRow.child_id, householdId: result.homeworkRow.household_id, specialistId: result.homeworkRow.specialist_id, specialistName: result.homeworkRow.specialist_name, title: hw.title, description: hw.description || '', recurrence: hw.recurrence, specificDays: hw.specificDays || [], durationType: hw.durationType, endDate: hw.endDate, timeOfDay: hw.timeOfDay, isPinned: hw.isPinned, isPaused: false, status: 'active', attachedFileUrls: hw.attachedFileUrls, attachedFileNames: hw.attachedFileNames, createdAt: result.homeworkRow.created_at });
        H.DB.homeworkTasks = all;
        // Save as template (if checked)
        if (_saveAsTemplate) {
          try {
            await saveHomeworkTemplate({ title: _tmplNameInp?.value?.trim() || hw.title, description: hw.description, recurrence: hw.recurrence, specificDays: hw.specificDays, durationType: hw.durationType, timeOfDay: hw.timeOfDay, exercisesJson: cleanExercises });
          } catch (e) { console.error('save template:', e); }
        }
        // Notify parent (skip if quiet save)
        if (notify) {
          try {
            const childObj = H.DB?.children?.find(c => c.id === childId);
            await H.notifyOtherParty?.('homework', T('notif_new_task', { child: childObj?.name || '', title: hw.title.slice(0, 42) }), childId, 'homework', null, null, T('notif_homework_count', { n: '{n}', name: childObj?.name || '' }));
          } catch (e) { console.error('notify:', e); }
        }
        overlay.remove(); H.re?.(); H.toast?.(notify ? T('hw_task_assigned') : T('hw2_saved_quiet'));
      }
    } catch (e) {
      console.error('save homework:', e);
      H.toast?.(T('hw_could_not_save_task'), 'error');
      state.saving = false;
      saveBtn.textContent = isEdit ? T('hw2_save_changes') : T('hw2_save_send');
      if (quietBtn) quietBtn.textContent = T('hw2_save_quiet');
      _updateSaveBtn();
    }
  }

  saveBtn.onclick = () => _doSave(true);
  if (quietBtn) quietBtn.onclick = () => _doSave(false);

  // ── Edit mode: load existing data ──
  if (isEdit) {
    // F1: block interaction during load
    body.style.opacity = '0.5';
    body.style.pointerEvents = 'none';
    saveBtn.disabled = true;
    loadHomeworkWithExercises(homeworkId).then(result => {
      body.style.opacity = '1';
      body.style.pointerEvents = '';
      if (!result) { H.toast?.('Could not load homework.', 'error'); overlay.remove(); return; }
      const hw = result.homework;
      state.homework.title = hw.title || '';
      state.homework.description = hw.description || '';
      state.homework.recurrence = hw.recurrence || 'daily';
      state.homework.specificDays = hw.specific_days || [];
      state.homework.timeOfDay = hw.time_of_day || 'morning';
      state.homework.durationType = hw.duration_type || 'open_ended';
      state.homework.endDate = hw.end_date || null;
      state.homework.isPinned = hw.is_pinned || false;
      state.homework.attachedFileUrls = hw.attached_file_urls || [];
      state.homework.attachedFileNames = hw.attached_file_names || [];

      titleInp.value = state.homework.title;
      notesInp.value = state.homework.description;

      state.exercises = (result.exercises || []).map(ex => ({
        id: ex.id,
        title: ex.title || '',
        instructions: ex.instructions || '',
        reps: ex.reps,
        sets: ex.sets,
        durationSeconds: ex.duration_seconds,
        measureUnit: ex.measure_unit,
        overrideRecurrence: ex.override_recurrence,
        overrideSpecificDays: ex.override_specific_days,
        overrideTimeOfDay: ex.override_time_of_day,
        attachedFileUrls: ex.attached_file_urls || [],
        attachedFileNames: ex.attached_file_names || [],
        _ui: { expanded: false },
      }));
      if (!state.exercises.length) state.exercises.push({ title: '', instructions: '', reps: null, sets: null, durationSeconds: null, measureUnit: null, overrideRecurrence: null, overrideSpecificDays: null, overrideTimeOfDay: null, attachedFileUrls: [], attachedFileNames: [], _ui: { expanded: false } });

      _renderFiles();
      _renderEx();
      _renderSch();
      _updateSaveBtn();
      // F2: mark clean after populating from DB
      state.dirty = false;
    });
  } else {
    _renderEx();
    _renderSch();
    _updateSaveBtn();
  }
}
