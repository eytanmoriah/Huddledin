// Specialist homework detail view — Session D Sub-commit 2.6
// Simplified header (title + kebab + schedule line), per-exercise cards
// collapse by default with always-visible day-box rows. Tap a day-box →
// read-only completion modal.

import { loadHomeworkDetail, loadCompletionsV2 } from './data.js';
import { injectHomeworkStyles } from './styles.js';
import {
  _generateDayBoxWindow,
  _findNextAppointment,
  _attachDayBoxRowScroll,
} from './parent-view.js';

const T = (k, p) => window.HUD?.T?.(k, p) || k;
const _pad = n => String(n).padStart(2, '0');
const _fmtLocal = d => d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate());
const _DAY_NAMES_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const _MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function renderHomeworkDetail({ homeworkId, isWeb }) {
  injectHomeworkStyles();
  const H = window.HUD || {};
  const { el, re, S } = H;

  const sec = el('div', { class: 'section' });

  // Back bar
  const backRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1.5px solid #e2e8f0' } });
  const backBtn = el('button', { style: { background: 'none', border: 'none', cursor: 'pointer', color: '#0d9488', fontWeight: 700, fontSize: '.84rem', fontFamily: 'inherit', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' } }, ['← Back']);
  backBtn.onclick = () => { S._hwTaskView = null; S._hwSpecExpandedExercises = null; re(); };
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
  const { el, S } = H;
  const result = await loadHomeworkDetail(homeworkId);
  host.innerHTML = '';

  if (!result) {
    host.appendChild(el('div', { style: { textAlign: 'center', padding: '24px', color: '#ef4444' } }, ['Could not load homework.']));
    return;
  }

  const { homework: hwBase, exercises } = result;
  const hw = { ...hwBase, exercises };

  // Load v2 completions for this child (90-day window — generous for grid display)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const v2Completions = await loadCompletionsV2(hw.child_id, ninetyDaysAgo);
  const v2ForThis = v2Completions.filter(c => c.homework_id === homeworkId);

  // Build compMap (same shape as parent-view): ex.id + ':' + scheduled_date + ':' + (slot||'')
  const compMap = {};
  v2ForThis.forEach(c => {
    compMap[c.homework_exercise_id + ':' + c.scheduled_date + ':' + (c.slot || '')] = c;
  });

  // Ensure expansion state slot exists for this homework
  if (!S._hwSpecExpandedExercises) S._hwSpecExpandedExercises = {};
  if (!S._hwSpecExpandedExercises[hw.id]) S._hwSpecExpandedExercises[hw.id] = {};

  // ── Header card ──
  host.appendChild(_renderHeader(hw, H));

  // ── Per-exercise grid ──
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const nextApptDate = hw.duration_type === 'next_appointment'
    ? _findNextAppointment(hw.child_id, hw.specialist_id, H)
    : null;

  host.appendChild(el('div', { class: 'hw2-section-label', style: { marginTop: '20px' } }, ['Progress']));

  exercises.forEach(ex => {
    host.appendChild(_renderExerciseCard(ex, hw, compMap, today, nextApptDate, H));
  });
}

// ── Header card ──

function _renderHeader(hw, H) {
  const { el } = H;

  const header = el('div', { style: { background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '16px' } });

  // Top row: title + kebab
  const topRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } });
  topRow.appendChild(el('div', { style: { fontWeight: 700, fontSize: '18px', color: '#0f1a18', flex: '1', minWidth: '0' } }, [hw.title]));

  // Pinned/Paused chips before kebab
  if (hw.is_pinned) topRow.appendChild(el('span', { style: { fontSize: '10px', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: '99px', flexShrink: '0' } }, ['📌 Pinned']));
  if (hw.is_paused) topRow.appendChild(el('span', { style: { fontSize: '10px', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '99px', flexShrink: '0' } }, ['Paused']));

  const kebabBtn = el('button', {
    style: {
      background: 'none', border: 'none', cursor: 'pointer',
      width: '32px', height: '32px', borderRadius: '8px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '20px', color: '#64748b', flexShrink: '0',
      padding: '0', lineHeight: '1',
    },
    title: 'More actions',
  }, ['⋮']);
  kebabBtn.onmouseenter = () => { kebabBtn.style.background = '#f1f5f9'; };
  kebabBtn.onmouseleave = () => { kebabBtn.style.background = 'none'; };
  kebabBtn.onclick = (e) => { e.stopPropagation(); _showKebabMenu(kebabBtn, hw, H); };
  topRow.appendChild(kebabBtn);
  header.appendChild(topRow);

  // Schedule line
  const scheduleText = _formatScheduleLine(hw);
  header.appendChild(el('div', { style: { fontSize: '12px', color: '#94a3b8', fontWeight: 500, marginTop: '4px' } }, [scheduleText]));

  // Description (plain text, only when populated)
  if (hw.description && hw.description.trim()) {
    header.appendChild(el('div', { style: { fontSize: '13px', color: '#64748b', fontStyle: 'italic', lineHeight: '1.5', marginTop: '8px' } }, [hw.description]));
  }

  return header;
}

// "Daily, mornings · until May 8" condensed format.
// Pluralizes time slot for recurring; plain "morning"/etc. for once.
function _formatScheduleLine(hw) {
  const recurrence = hw.recurrence || 'daily';
  const specificDays = hw.specific_days || [];
  const timeOfDay = hw.time_of_day || 'morning';
  const durationType = hw.duration_type;
  const endDate = hw.end_date;

  // Build cadence segment
  let cadence = '';
  if (recurrence === 'once') cadence = 'One time';
  else if (recurrence === 'daily') cadence = 'Daily';
  else if (recurrence === 'every_other_day') cadence = 'Every other day';
  else if (recurrence === 'specific_days' && specificDays.length) {
    const dayLabels = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
    cadence = specificDays.map(d => dayLabels[d] || d).join('/');
  } else {
    cadence = 'Daily';
  }

  // Build time segment (pluralize for recurring, singular for once)
  const timeSlots = timeOfDay.split(',').filter(Boolean);
  const isRecurring = recurrence !== 'once';
  const timeText = timeSlots.map(t => t + (isRecurring ? 's' : '')).join(' + ');

  // Once-off: "One time · [date]"
  if (recurrence === 'once') {
    if (hw.created_at) {
      const d = new Date(hw.created_at);
      return cadence + ' · ' + _MONTH_NAMES[d.getMonth()] + ' ' + d.getDate();
    }
    return cadence;
  }

  // Build until/duration segment
  let until = 'ongoing';
  if (durationType === 'end_date' && endDate) {
    const d = new Date(endDate + 'T12:00:00');
    until = 'until ' + _MONTH_NAMES[d.getMonth()] + ' ' + d.getDate();
  } else if (durationType === 'next_appointment') {
    // We don't have next appt info synchronously here; use 'ongoing' as fallback.
    // Specialist can see exact date via the day-box grid below.
    until = 'until next session';
  } else if (durationType === 'open_ended') {
    until = 'ongoing';
  }

  return cadence + ', ' + timeText + ' · ' + until;
}

// ── Kebab menu (inline popup, closes on outside click + escape) ──

function _showKebabMenu(anchor, hw, H) {
  const { el, mkBtn, toast, openConfirm, _supa, re, S } = H;

  // Remove any existing menus first
  document.querySelectorAll('.hw-spec-kebab-menu').forEach(m => m.remove());

  const menu = el('div', { class: 'long-press-menu hw-spec-kebab-menu' });

  const items = [
    {
      icon: '✏️',
      label: T('hw3_edit') || 'Edit',
      onClick: () => window.HUD_HOMEWORK.mountHomeworkCreateModal({ childId: hw.child_id, homeworkId: hw.id }),
    },
    {
      icon: hw.is_paused ? '▶' : '⏸',
      label: hw.is_paused ? (T('hw3_resume') || 'Resume') : (T('hw3_pause') || 'Pause'),
      onClick: async () => {
        const { error } = await _supa.from('homework_tasks').update({ is_paused: !hw.is_paused }).eq('id', hw.id);
        if (error) { console.error('❌ pause toggle:', error); toast('Could not update.', 'error'); return; }
        re();
      },
    },
    {
      icon: '🗄',
      label: T('hw3_archive_btn') || 'Archive',
      onClick: () => {
        openConfirm(T('hw3_archive_title'), T('hw3_archive_body'), false, async () => {
          const { error } = await _supa.from('homework_tasks').update({ status: 'archived' }).eq('id', hw.id);
          if (error) { console.error('❌ archive:', error); toast('Could not archive.', 'error'); return; }
          S._hwTaskView = null; S._hwSpecExpandedExercises = null; re();
        });
      },
    },
  ];

  items.forEach(it => {
    const row = el('div', { class: 'long-press-item' });
    row.appendChild(el('span', { style: { fontSize: '1rem' } }, [it.icon || '']));
    row.appendChild(el('span', { style: { flex: '1' } }, [it.label]));
    row.onclick = (e) => {
      e.stopPropagation();
      menu.remove();
      try { it.onClick && it.onClick(); } catch (err) { console.error('❌ menu action:', err); }
    };
    menu.appendChild(row);
  });

  document.body.appendChild(menu);

  // Position: prefer below anchor, flip up if overflow
  const rect = anchor.getBoundingClientRect();
  const mw = 200, mh = items.length * 48 + 12;
  let x = Math.min(rect.right - mw, window.innerWidth - mw - 12);
  x = Math.max(12, x);
  let y = rect.bottom + 8;
  if (y + mh > window.innerHeight - 12) y = rect.top - mh - 8;
  y = Math.max(12, y);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  // Close on outside click + Escape
  setTimeout(() => {
    const closeMenu = () => {
      menu.remove();
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
    const onPointer = (ev) => { if (!menu.contains(ev.target)) closeMenu(); };
    const onKey = (ev) => { if (ev.key === 'Escape') closeMenu(); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
  }, 50);
}

// ── Per-exercise card ──

function _renderExerciseCard(ex, hw, compMap, today, nextApptDate, H) {
  const { el, S } = H;

  const card = el('div', { style: {
    background: '#fff',
    border: '1.5px solid #e2e8f0',
    borderRadius: '12px',
    padding: '12px 14px',
    marginBottom: '10px',
  } });

  const isExpanded = !!(S._hwSpecExpandedExercises?.[hw.id]?.[ex.id]);

  // Compute boxes + counts up front so progress text can render either way
  const boxes = _generateDayBoxWindow(hw, today, nextApptDate)
    .filter(b => _isExerciseScheduledOnBox(ex, hw, b.date));

  let doneCount = 0, skippedCount = 0, cantDoCount = 0, pendingPastCount = 0;
  const dayStates = boxes.map(box => {
    const dayState = _classifyDay(ex, hw, box, compMap);
    if (dayState === 'done') doneCount++;
    else if (dayState === 'skipped') skippedCount++;
    else if (dayState === 'cant_do') cantDoCount++;
    else if (dayState === 'past_pending' || dayState === 'today_pending') pendingPastCount++;
    return dayState;
  });

  const progParts = [];
  if (doneCount > 0) progParts.push(doneCount + ' done');
  if (skippedCount > 0) progParts.push(skippedCount + ' skipped');
  if (cantDoCount > 0) progParts.push(cantDoCount + " couldn’t");
  if (pendingPastCount > 0) progParts.push(pendingPastCount + ' not yet');
  const progText = boxes.length === 0
    ? 'Not scheduled in current window'
    : (progParts.length > 0 ? progParts.join(' · ') : 'Not started yet');

  // Header row (chevron + name/measure + progress) — tap to toggle expand
  const headerRow = el('div', { style: {
    display: 'flex', alignItems: 'center', gap: '10px',
    cursor: 'pointer', userSelect: 'none',
  } });

  const chevron = el('div', { style: { fontSize: '12px', color: '#94a3b8', flexShrink: '0', width: '14px', textAlign: 'center' } }, [isExpanded ? '▾' : '▸']);
  headerRow.appendChild(chevron);

  const nameWrap = el('div', { style: { flex: '1', minWidth: '0' } });
  nameWrap.appendChild(el('div', { style: { fontWeight: 600, fontSize: '14px', color: '#0f1a18' } }, [ex.title]));
  const measure = (ex.sets && ex.reps) ? ex.sets + '×' + ex.reps + ' reps' : ex.duration_seconds ? Math.round(ex.duration_seconds / 60) + ' min' : '';
  if (measure) nameWrap.appendChild(el('div', { style: { fontSize: '12px', color: '#94a3b8', marginTop: '2px' } }, [measure]));
  headerRow.appendChild(nameWrap);

  headerRow.appendChild(el('div', { style: { fontSize: '11px', color: '#7aaba5', fontWeight: 500, flexShrink: '0', textAlign: 'right' } }, [progText]));

  card.appendChild(headerRow);

  // Day-box row (always visible when boxes exist)
  if (boxes.length > 0) {
    const row = el('div', { style: {
      display: 'flex',
      gap: '6px',
      overflowX: 'auto',
      overflowY: 'hidden',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      padding: '8px 2px 4px',
      marginTop: '6px',
    } });
    row.style.cssText += ';-ms-overflow-style:none;';
    row.classList.add('hw-bubble-daybox-row');

    boxes.forEach((box, idx) => {
      const boxEl = _renderDayBoxSpec(box, dayStates[idx], H, () => {
        _openCompletionModal(ex, hw, box.dStr, compMap, H);
      });
      row.appendChild(boxEl);
    });
    card.appendChild(row);
    _attachDayBoxRowScroll(row);
  }

  // Expanded content (instructions + metadata) — always built, display toggled
  const expWrap = el('div', { style: { marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: isExpanded ? 'block' : 'none' } });

  // Stop click propagation so selecting text doesn't collapse
  expWrap.onclick = (e) => e.stopPropagation();

  if (ex.instructions && ex.instructions.trim()) {
    expWrap.appendChild(el('div', { class: 'hw2-section-label' }, ['Instructions']));
    expWrap.appendChild(el('div', { style: { fontSize: '13px', color: '#475569', lineHeight: '1.5', marginBottom: '12px', whiteSpace: 'pre-wrap' } }, [ex.instructions]));
  }

  // Metadata blocks: Reps / Sets / Duration / Created
  const metaBlocks = [];
  if (ex.reps != null) metaBlocks.push(['Reps', String(ex.reps)]);
  if (ex.sets != null) metaBlocks.push(['Sets', String(ex.sets)]);
  if (ex.duration_seconds != null) metaBlocks.push(['Duration', Math.round(ex.duration_seconds / 60) + ' min']);
  if (ex.created_at) {
    const d = new Date(ex.created_at);
    metaBlocks.push(['Created', _MONTH_NAMES[d.getMonth()] + ' ' + d.getDate()]);
  }

  if (metaBlocks.length > 0) {
    const metaRow = el('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap' } });
    metaBlocks.forEach(([label, value]) => {
      const cell = el('div', { style: { minWidth: '60px' } });
      cell.appendChild(el('div', { style: { fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '2px' } }, [label]));
      cell.appendChild(el('div', { style: { fontSize: '13px', color: '#334155', fontWeight: 600 } }, [value]));
      metaRow.appendChild(cell);
    });
    expWrap.appendChild(metaRow);
  }

  card.appendChild(expWrap);

  // Tap handler — DOM-only toggle (no re()), state slot persists for future re-renders
  headerRow.onclick = () => {
    const next = !(S._hwSpecExpandedExercises[hw.id][ex.id]);
    S._hwSpecExpandedExercises[hw.id][ex.id] = next;
    expWrap.style.display = next ? 'block' : 'none';
    chevron.textContent = next ? '▾' : '▸';
  };

  return card;
}

// Returns true if this exercise is scheduled on this date.
function _isExerciseScheduledOnBox(ex, hw, date) {
  if (hw.is_paused) return false;
  if (hw.status !== 'active') return false;
  const recurrence = ex.override_recurrence || hw.recurrence || 'daily';
  const specificDays = ex.override_specific_days ?? hw.specific_days ?? [];
  const dStr = _fmtLocal(date);
  const startDate = new Date(hw.created_at || Date.now());
  const startStr = _fmtLocal(startDate);
  if (dStr < startStr) return false;
  if (hw.duration_type === 'end_date' && hw.end_date && dStr > hw.end_date) return false;
  if (recurrence === 'once') return dStr === startStr;
  if (recurrence === 'daily') return true;
  if (recurrence === 'every_other_day') {
    const dayMs = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((dayMs(date) - dayMs(startDate)) / 86400000);
    return diffDays >= 0 && diffDays % 2 === 0;
  }
  if (recurrence === 'specific_days') {
    const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];
    return (specificDays || []).includes(dayKey);
  }
  return false;
}

// Returns one of: 'done' | 'skipped' | 'cant_do' | 'today_pending' | 'past_pending' | 'future_pending'
// Multi-slot priority (Q1 Option 3 — strict all-done):
//   All slots = done → 'done'
//   Any 'cant_do' → 'cant_do'
//   Any 'skipped' (no cant_do) → 'skipped'
//   No completions → today/past/future_pending
function _classifyDay(ex, hw, box, compMap) {
  const timeSlots = (ex.override_time_of_day || hw.time_of_day || 'morning').split(',').filter(Boolean);
  const slots = timeSlots.length ? timeSlots : [''];

  let doneN = 0, cantDoN = 0, skippedN = 0;
  for (const slot of slots) {
    const comp = compMap[ex.id + ':' + box.dStr + ':' + (slot || '')];
    if (!comp) continue;
    if (comp.status === 'done') doneN++;
    else if (comp.status === 'cant_do') cantDoN++;
    else if (comp.status === 'skipped') skippedN++;
  }

  if (cantDoN > 0) return 'cant_do';
  if (skippedN > 0) return 'skipped';
  if (doneN === slots.length && doneN > 0) return 'done';

  if (box.isToday) return 'today_pending';
  if (box.isFuture) return 'future_pending';
  return 'past_pending';
}

// 32px day-box: day number on top + status icon below, stacked vertically.
function _renderDayBoxSpec(box, dayState, H, onTap) {
  const { el } = H;
  const { date, isToday } = box;
  const dayNum = String(date.getDate());

  let bg, color, border, icon;
  if (dayState === 'done') {
    bg = '#1D9E75'; color = '#fff'; border = 'none'; icon = '✓';
  } else if (dayState === 'cant_do') {
    bg = '#A32D2D'; color = '#fff'; border = 'none'; icon = '×';
  } else if (dayState === 'skipped') {
    bg = '#BA7517'; color = '#fff'; border = 'none'; icon = '→';
  } else if (dayState === 'today_pending') {
    bg = 'transparent'; color = '#0d9488'; border = '2px solid #0d9488'; icon = null;
  } else {
    // past_pending or future_pending
    bg = '#F1EFE8'; color = '#7aaba5'; border = 'none'; icon = null;
  }

  const boxEl = el('div', {
    style: {
      flexShrink: '0',
      width: '32px',
      height: '32px',
      borderRadius: '4px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      background: bg,
      color,
      border,
      gap: '1px',
      userSelect: 'none',
      WebkitTouchCallout: 'none',
      transition: 'transform .12s, border-color .12s',
    },
  });
  if (isToday) boxEl.dataset.today = '1';

  const numEl = el('div', { style: { fontSize: '10px', fontWeight: '600', lineHeight: '1' } }, [dayNum]);
  boxEl.appendChild(numEl);
  if (icon) {
    boxEl.appendChild(el('div', { style: { fontSize: '11px', fontWeight: '700', lineHeight: '1' } }, [icon]));
  }

  boxEl.onclick = onTap;
  return boxEl;
}

// ── Read-only completion modal ──

function _openCompletionModal(ex, hw, dateStr, compMap, H) {
  const { el, openModal } = H;

  // Build title: "Tuesday · May 6"
  const d = new Date(dateStr + 'T12:00:00');
  const title = _DAY_NAMES_LONG[d.getDay()] + ' · ' + _MONTH_NAMES[d.getMonth()] + ' ' + d.getDate();

  // Find all completion records for this exercise on this date (across slots)
  const timeSlots = (ex.override_time_of_day || hw.time_of_day || 'morning').split(',').filter(Boolean);
  const slots = timeSlots.length ? timeSlots : [''];
  const records = slots
    .map(slot => ({ slot, comp: compMap[ex.id + ':' + dateStr + ':' + (slot || '')] }))
    .filter(r => r.comp);

  openModal(title, (mb /*, close */) => {
    if (records.length === 0) {
      mb.appendChild(el('div', { style: { padding: '20px 4px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' } }, ['Not logged for this day']));
      return;
    }

    records.forEach((r, idx) => {
      // Optional slot heading (only when multiple slots present)
      if (records.length > 1 && r.slot) {
        const heading = r.slot.charAt(0).toUpperCase() + r.slot.slice(1);
        mb.appendChild(el('div', { style: { fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: idx > 0 ? '14px' : '0', marginBottom: '6px' } }, [heading]));
      }

      // Status row
      const status = r.comp.status;
      const statusLabels = { done: '✓ Done', skipped: '→ Skipped', cant_do: '× Couldn’t do' };
      const statusColors = { done: '#1D9E75', skipped: '#BA7517', cant_do: '#A32D2D' };
      mb.appendChild(el('div', { style: { fontSize: '15px', fontWeight: 700, color: statusColors[status] || '#0f1a18', marginBottom: '10px' } }, [statusLabels[status] || status]));

      // Reps
      if (r.comp.actual_value != null) {
        const unit = ex.duration_seconds ? 'min' : 'reps';
        mb.appendChild(el('div', { style: { fontSize: '13px', color: '#334155', marginBottom: '10px' } }, [
          el('span', { style: { fontWeight: 600, color: '#64748b' } }, ['Logged: ']),
          document.createTextNode(r.comp.actual_value + ' ' + unit),
        ]));
      }

      // Note
      if (r.comp.note) {
        mb.appendChild(el('div', { style: { fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '4px' } }, ['Note']));
        mb.appendChild(el('div', { style: { fontSize: '13px', color: '#475569', fontStyle: 'italic', lineHeight: '1.4', marginBottom: '12px', padding: '8px 10px', background: '#f0fdf9', borderRadius: '8px' } }, ['“' + r.comp.note + '”']));
      }

      // Photo or video — activates Session A's media_type column on the read side
      if (r.comp.photo_path || r.comp.photo_url) {
        const wrap = el('div', { style: { marginBottom: '8px' } });
        const isVideo = r.comp.media_type === 'video';
        const mediaEl = isVideo ? document.createElement('video') : document.createElement('img');
        if (isVideo) {
          mediaEl.controls = true;
          mediaEl.style.cssText = 'display:block;max-width:100%;max-height:300px;border-radius:8px;background:#000;';
        } else {
          mediaEl.style.cssText = 'display:block;max-width:100%;max-height:300px;border-radius:8px;object-fit:contain;background:#f0fdf9;cursor:pointer;';
          mediaEl.onerror = () => { mediaEl.style.opacity = '0.5'; };
        }

        // Async-fill: prefer path-based signing, fall back to legacy photo_url
        (async () => {
          let url = null;
          if (r.comp.photo_path) {
            try { url = await window.HUD?.SB?.signFile?.(r.comp.photo_path); } catch (_) {}
          }
          if (!url && r.comp.photo_url) url = r.comp.photo_url;
          if (url) mediaEl.src = url;
          else if (!isVideo) mediaEl.onerror();
        })();

        // Image lightbox: tap → open full-size in new tab (iOS-safe)
        if (!isVideo) {
          mediaEl.onclick = () => {
            const tab = window.open('about:blank', '_blank');
            (async () => {
              let url = null;
              if (r.comp.photo_path) {
                try { url = await window.HUD?.SB?.signFile?.(r.comp.photo_path); } catch (_) {}
              }
              if (!url && r.comp.photo_url) url = r.comp.photo_url;
              if (url && tab) tab.location = url;
              else if (tab) tab.close();
            })();
          };
        }

        wrap.appendChild(mediaEl);
        mb.appendChild(wrap);
      }
    });
  }, 380);
}
