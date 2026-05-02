// Parent homework view — Phase 4 redesign
// Collapsible specialist sections, per-exercise status rows, week day-pills

import { loadHomeworkForParent, loadCompletionsV2, isExerciseScheduledOn, exerciseSlotsOn } from './data.js';
import { mountCompleteModal } from './complete-modal.js';
import { injectHomeworkStyles } from './styles.js';

const T = (k, p) => window.HUD?.T?.(k, p) || k;
const _pad = n => String(n).padStart(2, '0');
const _fmtLocal = d => d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate());

// Module-local collapse state (per-session, not persisted)
const _collapseState = {};

export function renderHomeworkParent({ childId, isWeb }) {
  injectHomeworkStyles();
  const H = window.HUD || {};
  const { el, re, S, session, DB } = H;
  const child = DB?.children?.find(c => c.id === childId);

  const sec = el('div', { class: 'section' });

  if (!(window.innerWidth >= 1024 && session?.role === 'parent')) {
    const backBar = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1.5px solid #e2e8f0' } });
    const backBtn = el('button', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#0d9488', fontWeight: 800, fontSize: '.84rem', padding: '0', minHeight: '44px', fontFamily: 'inherit' } }, [T('ss_back')]);
    backBtn.onclick = () => { S.activeTab = 'dashboard'; re(); };
    backBar.appendChild(backBtn);
    sec.appendChild(backBar);
  }

  const headerWrap = el('div', { style: { marginBottom: '18px' } });
  headerWrap.appendChild(el('h2', { class: 'page-title' }, [T('hw_title')]));
  const today = new Date();
  const dateSub = (child?.avatar || '') + ' ' + (child?.name || '') + ' \u00b7 ' + today.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  headerWrap.appendChild(el('p', { class: 'page-sub' }, [dateSub]));
  sec.appendChild(headerWrap);

  const host = el('div');
  host.appendChild(el('div', { style: { textAlign: 'center', padding: '24px', color: '#64748b' } }, [T('btn_loading')]));
  sec.appendChild(host);

  _loadAndRender(host, childId, isWeb, H);
  return sec;
}

async function _loadAndRender(host, childId, isWeb, H) {
  const { el } = H;

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [homeworks, completions] = await Promise.all([
    loadHomeworkForParent(childId),
    loadCompletionsV2(childId, fourteenDaysAgo),
  ]);

  const compMap = {};
  completions.forEach(c => {
    compMap[c.homework_exercise_id + ':' + c.scheduled_date + ':' + (c.slot || '')] = c;
  });

  host.innerHTML = '';

  if (!homeworks.length) {
    host.appendChild(el('div', { class: 'empty-state' }, [
      el('span', { class: 'empty-state-icon' }, ['\ud83d\udccb']),
      el('div', { class: 'empty-state-title' }, [T('hw_no_tasks')]),
      el('div', { class: 'empty-state-body' }, [T('hw_no_tasks_parent_desc')])
    ]));
    return;
  }

  const specGroups = _groupBySpecialist(homeworks, H);
  specGroups.forEach(group => host.appendChild(_renderSpecialistSection(group, compMap, childId, isWeb, H)));
}

function _groupBySpecialist(homeworks, H) {
  const specCache = H.DB?.specialists || [];
  const map = {};
  homeworks.forEach(hw => {
    const key = hw.specialist_id || 'unknown';
    if (!map[key]) {
      const cached = specCache.find(s => s.id === key);
      map[key] = {
        specId: key,
        specName: hw.specialist_name || cached?.name || 'Specialist',
        specRole: cached?.role || '',
        homeworks: [],
      };
    }
    map[key].homeworks.push(hw);
  });
  return Object.values(map);
}

function _renderSpecialistSection(group, compMap, childId, isWeb, H) {
  const { el } = H;
  const { specId, specName, specRole, homeworks } = group;
  const collapsed = _collapseState[specId] || false;

  const section = el('div', { style: { marginBottom: '20px' } });

  // Header
  const header = el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#f5fafa', borderRadius: '10px', cursor: 'pointer', userSelect: 'none', marginBottom: collapsed ? '0' : '10px', transition: 'margin-bottom .15s' } });
  const chevron = el('span', { style: { fontSize: '11px', color: '#4a7570', width: '14px', textAlign: 'center', flexShrink: '0' } }, [collapsed ? '\u25b6' : '\u25bc']);
  header.appendChild(chevron);
  const nameEl = el('span', { style: { flex: '1', fontWeight: 600, fontSize: '14px', color: '#0f1a18' } }, [specName + (specRole ? ' \u00b7 ' + specRole : '')]);
  header.appendChild(nameEl);
  header.appendChild(el('span', { style: { fontSize: '12px', color: '#64748b', fontWeight: 500, flexShrink: '0' } }, [homeworks.length + ' active']));

  const body = el('div', { style: {
    display: collapsed ? 'none' : (isWeb && homeworks.length >= 4 ? 'grid' : 'flex'),
    gridTemplateColumns: isWeb && homeworks.length >= 4 ? 'repeat(auto-fit,minmax(380px,1fr))' : undefined,
    flexDirection: 'column',
    gap: '12px',
  } });

  header.onclick = () => {
    _collapseState[specId] = !_collapseState[specId];
    body.style.display = _collapseState[specId] ? 'none' : (isWeb && homeworks.length >= 4 ? 'grid' : 'flex');
    chevron.textContent = _collapseState[specId] ? '\u25b6' : '\u25bc';
    header.style.marginBottom = _collapseState[specId] ? '0' : '10px';
  };

  section.appendChild(header);
  homeworks.forEach(hw => body.appendChild(_renderHomeworkCard(hw, compMap, childId, isWeb, H)));
  section.appendChild(body);
  return section;
}

function _renderHomeworkCard(hw, compMap, childId, isWeb, H) {
  const { el } = H;
  const exercises = hw.exercises || [];

  const card = el('div', { style: { background: '#fff', border: '1px solid #e8f4f2', borderRadius: '14px', padding: isWeb ? '20px' : '14px 14px 10px', boxShadow: '0 1px 3px rgba(13,148,136,.08),0 1px 2px rgba(0,0,0,.04)', transition: 'box-shadow .15s,border-color .15s' } });
  if (isWeb) {
    card.onmouseenter = () => { card.style.boxShadow = '0 4px 12px rgba(13,148,136,.10),0 2px 4px rgba(0,0,0,.06)'; card.style.borderColor = '#c4dbd8'; };
    card.onmouseleave = () => { card.style.boxShadow = '0 1px 3px rgba(13,148,136,.08),0 1px 2px rgba(0,0,0,.04)'; card.style.borderColor = '#e8f4f2'; };
  }

  // Card header
  const hdr = el('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' } });
  const hdrLeft = el('div');
  hdrLeft.appendChild(el('div', { style: { fontWeight: 600, fontSize: '15px', color: '#0f1a18', marginBottom: '2px' } }, [hw.title]));
  const schedParts = [];
  const rec = hw.recurrence || 'daily';
  if (rec === 'daily') schedParts.push(T('hw4_daily'));
  else if (rec === 'specific_days') schedParts.push((hw.specific_days || []).map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(' \u00b7 '));
  else if (rec === 'every_other_day') schedParts.push('Every other day');
  else if (rec === 'once') schedParts.push('Once');
  else schedParts.push(rec);
  schedParts.push(exercises.length + ' exercise' + (exercises.length !== 1 ? 's' : ''));
  hdrLeft.appendChild(el('div', { style: { fontSize: '12px', color: '#7aaba5', fontWeight: 500 } }, [schedParts.join(' \u00b7 ')]));
  hdr.appendChild(hdrLeft);
  const kebab = el('button', { style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#94a3b8', padding: '4px 6px', borderRadius: '6px', lineHeight: '1' } }, ['\u22ef']);
  kebab.onclick = (e) => e.stopPropagation();
  hdr.appendChild(kebab);
  card.appendChild(hdr);

  if (hw.description) {
    card.appendChild(el('div', { style: { fontSize: '13px', color: '#475569', lineHeight: '1.5', whiteSpace: 'pre-wrap', padding: '10px 12px', background: '#f0fdf9', borderRadius: '8px', marginBottom: '8px' } }, [hw.description]));
  }

  // Exercise rows
  exercises.forEach(ex => card.appendChild(_renderExerciseRow(hw, ex, compMap, childId, H)));

  // Week footer
  card.appendChild(_renderWeekFooter(hw, compMap, el));

  return card;
}

function _renderExerciseRow(hw, ex, compMap, childId, H) {
  const { el } = H;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = _fmtLocal(today);
  const slots = exerciseSlotsOn(hw, ex, today);
  const scheduledToday = slots.length > 0;

  let doneCount = 0, cantDoCount = 0, skippedCount = 0;
  slots.forEach(slot => {
    const comp = compMap[ex.id + ':' + todayStr + ':' + slot];
    if (comp?.status === 'done') doneCount++;
    else if (comp?.status === 'cant_do') cantDoCount++;
    else if (comp?.status === 'skipped') skippedCount++;
  });

  const allDone = scheduledToday && doneCount === slots.length;
  const hasCantDo = cantDoCount > 0;
  // hasSkipped checked after hasCantDo — cant_do takes priority in display
  const hasSkipped = skippedCount > 0 && doneCount === 0 && cantDoCount === 0;
  const pending = scheduledToday && !allDone && !hasCantDo && !hasSkipped;

  // Status icon
  let iconText, iconBg, iconColor;
  if (!scheduledToday) { iconText = '\u25cb'; iconBg = 'transparent'; iconColor = '#c4dbd8'; }
  else if (allDone) { iconText = '\u2713'; iconBg = '#0d9488'; iconColor = '#fff'; }
  else if (hasCantDo) { iconText = '\u26a0'; iconBg = '#fef3c7'; iconColor = '#d97706'; }
  else if (hasSkipped) { iconText = '\u2014'; iconBg = '#f1f5f9'; iconColor = '#94a3b8'; }
  else if (slots.length > 1 && doneCount > 0) { iconText = doneCount + '/' + slots.length; iconBg = '#E1F5EE'; iconColor = '#0d9488'; }
  else { iconText = '\u25cb'; iconBg = '#E1F5EE'; iconColor = '#0d9488'; }

  // Row background
  let rowBg, rowBorder;
  if (!scheduledToday) { rowBg = 'transparent'; rowBorder = 'transparent'; }
  else if (allDone) { rowBg = '#E1F5EE'; rowBorder = 'rgba(13,148,136,.25)'; }
  else if (hasCantDo) { rowBg = '#FAEEDA'; rowBorder = 'rgba(217,119,6,.25)'; }
  else if (hasSkipped) { rowBg = '#f8fafc'; rowBorder = '#e2e8f0'; }
  else { rowBg = '#E1F5EE'; rowBorder = 'rgba(13,148,136,.25)'; }

  // Right label (D1: no "Today" for pending)
  let rightLabel = '', rightColor = '#64748b';
  if (!scheduledToday) { rightLabel = _nextScheduledDay(hw, ex, today); rightColor = '#94a3b8'; }
  else if (allDone) { rightLabel = T('hw4_done'); rightColor = '#059669'; }
  else if (hasCantDo) { rightLabel = T('hw4_cant_do'); rightColor = '#d97706'; }
  else if (hasSkipped) { rightLabel = T('hw4_skipped'); rightColor = '#94a3b8'; }

  const interactive = scheduledToday && !allDone && !hasCantDo && !hasSkipped;

  const row = el('div', { style: {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
    background: rowBg, border: '0.5px solid ' + rowBorder, borderRadius: '8px',
    marginBottom: '5px', cursor: interactive ? 'pointer' : 'default',
    opacity: !scheduledToday ? '0.55' : (allDone ? '0.65' : '1'),
    transition: 'background .12s',
  } });

  // Icon
  const icon = el('div', { style: {
    width: '26px', height: '26px', borderRadius: '50%', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: slots.length > 1 && doneCount > 0 && !allDone && !hasCantDo && !hasSkipped ? '10px' : '13px',
    fontWeight: 700, flexShrink: '0', background: iconBg, color: iconColor,
    border: iconBg === 'transparent' ? '1.5px solid #c4dbd8' : 'none',
  } }, [iconText]);
  row.appendChild(icon);

  // Content
  const content = el('div', { style: { flex: '1', minWidth: '0' } });
  content.appendChild(el('div', { style: { fontWeight: 500, fontSize: '13px', color: !scheduledToday ? '#94a3b8' : '#0f1a18', textDecoration: allDone ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, [ex.title]));
  const subParts = [];
  if (scheduledToday && slots.length === 1) subParts.push(slots[0].charAt(0).toUpperCase() + slots[0].slice(1));
  else if (scheduledToday && slots.length > 1) subParts.push(slots.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' + '));
  const measure = (ex.sets && ex.reps) ? ex.sets + '\u00d7' + ex.reps + ' reps' : ex.duration_seconds ? Math.round(ex.duration_seconds / 60) + ' min' : '';
  if (measure) subParts.push(measure);
  if (!scheduledToday && !measure) subParts.push('Not today');
  const attachCount = Math.max((ex.attached_file_paths || []).length, (ex.attached_file_urls || []).length);
  if (attachCount > 0) subParts.push('\ud83d\udcce ' + attachCount);
  if (subParts.length) content.appendChild(el('div', { style: { fontSize: '11px', color: '#94a3b8', marginTop: '1px' } }, [subParts.join(' \u00b7 ')]));
  if (ex.instructions) content.appendChild(el('div', { style: { fontSize: '12px', color: '#64748b', lineHeight: '1.4', whiteSpace: 'pre-wrap', marginTop: '3px' } }, [ex.instructions]));
  row.appendChild(content);

  // Right label
  if (rightLabel) row.appendChild(el('span', { style: { fontSize: '11px', fontWeight: 600, color: rightColor, flexShrink: '0' } }, [rightLabel]));

  if (interactive) {
    row.onclick = () => {
      mountCompleteModal({ homework: hw, exercise: ex, slot: slots.length === 1 ? slots[0] : null, scheduledDate: todayStr, childId, onSaved: () => H.re?.() });
    };
  }

  return row;
}

// Explicit day pill state computation (S2)
function computeDayPillState(hw, date, compMap) {
  const dateStr = _fmtLocal(date);
  let totalSlots = 0, doneSlots = 0, cantDoSlots = 0, skippedSlots = 0;

  (hw.exercises || []).forEach(ex => {
    const slots = exerciseSlotsOn(hw, ex, date);
    slots.forEach(slot => {
      totalSlots++;
      const comp = compMap[ex.id + ':' + dateStr + ':' + slot];
      if (comp?.status === 'done') doneSlots++;
      else if (comp?.status === 'cant_do') cantDoSlots++;
      else if (comp?.status === 'skipped') skippedSlots++;
    });
  });

  if (totalSlots === 0) return 'notScheduled';
  if (doneSlots === totalSlots) return 'allDone';
  if (cantDoSlots > 0) return 'hasCantDo';
  if (skippedSlots > 0 && doneSlots === 0) return 'hasSkipped';
  return 'pending';
}

function _renderWeekFooter(hw, compMap, el) {
  const footer = el('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' } });

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const todayStr = _fmtLocal(now);
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() + mondayOffset);

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  let weekDone = 0, weekTotal = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const ds = _fmtLocal(d);
    const isToday = ds === todayStr;
    const state = computeDayPillState(hw, d, compMap);

    if (state !== 'notScheduled') weekTotal++;
    if (state === 'allDone') weekDone++;

    let bg, color, border;
    if (state === 'allDone') { bg = '#10b981'; color = '#fff'; border = 'none'; }
    else if (state === 'hasCantDo') { bg = '#f59e0b'; color = '#fff'; border = 'none'; }
    else if (state === 'hasSkipped') { bg = '#94a3b8'; color = '#fff'; border = 'none'; }
    else if (state === 'pending') { bg = '#e2e8f0'; color = '#475569'; border = 'none'; }
    else { bg = 'transparent'; color = '#c4dbd8'; border = '1px solid #e2e8f0'; }

    const pill = el('div', { style: {
      width: '22px', height: '22px', borderRadius: '50%', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700,
      background: bg, color, border: border || 'none',
      outline: isToday ? '2px solid #0d9488' : 'none', outlineOffset: '1px',
    } }, [dayLabels[i]]);
    footer.appendChild(pill);
  }

  footer.appendChild(el('div', { style: { flex: '1' } }));
  footer.appendChild(el('span', { style: { fontSize: '11px', color: '#64748b', fontWeight: 600 } }, [weekDone + '/' + weekTotal + ' ' + T('hw4_done').toLowerCase()]));

  return footer;
}

function _nextScheduledDay(hw, ex, today) {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i);
    if (isExerciseScheduledOn(hw, ex, d)) {
      return i === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'short' });
    }
  }
  return '';
}
