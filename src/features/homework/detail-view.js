// Specialist homework detail view — Phase 3b
// Routed via S._hwTaskView. Back arrow returns to list.

import { loadHomeworkDetail, loadCompletionsV2, postComment } from './data.js';
import { scheduleSummary } from './schedule.js';
import { injectHomeworkStyles } from './styles.js';

const T = (k, p) => window.HUD?.T?.(k, p) || k;
const _pad = n => String(n).padStart(2, '0');
const _fmtLocal = d => d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate());

export function renderHomeworkDetail({ homeworkId, isWeb }) {
  injectHomeworkStyles();
  const H = window.HUD || {};
  const { el, mkBtn, toast, openConfirm, _supa, re, DB, S, session } = H;

  const sec = el('div', { class: 'section' });

  // Back bar
  const backRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1.5px solid #e2e8f0' } });
  const backBtn = el('button', { style: { background: 'none', border: 'none', cursor: 'pointer', color: '#0d9488', fontWeight: 700, fontSize: '.84rem', fontFamily: 'inherit', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' } }, ['\u2190 Back']);
  backBtn.onclick = () => { S._hwTaskView = null; re(); };
  backRow.appendChild(backBtn);
  sec.appendChild(backRow);

  // Loading
  const host = el('div');
  host.appendChild(el('div', { style: { textAlign: 'center', padding: '24px', color: '#64748b' } }, [T('btn_loading')]));
  sec.appendChild(host);

  _loadAndRender(host, homeworkId, isWeb, H);
  return sec;
}

async function _loadAndRender(host, homeworkId, isWeb, H) {
  const { el, mkBtn, toast, openConfirm, _supa, re, DB, S, session } = H;
  const result = await loadHomeworkDetail(homeworkId);
  host.innerHTML = '';

  if (!result) {
    host.appendChild(el('div', { style: { textAlign: 'center', padding: '24px', color: '#ef4444' } }, ['Could not load homework.']));
    return;
  }

  const { homework: hw, exercises, occurrences, completions, comments } = result;
  const child = DB?.children?.find(c => c.id === hw.child_id);

  // Load v2 completions and merge into activity
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const v2Completions = await loadCompletionsV2(hw.child_id, fourteenDaysAgo);
  const v2ForThis = v2Completions.filter(c => c.homework_id === homeworkId);

  // ── Header card ──
  const header = el('div', { style: { background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '16px' } });

  const metaRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' } });
  if (hw.is_pinned) metaRow.appendChild(el('span', { style: { fontSize: '10px', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '1px 8px', borderRadius: '99px' } }, ['\ud83d\udccc Pinned']));
  if (hw.is_paused) metaRow.appendChild(el('span', { style: { fontSize: '10px', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '1px 8px', borderRadius: '99px' } }, ['Paused']));
  const sched = scheduleSummary({ recurrence: hw.recurrence, specificDays: hw.specific_days || [], timeOfDay: hw.time_of_day || 'morning', durationType: hw.duration_type, endDate: hw.end_date });
  metaRow.appendChild(el('span', { style: { fontSize: '11px', color: '#64748b', fontWeight: 500 } }, [sched]));
  header.appendChild(metaRow);

  header.appendChild(el('div', { style: { fontWeight: 700, fontSize: '18px', color: '#0f1a18', marginBottom: '4px' } }, [hw.title]));
  const startDate = hw.created_at ? new Date(hw.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
  header.appendChild(el('div', { style: { fontSize: '12px', color: '#94a3b8', marginBottom: '12px' } }, ['Started ' + startDate + ' \u00b7 ' + exercises.length + ' exercise' + (exercises.length !== 1 ? 's' : '')]));

  // Description
  if (hw.description) {
    header.appendChild(el('div', { style: { fontSize: '13px', color: '#475569', lineHeight: '1.5', padding: '10px 12px', background: '#f0fdf9', borderRadius: '8px', marginBottom: '12px' } }, [hw.description]));
  }

  // Action buttons
  const actRow = el('div', { style: { display: 'flex', gap: '8px' } });
  actRow.appendChild(mkBtn('\u270f\ufe0f ' + T('hw3_edit'), 'btn-sm btn-ghost', () => window.HUD_HOMEWORK.mountHomeworkCreateModal({ childId: hw.child_id, homeworkId: hw.id })));
  actRow.appendChild(mkBtn(hw.is_paused ? '\u25b6 ' + T('hw3_resume') : '\u23f8 ' + T('hw3_pause'), 'btn-sm btn-ghost', async () => {
    const { error } = await _supa.from('homework_tasks').update({ is_paused: !hw.is_paused }).eq('id', hw.id);
    if (error) { toast('Could not update.', 'error'); return; }
    re();
  }));
  actRow.appendChild(mkBtn('\ud83d\uddc4 ' + T('hw3_archive_btn'), 'btn-sm btn-ghost', () => {
    openConfirm(T('hw3_archive_title'), T('hw3_archive_body'), false, async () => {
      const { error } = await _supa.from('homework_tasks').update({ status: 'archived' }).eq('id', hw.id);
      if (error) { toast('Could not archive.', 'error'); return; }
      S._hwTaskView = null; re();
    });
  }));
  header.appendChild(actRow);
  host.appendChild(header);

  // ── Week strip ──
  const weekStrip = _renderWeekStrip(occurrences, completions, el);
  host.appendChild(weekStrip);

  // ── Exercises section ──
  host.appendChild(el('div', { class: 'hw2-section-label', style: { marginTop: '16px' } }, [T('hw2_exercises_label') + ' \u00b7 ' + exercises.length]));
  exercises.forEach(ex => {
    const exCard = el('div', { style: { background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', marginBottom: '8px' } });
    const topRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } });
    topRow.appendChild(el('span', { style: { color: '#0d9488', fontSize: '8px' } }, ['\u25cf']));
    topRow.appendChild(el('span', { style: { flex: '1', fontWeight: 600, fontSize: '14px', color: '#0f1a18' } }, [ex.title]));
    const measure = (ex.sets && ex.reps) ? ex.sets + '\u00d7' + ex.reps : ex.duration_seconds ? Math.round(ex.duration_seconds / 60) + ' min' : '';
    if (measure) topRow.appendChild(el('span', { style: { fontSize: '12px', color: '#94a3b8' } }, [measure]));
    if (ex.override_recurrence || ex.override_time_of_day) topRow.appendChild(el('span', { style: { fontSize: '10px', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '1px 6px', borderRadius: '99px' } }, ['Custom']));
    exCard.appendChild(topRow);
    if (ex.instructions) exCard.appendChild(el('div', { style: { fontSize: '12px', color: '#64748b', marginTop: '6px', lineHeight: '1.4' } }, [ex.instructions]));
    host.appendChild(exCard);
  });

  // ── Per-exercise progress (v2) ──
  if (v2ForThis.length) {
    host.appendChild(el('div', { class: 'hw2-section-label', style: { marginTop: '20px' } }, [T('hw4_exercise_progress')]));
    exercises.forEach(ex => {
      const exComps = v2ForThis.filter(c => c.exercise_id === ex.id);
      const done = exComps.filter(c => c.status === 'done').length;
      const total = exComps.length;
      if (!total) return;
      const row = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '13px' } });
      row.appendChild(el('span', { style: { flex: '1', color: '#334155', fontWeight: 500 } }, [ex.title]));
      row.appendChild(el('span', { style: { color: done === total ? '#059669' : '#64748b', fontWeight: 600 } }, [done + '/' + total + ' done']));
      host.appendChild(row);
    });
  }

  // ── Activity section (merged v1 + v2) ──
  host.appendChild(el('div', { class: 'hw2-section-label', style: { marginTop: '20px' } }, [T('hw3_activity')]));

  // Build unified activity list from v2 (preferred) + v1 fallback
  const exMap = {};
  exercises.forEach(ex => { exMap[ex.id] = ex; });
  const activityItems = v2ForThis.map(c => ({
    type: 'v2',
    date: new Date(c.logged_at),
    status: c.status,
    exercise: exMap[c.exercise_id],
    note: c.note,
    photoUrl: c.photo_url,
    slot: c.slot,
    id: c.id,
  }));

  // Add v1 completions that don't overlap with v2
  const v2Dates = new Set(v2ForThis.map(c => c.scheduled_date));
  completions.forEach(comp => {
    const compDate = comp.completed_at ? comp.completed_at.split('T')[0] : '';
    if (!v2Dates.has(compDate)) {
      activityItems.push({
        type: 'v1',
        date: new Date(comp.completed_at),
        status: 'done',
        exercise: null,
        note: comp.note,
        photoUrl: comp.photo_url,
        slot: comp.time_of_day,
        id: comp.id,
      });
    }
  });

  activityItems.sort((a, b) => b.date - a.date);

  if (!activityItems.length) {
    host.appendChild(el('div', { style: { textAlign: 'center', padding: '16px', color: '#94a3b8', fontSize: '13px' } }, [T('hw3_no_activity')]));
    return;
  }

  activityItems.slice(0, 15).forEach(item => {
    const borderColor = item.status === 'cant_do' ? '#fde68a' : item.status === 'skipped' ? '#e2e8f0' : '#e2e8f0';
    const compCard = el('div', { style: { background: '#fff', border: '1.5px solid ' + borderColor, borderRadius: '10px', padding: '12px 14px', marginBottom: '10px' } });

    const relTime = _relTime(item.date);
    const dayName = item.date.toLocaleDateString([], { weekday: 'short' });
    const slotLabel = item.slot ? ' \u00b7 ' + item.slot : '';
    const exLabel = item.exercise ? ' \u00b7 ' + item.exercise.title : '';
    const statusLabels = { done: '\u2713 Done', skipped: '\u2192 Skipped', cant_do: '\u26a0 Couldn\u2019t do' };
    const statusColors = { done: '#059669', skipped: '#64748b', cant_do: '#d97706' };
    compCard.appendChild(el('div', { style: { fontWeight: 600, fontSize: '13px', color: statusColors[item.status] || '#0f1a18', marginBottom: '4px' } }, [(statusLabels[item.status] || '\u2713 Done') + exLabel + slotLabel + ' \u00b7 ' + dayName + ' \u00b7 ' + relTime]));

    if (item.note) compCard.appendChild(el('div', { style: { fontSize: '13px', color: '#475569', fontStyle: 'italic', marginBottom: '6px', lineHeight: '1.4' } }, ['\u201c' + item.note + '\u201d']));
    if (item.photoUrl) {
      const img = el('img', { src: item.photoUrl, style: { maxWidth: '100%', maxHeight: '160px', borderRadius: '8px', objectFit: 'cover', display: 'block', marginBottom: '8px', cursor: 'pointer' } });
      img.onclick = () => window.open(item.photoUrl, '_blank');
      compCard.appendChild(img);
    }

    // Comments (v1 only — v2 comments will be added later)
    if (item.type === 'v1') {
      const compComments = comments.filter(c => c.completion_id === item.id);
      compComments.forEach(cm => {
        const cmEl = el('div', { style: { background: '#f0fdf9', borderRadius: '8px', padding: '8px 10px', marginBottom: '5px', fontSize: '12px', lineHeight: '1.4' } });
        cmEl.appendChild(el('div', { style: { fontWeight: 700, color: '#0d9488', fontSize: '11px', marginBottom: '2px' } }, ['\ud83d\udcac ' + new Date(cm.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })]));
        cmEl.appendChild(el('div', { style: { color: '#0f1a18' } }, [cm.comment]));
        compCard.appendChild(cmEl);
      });

      // Add comment inline
      const commentHost = el('div');
      const addBtn = el('button', { style: { background: 'none', border: 'none', cursor: 'pointer', color: '#0d9488', fontSize: '12px', fontWeight: 600, padding: '4px 0', fontFamily: 'inherit' } }, ['\ud83d\udcac ' + T('hw3_add_comment')]);
      addBtn.onclick = () => {
        addBtn.style.display = 'none';
        const inputWrap = el('div', { style: { marginTop: '8px' } });
        const textarea = el('textarea', { class: 'hw2-input hw2-textarea', placeholder: T('hw3_comment_placeholder'), style: { marginBottom: '6px', minHeight: '50px' } });
        inputWrap.appendChild(textarea);
        const btnRow = el('div', { style: { display: 'flex', gap: '6px' } });
        btnRow.appendChild(mkBtn(T('hw3_send'), 'btn-sm btn-primary', async () => {
          if (!textarea.value.trim()) { toast('Write a comment first.', 'error'); return; }
          try {
            await postComment({ completionId: item.id, taskId: hw.id, childId: hw.child_id, householdId: hw.household_id, comment: textarea.value.trim() });
            const newCm = el('div', { style: { background: '#f0fdf9', borderRadius: '8px', padding: '8px 10px', marginBottom: '5px', fontSize: '12px', lineHeight: '1.4' } });
            newCm.appendChild(el('div', { style: { fontWeight: 700, color: '#0d9488', fontSize: '11px', marginBottom: '2px' } }, ['\ud83d\udcac Just now']));
            newCm.appendChild(el('div', { style: { color: '#0f1a18' } }, [textarea.value.trim()]));
            commentHost.insertBefore(newCm, commentHost.firstChild);
            inputWrap.remove();
            addBtn.style.display = '';
            toast(T('hw3_comment_sent'));
            try {
              const childObj = DB?.children?.find(c => c.id === hw.child_id);
              await H.notifyOtherParty?.('homework', T('notif_hw_comment', { specialist: session?.name || 'Specialist', title: hw.title.slice(0, 30), child: childObj?.name || '' }), hw.child_id, 'homework');
            } catch (e) { console.error('notify:', e); }
          } catch (e) { toast('Could not send comment.', 'error'); }
        }));
        btnRow.appendChild(mkBtn(T('hw3_cancel'), 'btn-sm btn-ghost', () => { inputWrap.remove(); addBtn.style.display = ''; }));
        inputWrap.appendChild(btnRow);
        commentHost.appendChild(inputWrap);
      };
      commentHost.appendChild(addBtn);
      compCard.appendChild(commentHost);
    }

    host.appendChild(compCard);
  });
}

function _renderWeekStrip(occurrences, completions, el) {
  const wrap = el('div', { style: { display: 'flex', gap: '4px', marginBottom: '12px', padding: '12px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px' } });

  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const todayStr = _fmtLocal(now);

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const ds = _fmtLocal(d);
    const isToday = ds === todayStr;

    const dayOccs = occurrences.filter(o => o.scheduled_date === ds);
    const scheduled = dayOccs.length;
    const done = dayOccs.filter(o => {
      return completions.some(c => c.occurrence_id === o.id);
    }).length;
    const pct = scheduled > 0 ? Math.round((done / scheduled) * 100) : 0;

    const col = el('div', { style: { flex: '1', textAlign: 'center' } });
    col.appendChild(el('div', { style: { fontSize: '10px', fontWeight: isToday ? 800 : 500, color: isToday ? '#0d9488' : '#94a3b8', marginBottom: '4px' } }, [d.toLocaleDateString([], { weekday: 'short' })]));

    const barOuter = el('div', { style: { height: '32px', background: '#f1f5f9', borderRadius: '4px', position: 'relative', overflow: 'hidden' } });
    if (scheduled > 0) {
      const barInner = el('div', { style: { position: 'absolute', bottom: '0', left: '0', right: '0', height: pct + '%', background: done === scheduled ? '#0d9488' : '#d1e0dd', borderRadius: '4px', transition: 'height .2s' } });
      barOuter.appendChild(barInner);
    }
    col.appendChild(barOuter);

    if (scheduled > 0) col.appendChild(el('div', { style: { fontSize: '9px', color: '#64748b', marginTop: '2px' } }, [done + '/' + scheduled]));
    wrap.appendChild(col);
  }

  return wrap;
}

function _relTime(date) {
  const now = new Date();
  const diffM = Math.floor((now - date) / 60000);
  if (diffM < 1) return 'just now';
  if (diffM < 60) return diffM + 'm ago';
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return diffH + 'h ago';
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return diffD + 'd ago';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
