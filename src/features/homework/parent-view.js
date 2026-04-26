// Parent homework view — Phase 4
// Three sections: Today, This Week, All Homework
// Per-exercise checkboxes with three-status completion modal

import { loadHomeworkForParent, loadCompletionsV2, isExerciseScheduledOn, exerciseSlotsOn, resolveExerciseSchedule } from './data.js';
import { mountCompleteModal } from './complete-modal.js';
import { injectHomeworkStyles } from './styles.js';

const T = (k, p) => window.HUD?.T?.(k, p) || k;
const _pad = n => String(n).padStart(2, '0');
const _fmtLocal = d => d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate());

export function renderHomeworkParent({ childId, isWeb }) {
  injectHomeworkStyles();
  const H = window.HUD || {};
  const { el, mkBtn, toast, re, DB, S, session } = H;
  const child = DB?.children?.find(c => c.id === childId);

  const sec = el('div', { class: 'section' });

  // Back bar (mobile only)
  if (!(window.innerWidth >= 1024 && session?.role === 'parent')) {
    const backBar = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1.5px solid #e2e8f0' } });
    const backBtn = el('button', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#0d9488', fontWeight: 800, fontSize: '.84rem', padding: '0', minHeight: '44px', fontFamily: 'inherit' } }, [T('ss_back')]);
    backBtn.onclick = () => { S.activeTab = 'dashboard'; re(); };
    backBar.appendChild(backBtn);
    sec.appendChild(backBar);
  }

  // Header
  sec.appendChild(el('h2', { class: 'page-title' }, [T('hw_title')]));
  sec.appendChild(el('p', { class: 'page-sub' }, [(child?.avatar || '') + ' ' + T('hw_child_tasks', { child: child?.name || '' })]));

  // Loading host
  const host = el('div');
  host.appendChild(el('div', { style: { textAlign: 'center', padding: '24px', color: '#64748b' } }, [T('btn_loading')]));
  sec.appendChild(host);

  _loadAndRender(host, childId, isWeb, H);
  return sec;
}

async function _loadAndRender(host, childId, isWeb, H) {
  const { el, mkBtn, toast, re, DB, S } = H;

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [homeworks, completions] = await Promise.all([
    loadHomeworkForParent(childId),
    loadCompletionsV2(childId, fourteenDaysAgo),
  ]);

  host.innerHTML = '';

  if (!homeworks.length) {
    host.appendChild(el('div', { class: 'empty-state' }, [
      el('span', { class: 'empty-state-icon' }, ['\ud83d\udccb']),
      el('div', { class: 'empty-state-title' }, [T('hw_no_tasks')]),
      el('div', { class: 'empty-state-body' }, [T('hw_no_tasks_parent_desc')])
    ]));
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = _fmtLocal(today);

  // Build completion lookup: key = exerciseId:date:slot
  const compMap = {};
  completions.forEach(c => {
    const key = c.exercise_id + ':' + c.scheduled_date + ':' + (c.slot || '');
    compMap[key] = c;
  });

  // ── Today section ──
  const todayItems = _buildDayItems(homeworks, today, compMap);
  if (todayItems.length) {
    host.appendChild(el('div', { class: 'hw2-section-label' }, [T('hw4_today')]));
    const todayWrap = el('div', { style: { marginBottom: '20px' } });
    todayItems.forEach(item => todayWrap.appendChild(_renderExerciseRow(item, childId, compMap, H)));
    host.appendChild(todayWrap);
  }

  // ── This Week section ──
  const weekItems = _buildWeekItems(homeworks, today, compMap);
  if (weekItems.length) {
    host.appendChild(el('div', { class: 'hw2-section-label', style: { marginTop: '16px' } }, [T('hw4_this_week')]));
    const weekWrap = el('div', { style: { marginBottom: '20px' } });
    let currentDate = '';
    weekItems.forEach(item => {
      if (item.dateStr !== currentDate) {
        currentDate = item.dateStr;
        const dateObj = new Date(item.dateStr + 'T12:00:00');
        const label = dateObj.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
        weekWrap.appendChild(el('div', { style: { fontSize: '12px', fontWeight: 700, color: '#64748b', marginTop: '12px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.03em' } }, [label]));
      }
      weekWrap.appendChild(_renderExerciseRow(item, childId, compMap, H));
    });
    host.appendChild(weekWrap);
  }

  // ── All Homework section (collapsed cards) ──
  host.appendChild(el('div', { class: 'hw2-section-label', style: { marginTop: '20px' } }, [T('hw4_all_homework')]));
  homeworks.forEach(hw => {
    const exercises = hw.exercises || [];
    const card = el('div', { style: { background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', marginBottom: '10px', borderInlineStart: '4px solid ' + (hw.is_pinned ? '#f59e0b' : '#0d9488') } });

    // Title row
    const titleRow = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' } });
    titleRow.appendChild(el('div', { style: { fontWeight: 600, fontSize: '15px', color: '#0f1a18' } }, [hw.title]));
    if (hw.is_pinned) titleRow.appendChild(el('span', { style: { fontSize: '10px', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '1px 8px', borderRadius: '99px' } }, ['\ud83d\udccc']));
    card.appendChild(titleRow);

    // Exercise count + schedule
    const sched = resolveExerciseSchedule(hw, exercises[0] || {});
    const schedLabel = sched.recurrence === 'daily' ? T('hw4_daily') : sched.recurrence === 'specific_days' ? sched.specificDays.join(', ') : sched.recurrence;
    card.appendChild(el('div', { style: { fontSize: '12px', color: '#64748b', marginBottom: '8px' } }, [exercises.length + ' exercise' + (exercises.length !== 1 ? 's' : '') + ' \u00b7 ' + schedLabel]));

    // Week progress bar
    const weekProgress = _weekProgressForHomework(hw, completions, today);
    if (weekProgress.total > 0) {
      const pct = Math.round((weekProgress.done / weekProgress.total) * 100);
      const progressRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } });
      const barOuter = el('div', { style: { flex: '1', height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' } });
      const barInner = el('div', { style: { height: '100%', background: weekProgress.done === weekProgress.total ? '#0d9488' : '#d1e0dd', width: pct + '%', borderRadius: '3px', transition: 'width .2s' } });
      barOuter.appendChild(barInner);
      progressRow.appendChild(barOuter);
      progressRow.appendChild(el('span', { style: { fontSize: '11px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' } }, [weekProgress.done + '/' + weekProgress.total]));
      card.appendChild(progressRow);
    }

    host.appendChild(card);
  });
}

function _buildDayItems(homeworks, date, compMap) {
  const items = [];
  const dateStr = _fmtLocal(date);
  homeworks.forEach(hw => {
    (hw.exercises || []).forEach(ex => {
      const slots = exerciseSlotsOn(hw, ex, date);
      slots.forEach(slot => {
        const key = ex.id + ':' + dateStr + ':' + slot;
        items.push({ homework: hw, exercise: ex, dateStr, slot, completion: compMap[key] || null });
      });
    });
  });
  return items;
}

function _buildWeekItems(homeworks, today, compMap) {
  const items = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dayItems = _buildDayItems(homeworks, d, compMap);
    items.push(...dayItems);
  }
  return items;
}

function _weekProgressForHomework(hw, completions, today) {
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() + mondayOffset);

  let total = 0;
  let done = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dateStr = _fmtLocal(d);
    (hw.exercises || []).forEach(ex => {
      const slots = exerciseSlotsOn(hw, ex, d);
      slots.forEach(slot => {
        total++;
        const match = completions.find(c => c.exercise_id === ex.id && c.scheduled_date === dateStr && (c.slot || '') === slot);
        if (match) done++;
      });
    });
  }
  return { done, total };
}

function _renderExerciseRow(item, childId, compMap, H) {
  const { el } = H;
  const { homework, exercise, dateStr, slot, completion } = item;

  const row = el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px', marginBottom: '6px', cursor: 'pointer', transition: 'border-color .12s' } });

  // Status indicator
  const statusIcon = el('div', { style: { width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: '0' } });
  if (completion) {
    if (completion.status === 'done') {
      statusIcon.style.background = '#d1fae5';
      statusIcon.style.color = '#059669';
      statusIcon.textContent = '\u2713';
    } else if (completion.status === 'skipped') {
      statusIcon.style.background = '#f1f5f9';
      statusIcon.style.color = '#64748b';
      statusIcon.textContent = '\u2192';
    } else if (completion.status === 'cant_do') {
      statusIcon.style.background = '#fef3c7';
      statusIcon.style.color = '#d97706';
      statusIcon.textContent = '\u26a0';
    }
  } else {
    statusIcon.style.border = '2px solid #cbd5e1';
    statusIcon.style.background = '#fff';
  }
  row.appendChild(statusIcon);

  // Content
  const content = el('div', { style: { flex: '1', minWidth: '0' } });
  content.appendChild(el('div', { style: { fontWeight: 600, fontSize: '14px', color: completion ? '#94a3b8' : '#0f1a18', textDecoration: completion?.status === 'done' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, [exercise.title]));
  const meta = [];
  if (homework.title !== exercise.title) meta.push(homework.title);
  if (slot) meta.push(slot.charAt(0).toUpperCase() + slot.slice(1));
  const measure = (exercise.sets && exercise.reps) ? exercise.sets + '\u00d7' + exercise.reps : exercise.duration_seconds ? Math.round(exercise.duration_seconds / 60) + ' min' : '';
  if (measure) meta.push(measure);
  if (meta.length) {
    content.appendChild(el('div', { style: { fontSize: '12px', color: '#94a3b8', marginTop: '2px' } }, [meta.join(' \u00b7 ')]));
  }
  row.appendChild(content);

  // Tap handler
  if (!completion) {
    row.onclick = () => {
      mountCompleteModal({ homework, exercise, slot, scheduledDate: dateStr, childId, onSaved: () => H.re?.() });
    };
  } else {
    row.style.opacity = '0.7';
    row.style.cursor = 'default';
  }

  return row;
}
