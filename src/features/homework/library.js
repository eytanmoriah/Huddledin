// Specialist Template Library page — Template Library Sub-commit 3 of 5
// Two top-level tabs: My Exercises + My Homeworks. Card list per tab with
// edit/delete affordances. Dedicated edit modal for exercise templates.
// Minimal rename/description edit modal for homework templates (snapshot
// semantics — exercise list is frozen at save-time per yesterday's
// investigation locked decision).

import { injectHomeworkStyles } from './styles.js';
import {
  loadExerciseTemplates, saveExerciseTemplate, updateExerciseTemplate, deleteExerciseTemplate,
  loadHomeworkTemplates, loadHomeworkTemplate, updateHomeworkTemplate, deleteHomeworkTemplate,
} from './templates.js';

const T = (k, p) => window.HUD?.T?.(k, p) || k;

export function renderTemplatesPage({ isWeb }) {
  injectHomeworkStyles();
  const H = window.HUD || {};
  const { el, mkBtn, S, re } = H;

  if (!S._templatesView) S._templatesView = 'exercises';

  const sec = el('div', { class: 'section' });

  // Header
  const hd = el('div', { class: 'sec-hd' });
  hd.appendChild(el('div', { class: 'sec-hd-left' }, [
    el('h2', { class: 'page-title' }, [T('nav_templates') || 'Templates']),
    el('p', { class: 'page-sub' }, [T('templates_subtitle') || 'Reusable exercises and homeworks for your patients']),
  ]));
  const newBtn = mkBtn('+ ' + (T('btn_new') || 'New'), 'btn-md btn-primary', () => {
    if (S._templatesView === 'exercises') _openExerciseTemplateEditModal(null, H, () => _refresh(host, H));
    else _openHomeworkTemplateEditModal(null, H, () => _refresh(host, H));
  });
  const right = el('div', { class: 'sec-hd-right' });
  right.appendChild(newBtn);
  hd.appendChild(right);
  sec.appendChild(hd);

  // Loading host
  const host = el('div');
  host.appendChild(el('div', { style: { textAlign: 'center', padding: '24px', color: '#64748b' } }, [T('btn_loading') || 'Loading...']));
  sec.appendChild(host);

  _refresh(host, H);
  return sec;
}

async function _refresh(host, H) {
  const { el, S } = H;

  const [exTemplates, hwTemplates] = await Promise.all([
    loadExerciseTemplates(),
    loadHomeworkTemplates(),
  ]);

  host.innerHTML = '';

  // Tab bar
  host.appendChild(_renderTabBar(S._templatesView, exTemplates.length, hwTemplates.length, H, () => _refresh(host, H)));

  if (S._templatesView === 'exercises') {
    host.appendChild(_renderExerciseTemplatesList(exTemplates, H, () => _refresh(host, H)));
  } else {
    host.appendChild(_renderHomeworkTemplatesList(hwTemplates, H, () => _refresh(host, H)));
  }
}

function _renderTabBar(view, exCount, hwCount, H, onSwitch) {
  const { el, S } = H;
  const bar = el('div', { style: { display: 'flex', gap: '8px', marginBottom: '18px' } });
  const tabs = [
    ['exercises', T('templates_my_exercises') || 'My Exercises', exCount],
    ['homeworks', T('templates_my_homeworks') || 'My Homeworks', hwCount],
  ];
  tabs.forEach(([key, label, count]) => {
    const active = view === key;
    const btn = el('button', { class: active ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost' }, [label]);
    btn.appendChild(el('span', { class: 'patient-count-badge' }, [String(count)]));
    btn.onclick = () => { S._templatesView = key; onSwitch(); };
    bar.appendChild(btn);
  });
  return bar;
}

// ── Exercise templates list ──

function _renderExerciseTemplatesList(templates, H, onChanged) {
  const { el } = H;
  const wrap = el('div');

  if (!templates.length) {
    wrap.appendChild(el('div', { class: 'empty-state' }, [
      el('span', { class: 'empty-state-icon' }, ['📚']),
      el('div', { class: 'empty-state-title' }, [T('templates_no_exercises_title') || 'No exercise templates yet']),
      el('div', { class: 'empty-state-body' }, [T('templates_no_exercises_body') || 'Create your first by tapping + New, or by saving an exercise from a homework’s create form.']),
    ]));
    return wrap;
  }

  templates.forEach(tmpl => {
    wrap.appendChild(_renderExerciseCard(tmpl, H, onChanged));
  });
  return wrap;
}

function _renderExerciseCard(tmpl, H, onChanged) {
  const { el } = H;
  const card = el('div', { style: {
    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '12px',
    padding: '12px 14px', marginBottom: '10px',
    display: 'flex', alignItems: 'center', gap: '10px',
    cursor: 'pointer', transition: 'box-shadow .12s, border-color .12s',
  } });
  card.onmouseenter = () => { card.style.borderColor = '#0d9488'; };
  card.onmouseleave = () => { card.style.borderColor = '#e2e8f0'; };

  const info = el('div', { style: { flex: '1', minWidth: '0' } });
  info.appendChild(el('div', { style: { fontWeight: 600, fontSize: '14px', color: '#0f1a18' } }, [tmpl.name || '(unnamed)']));
  const measure = _exerciseMeasure(tmpl);
  if (measure) info.appendChild(el('div', { style: { fontSize: '11px', color: '#94a3b8', marginTop: '2px' } }, [measure]));
  card.appendChild(info);

  const actions = el('div', { style: { display: 'flex', gap: '4px', flexShrink: '0' } });
  actions.onclick = (e) => e.stopPropagation();

  actions.appendChild(_iconBtn('✎', T('btn_edit') || 'Edit', () => _openExerciseTemplateEditModal(tmpl, H, onChanged)));
  actions.appendChild(_iconBtn('⋮', T('more_actions') || 'More', (btn) => {
    _showRowKebab(btn, [
      { icon: '🗑', label: T('btn_delete') || 'Delete', onClick: () => _confirmDeleteExercise(tmpl, H, onChanged) },
    ], H);
  }));
  card.appendChild(actions);

  card.onclick = () => _openExerciseTemplateEditModal(tmpl, H, onChanged);
  return card;
}

function _exerciseMeasure(tmpl) {
  if (tmpl.sets && tmpl.reps) return tmpl.sets + '×' + tmpl.reps + ' reps';
  if (tmpl.duration_seconds) {
    const mins = Math.round(tmpl.duration_seconds / 60);
    if (mins >= 1) return mins + ' min';
    return tmpl.duration_seconds + ' sec';
  }
  if (tmpl.measure_unit) return tmpl.measure_unit;
  return '';
}

// ── Homework templates list ──

function _renderHomeworkTemplatesList(templates, H, onChanged) {
  const { el } = H;
  const wrap = el('div');

  if (!templates.length) {
    wrap.appendChild(el('div', { class: 'empty-state' }, [
      el('span', { class: 'empty-state-icon' }, ['📋']),
      el('div', { class: 'empty-state-title' }, [T('templates_no_homeworks_title') || 'No homework templates yet']),
      el('div', { class: 'empty-state-body' }, [T('templates_no_homeworks_body') || 'Save an existing homework from the create form to start your library.']),
    ]));
    return wrap;
  }

  templates.forEach(tmpl => {
    wrap.appendChild(_renderHomeworkCard(tmpl, H, onChanged));
  });
  return wrap;
}

function _renderHomeworkCard(tmpl, H, onChanged) {
  const { el } = H;
  const card = el('div', { style: {
    background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '12px',
    padding: '12px 14px', marginBottom: '10px',
    display: 'flex', alignItems: 'center', gap: '10px',
    cursor: 'pointer', transition: 'border-color .12s',
  } });
  card.onmouseenter = () => { card.style.borderColor = '#0d9488'; };
  card.onmouseleave = () => { card.style.borderColor = '#e2e8f0'; };

  const info = el('div', { style: { flex: '1', minWidth: '0' } });
  info.appendChild(el('div', { style: { fontWeight: 600, fontSize: '14px', color: '#0f1a18' } }, [tmpl.title || '(unnamed)']));
  const exCount = (tmpl.exercises_json || []).length;
  const subtitle = exCount + ' ' + (exCount === 1 ? 'exercise' : 'exercises');
  info.appendChild(el('div', { style: { fontSize: '11px', color: '#94a3b8', marginTop: '2px' } }, [subtitle]));
  card.appendChild(info);

  const actions = el('div', { style: { display: 'flex', gap: '4px', flexShrink: '0' } });
  actions.onclick = (e) => e.stopPropagation();

  actions.appendChild(_iconBtn('✎', T('btn_edit') || 'Edit', () => _openHomeworkTemplateEditModal(tmpl, H, onChanged)));
  actions.appendChild(_iconBtn('⋮', T('more_actions') || 'More', (btn) => {
    _showRowKebab(btn, [
      { icon: '🗑', label: T('btn_delete') || 'Delete', onClick: () => _confirmDeleteHomework(tmpl, H, onChanged) },
    ], H);
  }));
  card.appendChild(actions);

  card.onclick = () => _openHomeworkTemplateEditModal(tmpl, H, onChanged);
  return card;
}

// ── Shared row helpers ──

function _iconBtn(icon, title, onclick) {
  const b = document.createElement('button');
  b.textContent = icon;
  b.title = title;
  b.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;padding:4px;border-radius:6px;min-width:32px;min-height:32px;display:flex;align-items:center;justify-content:center;transition:background .12s;';
  b.onmouseenter = () => { b.style.background = '#f1f5f9'; };
  b.onmouseleave = () => { b.style.background = 'none'; };
  b.onclick = (e) => { e.stopPropagation(); onclick(b); };
  return b;
}

function _showRowKebab(anchor, items, H) {
  const { el } = H;
  document.querySelectorAll('.hw-lib-kebab').forEach(m => m.remove());
  const menu = el('div', { class: 'long-press-menu hw-lib-kebab' });
  items.forEach(it => {
    const row = el('div', { class: 'long-press-item' });
    row.appendChild(el('span', { style: { fontSize: '1rem' } }, [it.icon || '']));
    row.appendChild(el('span', { style: { flex: '1' } }, [it.label]));
    row.onclick = (e) => {
      e.stopPropagation(); menu.remove();
      try { it.onClick && it.onClick(); } catch (err) { console.error('❌ kebab action:', err); }
    };
    menu.appendChild(row);
  });
  document.body.appendChild(menu);
  const rect = anchor.getBoundingClientRect();
  const mw = 200, mh = items.length * 48 + 12;
  let x = Math.min(rect.right - mw, window.innerWidth - mw - 12);
  x = Math.max(12, x);
  let y = rect.bottom + 8;
  if (y + mh > window.innerHeight - 12) y = rect.top - mh - 8;
  y = Math.max(12, y);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  setTimeout(() => {
    const close = () => {
      menu.remove();
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
    const onPointer = (ev) => { if (!menu.contains(ev.target)) close(); };
    const onKey = (ev) => { if (ev.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
  }, 50);
}

// ── Exercise template edit modal (dedicated, per locked decision F2) ──

function _openExerciseTemplateEditModal(tmpl, H, onSaved) {
  const { el, openModal, toast } = H;
  const isEdit = !!tmpl;
  const title = isEdit ? (T('templates_edit_exercise') || 'Edit Exercise Template') : (T('templates_new_exercise') || 'New Exercise Template');

  // Local form state — clone from template or blank
  const state = {
    name: tmpl?.name || '',
    instructions: tmpl?.instructions || '',
    reps: tmpl?.reps ?? null,
    sets: tmpl?.sets ?? null,
    durationSeconds: tmpl?.duration_seconds ?? null,
    measureUnit: tmpl?.measure_unit || '',
  };

  openModal(title, (mb, close) => {
    // NAME
    mb.appendChild(el('div', { class: 'hw2-section-label', style: { marginTop: '0' } }, [T('templates_field_name') || 'Name']));
    const nameInp = el('input', { type: 'text', class: 'hw2-input', placeholder: T('templates_name_placeholder') || 'e.g. /R/ practice', maxlength: '200' });
    nameInp.value = state.name;
    nameInp.oninput = () => { state.name = nameInp.value; _updateSaveBtn(); };
    mb.appendChild(nameInp);

    // INSTRUCTIONS
    mb.appendChild(el('div', { class: 'hw2-section-label' }, [T('templates_field_instructions') || 'Instructions']));
    const insInp = el('textarea', { class: 'hw2-input hw2-textarea', placeholder: T('templates_instructions_placeholder') || 'Optional instructions for the parent', rows: '3' });
    insInp.value = state.instructions;
    insInp.oninput = () => { state.instructions = insInp.value; };
    mb.appendChild(insInp);

    // MEASURE — reps/sets + duration + unit (all optional)
    mb.appendChild(el('div', { class: 'hw2-section-label' }, [T('templates_field_measure') || 'Measure']));
    const measureRow = el('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' } });

    const repsBox = el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } });
    repsBox.appendChild(el('span', { style: { fontSize: '12px', color: '#64748b', fontWeight: 600 } }, ['Reps']));
    const repsInp = el('input', { type: 'number', class: 'hw2-input', style: { width: '60px', textAlign: 'center', padding: '6px 4px' }, placeholder: '#' });
    repsInp.value = state.reps ?? '';
    repsInp.oninput = () => { state.reps = parseInt(repsInp.value) || null; };
    repsBox.appendChild(repsInp);
    measureRow.appendChild(repsBox);

    const setsBox = el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } });
    setsBox.appendChild(el('span', { style: { fontSize: '12px', color: '#64748b', fontWeight: 600 } }, ['Sets']));
    const setsInp = el('input', { type: 'number', class: 'hw2-input', style: { width: '60px', textAlign: 'center', padding: '6px 4px' }, placeholder: '#' });
    setsInp.value = state.sets ?? '';
    setsInp.oninput = () => { state.sets = parseInt(setsInp.value) || null; };
    setsBox.appendChild(setsInp);
    measureRow.appendChild(setsBox);

    const durBox = el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } });
    durBox.appendChild(el('span', { style: { fontSize: '12px', color: '#64748b', fontWeight: 600 } }, ['Duration']));
    const durInp = el('input', { type: 'number', class: 'hw2-input', style: { width: '70px', textAlign: 'center', padding: '6px 4px' }, placeholder: 'min' });
    durInp.value = state.durationSeconds ? Math.round(state.durationSeconds / 60) : '';
    durInp.oninput = () => {
      const v = parseInt(durInp.value);
      state.durationSeconds = (v > 0) ? v * 60 : null;
    };
    durBox.appendChild(durInp);
    durBox.appendChild(el('span', { style: { fontSize: '11px', color: '#94a3b8' } }, ['min']));
    measureRow.appendChild(durBox);

    mb.appendChild(measureRow);

    // UNIT (optional free text)
    const unitWrap = el('div', { style: { marginBottom: '12px' } });
    unitWrap.appendChild(el('span', { style: { fontSize: '12px', color: '#64748b', fontWeight: 600, marginRight: '8px' } }, [T('templates_field_unit') || 'Custom unit']));
    const unitInp = el('input', { type: 'text', class: 'hw2-input', style: { width: '160px', display: 'inline-block' }, placeholder: T('templates_unit_placeholder') || 'e.g. words, breaths' });
    unitInp.value = state.measureUnit;
    unitInp.oninput = () => { state.measureUnit = unitInp.value; };
    unitWrap.appendChild(unitInp);
    mb.appendChild(unitWrap);

    // Helper text
    mb.appendChild(el('div', { style: { fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginBottom: '14px' } }, [
      T('templates_measure_hint') || 'All measure fields are optional. Use whichever combination fits this exercise.',
    ]));

    // Action row
    const actRow = el('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' } });

    if (isEdit) {
      const delBtn = el('button', { class: 'btn btn-sm btn-ghost', style: { color: '#ef4444', marginRight: 'auto' } }, [T('btn_delete') || 'Delete']);
      delBtn.onclick = () => _confirmDeleteExercise(tmpl, H, () => { close(); onSaved && onSaved(); });
      actRow.appendChild(delBtn);
    }

    const cancelBtn = el('button', { class: 'btn btn-sm btn-ghost' }, [T('btn_cancel') || 'Cancel']);
    cancelBtn.onclick = close;
    actRow.appendChild(cancelBtn);

    const saveBtn = el('button', { class: 'btn btn-sm btn-primary' }, [T('btn_save') || 'Save']);
    saveBtn.onclick = async () => {
      if (!state.name.trim()) { toast?.(T('templates_name_required') || 'Name is required.', 'error'); return; }
      saveBtn.disabled = true; saveBtn.textContent = T('btn_loading') || 'Saving...';
      try {
        if (isEdit) {
          await updateExerciseTemplate(tmpl.id, state);
          toast?.(T('templates_saved') || 'Template saved.');
        } else {
          await saveExerciseTemplate(state);
          toast?.(T('templates_created') || 'Template created.');
        }
        close();
        onSaved && onSaved();
      } catch (e) {
        console.error('❌ save exercise template:', e);
        toast?.(T('templates_save_failed') || 'Could not save template.', 'error');
        saveBtn.disabled = false; saveBtn.textContent = T('btn_save') || 'Save';
      }
    };
    actRow.appendChild(saveBtn);
    mb.appendChild(actRow);

    function _updateSaveBtn() {
      const ok = state.name.trim().length > 0;
      saveBtn.disabled = !ok;
      saveBtn.style.opacity = ok ? '1' : '0.5';
    }
    _updateSaveBtn();
  }, 460);
}

// ── Homework template edit modal (minimal — rename/description/delete) ──

function _openHomeworkTemplateEditModal(tmpl, H, onSaved) {
  const { el, openModal, toast } = H;
  const isEdit = !!tmpl;
  const title = isEdit ? (T('templates_edit_homework') || 'Edit Homework Template') : (T('templates_new_homework') || 'New Homework Template');

  // For "+ New" homework template: not directly supported via this minimal modal.
  // Per locked decision: homework templates are saved via the existing
  // save-as-template checkbox in the homework create flow. Direct creation
  // from the library would need full exercise-list editing, deferred.
  if (!isEdit) {
    H.toast?.(T('templates_create_hw_hint') || 'To create a homework template, save one from the homework create form (Save as template).', 'info', 5000);
    return;
  }

  const state = {
    title: tmpl.title || '',
    description: tmpl.description || '',
  };

  openModal(title, (mb, close) => {
    // TITLE
    mb.appendChild(el('div', { class: 'hw2-section-label', style: { marginTop: '0' } }, [T('templates_field_name') || 'Name']));
    const titleInp = el('input', { type: 'text', class: 'hw2-input', maxlength: '200' });
    titleInp.value = state.title;
    titleInp.oninput = () => { state.title = titleInp.value; _updateSaveBtn(); };
    mb.appendChild(titleInp);

    // DESCRIPTION
    mb.appendChild(el('div', { class: 'hw2-section-label' }, [T('templates_field_description') || 'Description']));
    const descInp = el('textarea', { class: 'hw2-input hw2-textarea', rows: '3', placeholder: T('templates_description_placeholder') || 'Optional notes for the parent' });
    descInp.value = state.description;
    descInp.oninput = () => { state.description = descInp.value; };
    mb.appendChild(descInp);

    // Exercises summary (read-only — exercise list is frozen in v1)
    const exCount = (tmpl.exercises_json || []).length;
    if (exCount) {
      mb.appendChild(el('div', { class: 'hw2-section-label' }, [T('templates_field_exercises') || 'Exercises']));
      const exList = el('div', { style: { background: '#f0fdf9', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' } });
      (tmpl.exercises_json || []).forEach(ex => {
        const row = el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155', padding: '2px 0' } });
        row.appendChild(el('span', { style: { color: '#0d9488', fontSize: '8px', flexShrink: '0' } }, ['●']));
        row.appendChild(el('span', { style: { flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, [ex.title || '(unnamed)']));
        exList.appendChild(row);
      });
      mb.appendChild(exList);
      mb.appendChild(el('div', { style: { fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginBottom: '14px' } }, [
        T('templates_hw_frozen_hint') || 'The exercise list is frozen at save-time. To change exercises, save a new homework as a template.',
      ]));
    }

    // Action row
    const actRow = el('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' } });

    const delBtn = el('button', { class: 'btn btn-sm btn-ghost', style: { color: '#ef4444', marginRight: 'auto' } }, [T('btn_delete') || 'Delete']);
    delBtn.onclick = () => _confirmDeleteHomework(tmpl, H, () => { close(); onSaved && onSaved(); });
    actRow.appendChild(delBtn);

    const cancelBtn = el('button', { class: 'btn btn-sm btn-ghost' }, [T('btn_cancel') || 'Cancel']);
    cancelBtn.onclick = close;
    actRow.appendChild(cancelBtn);

    const saveBtn = el('button', { class: 'btn btn-sm btn-primary' }, [T('btn_save') || 'Save']);
    saveBtn.onclick = async () => {
      if (!state.title.trim()) { toast?.(T('templates_name_required') || 'Name is required.', 'error'); return; }
      saveBtn.disabled = true; saveBtn.textContent = T('btn_loading') || 'Saving...';
      try {
        await updateHomeworkTemplate(tmpl.id, state);
        toast?.(T('templates_saved') || 'Template saved.');
        close();
        onSaved && onSaved();
      } catch (e) {
        console.error('❌ save homework template:', e);
        toast?.(T('templates_save_failed') || 'Could not save template.', 'error');
        saveBtn.disabled = false; saveBtn.textContent = T('btn_save') || 'Save';
      }
    };
    actRow.appendChild(saveBtn);
    mb.appendChild(actRow);

    function _updateSaveBtn() {
      const ok = state.title.trim().length > 0;
      saveBtn.disabled = !ok;
      saveBtn.style.opacity = ok ? '1' : '0.5';
    }
    _updateSaveBtn();
  }, 460);
}

// ── Delete confirmations ──

function _confirmDeleteExercise(tmpl, H, onDone) {
  const { openConfirm, toast } = H;
  openConfirm(
    T('templates_delete_title') || 'Delete this template?',
    (T('templates_delete_body') || 'This template will be removed from your library. This cannot be undone.'),
    true,
    async () => {
      try {
        await deleteExerciseTemplate(tmpl.id);
        toast?.(T('templates_deleted') || 'Template deleted.');
        onDone && onDone();
      } catch (e) {
        console.error('❌ delete exercise template:', e);
        toast?.(T('templates_delete_failed') || 'Could not delete template.', 'error');
      }
    },
  );
}

function _confirmDeleteHomework(tmpl, H, onDone) {
  const { openConfirm, toast } = H;
  openConfirm(
    T('templates_delete_title') || 'Delete this template?',
    (T('templates_delete_body') || 'This template will be removed from your library. This cannot be undone.'),
    true,
    async () => {
      try {
        await deleteHomeworkTemplate(tmpl.id);
        toast?.(T('templates_deleted') || 'Template deleted.');
        onDone && onDone();
      } catch (e) {
        console.error('❌ delete homework template:', e);
        toast?.(T('templates_delete_failed') || 'Could not delete template.', 'error');
      }
    },
  );
}
