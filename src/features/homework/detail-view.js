// Specialist homework detail view — Session D Sub-commit 2
// Per-exercise day-box grid replaces the prior per-completion activity feed.
// Each exercise gets a row of day-boxes (window per duration_type, statuses
// encoded by color/icon). Tap a day-box → read-only modal with completion details.

import { loadHomeworkDetail, loadCompletionsV2 } from './data.js';
import { scheduleSummary } from './schedule.js';
import { injectHomeworkStyles } from './styles.js';
import {
  _generateDayBoxWindow,
  _findNextAppointment,
  _isDayDone,
  _attachDayBoxRowScroll,
} from './parent-view.js';

const T = (k, p) => window.HUD?.T?.(k, p) || k;
const _pad = n => String(n).padStart(2, '0');
const _fmtLocal = d => d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate());
const _DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const _DAY_NAMES_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const _MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function renderHomeworkDetail({ homeworkId, isWeb }) {
  injectHomeworkStyles();
  const H = window.HUD || {};
  const { el, mkBtn, toast, openConfirm, _supa, re, DB, S, session } = H;

  const sec = el('div', { class: 'section' });

  // Back bar
  const backRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1.5px solid #e2e8f0' } });
  const backBtn = el('button', { style: { background: 'none', border: 'none', cursor: 'pointer', color: '#0d9488', fontWeight: 700, fontSize: '.84rem', fontFamily: 'inherit', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' } }, ['← Back']);
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

  const { homework: hw, exercises, occurrences } = result;

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

  // ── Header card (kept from previous version) ──
  const header = el('div', { style: { background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '16px' } });

  const metaRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' } });
  if (hw.is_pinned) metaRow.appendChild(el('span', { style: { fontSize: '10px', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '1px 8px', borderRadius: '99px' } }, ['📌 Pinned']));
  if (hw.is_paused) metaRow.appendChild(el('span', { style: { fontSize: '10px', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '1px 8px', borderRadius: '99px' } }, ['Paused']));
  const sched = scheduleSummary({ recurrence: hw.recurrence, specificDays: hw.specific_days || [], timeOfDay: hw.time_of_day || 'morning', durationType: hw.duration_type, endDate: hw.end_date });
  metaRow.appendChild(el('span', { style: { fontSize: '11px', color: '#64748b', fontWeight: 500 } }, [sched]));
  header.appendChild(metaRow);

  header.appendChild(el('div', { style: { fontWeight: 700, fontSize: '18px', color: '#0f1a18', marginBottom: '4px' } }, [hw.title]));
  const startDate = hw.created_at ? new Date(hw.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
  header.appendChild(el('div', { style: { fontSize: '12px', color: '#94a3b8', marginBottom: '12px' } }, ['Started ' + startDate + ' · ' + exercises.length + ' exercise' + (exercises.length !== 1 ? 's' : '')]));

  if (hw.description) {
    header.appendChild(el('div', { style: { fontSize: '13px', color: '#475569', lineHeight: '1.5', padding: '10px 12px', background: '#f0fdf9', borderRadius: '8px', marginBottom: '12px' } }, [hw.description]));
  }

  // Action buttons
  const actRow = el('div', { style: { display: 'flex', gap: '8px' } });
  actRow.appendChild(mkBtn('✏️ ' + T('hw3_edit'), 'btn-sm btn-ghost', () => window.HUD_HOMEWORK.mountHomeworkCreateModal({ childId: hw.child_id, homeworkId: hw.id })));
  actRow.appendChild(mkBtn(hw.is_paused ? '▶ ' + T('hw3_resume') : '⏸ ' + T('hw3_pause'), 'btn-sm btn-ghost', async () => {
    const { error } = await _supa.from('homework_tasks').update({ is_paused: !hw.is_paused }).eq('id', hw.id);
    if (error) { toast('Could not update.', 'error'); return; }
    re();
  }));
  actRow.appendChild(mkBtn('🗄 ' + T('hw3_archive_btn'), 'btn-sm btn-ghost', () => {
    openConfirm(T('hw3_archive_title'), T('hw3_archive_body'), false, async () => {
      const { error } = await _supa.from('homework_tasks').update({ status: 'archived' }).eq('id', hw.id);
      if (error) { toast('Could not archive.', 'error'); return; }
      S._hwTaskView = null; re();
    });
  }));
  header.appendChild(actRow);
  host.appendChild(header);

  // ── Week strip (kept — overall 7-day view across all exercises) ──
  host.appendChild(_renderWeekStrip(occurrences, result.completions, el));

  // ── Per-exercise grid (replaces old activity feed + per-exercise progress sections) ──
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const nextApptDate = hw.duration_type === 'next_appointment'
    ? _findNextAppointment(hw.child_id, hw.specialist_id, H)
    : null;

  host.appendChild(el('div', { class: 'hw2-section-label', style: { marginTop: '20px' } }, ['Progress']));

  exercises.forEach(ex => {
    host.appendChild(_renderExerciseGridRow(ex, hw, compMap, today, nextApptDate, H));
  });
}

// ── Per-exercise grid row ──

function _renderExerciseGridRow(ex, hw, compMap, today, nextApptDate, H) {
  const { el } = H;

  const card = el('div', { style: {
    background: '#fff',
    border: '1.5px solid #e2e8f0',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '12px',
  } });

  // Top row: exercise name + measure
  const topRow = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' } });
  topRow.appendChild(el('div', { style: { fontWeight: 600, fontSize: '14px', color: '#0f1a18', flex: '1', minWidth: '0' } }, [ex.title]));
  const measure = (ex.sets && ex.reps) ? ex.sets + '×' + ex.reps + ' reps' : ex.duration_seconds ? Math.round(ex.duration_seconds / 60) + ' min' : '';
  if (measure) topRow.appendChild(el('span', { style: { fontSize: '12px', color: '#64748b', fontWeight: 500, flexShrink: '0' } }, [measure]));
  card.appendChild(topRow);

  // Day-box row (uses parent-view's _generateDayBoxWindow + _attachDayBoxRowScroll)
  const boxes = _generateDayBoxWindow(hw, today, nextApptDate)
    .filter(b => _isExerciseScheduledOnBox(ex, hw, b.date));

  if (boxes.length === 0) {
    card.appendChild(el('div', { style: { fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' } }, ['Not scheduled in current window']));
    return card;
  }

  const row = el('div', { style: {
    display: 'flex',
    gap: '6px',
    overflowX: 'auto',
    overflowY: 'hidden',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    padding: '4px 2px 8px',
  } });
  row.style.cssText += ';-ms-overflow-style:none;';
  row.classList.add('hw-bubble-daybox-row');  // reuses existing webkit-scrollbar-hide CSS rule

  let doneCount = 0, skippedCount = 0, cantDoCount = 0, pendingPastCount = 0;
  boxes.forEach(box => {
    const dayState = _classifyDay(ex, hw, box, compMap);
    if (dayState === 'done') doneCount++;
    else if (dayState === 'skipped') skippedCount++;
    else if (dayState === 'cant_do') cantDoCount++;
    else if (dayState === 'past_pending' || dayState === 'today_pending') pendingPastCount++;

    const boxEl = _renderDayBoxSpec(box, dayState, H, () => {
      _openCompletionModal(ex, hw, box.dStr, compMap, H);
    });
    row.appendChild(boxEl);
  });
  card.appendChild(row);
  _attachDayBoxRowScroll(row);

  // Progress text
  const parts = [];
  if (doneCount > 0) parts.push(doneCount + ' done');
  if (skippedCount > 0) parts.push(skippedCount + ' skipped');
  if (cantDoCount > 0) parts.push(cantDoCount + " couldn’t");
  if (pendingPastCount > 0) parts.push(pendingPastCount + ' not yet');
  const progText = parts.length > 0 ? parts.join(' · ') : 'Not started yet';
  card.appendChild(el('div', { style: { fontSize: '11px', color: '#7aaba5', fontWeight: 500, marginTop: '6px' } }, [progText]));

  return card;
}

// Returns true if this exercise is scheduled on this date.
// _generateDayBoxWindow filters at the homework level (any exercise scheduled = day in window),
// but for the per-exercise grid we need per-exercise filtering using the same logic.
function _isExerciseScheduledOnBox(ex, hw, date) {
  // Reuse parent-view's logic via the homework's exercises array — but we need
  // isExerciseScheduledOn directly. It's exported from data.js, let's import on demand
  // via the bridge to avoid extra import statement noise. Inline a slim version:
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
  // Resolve slots for this exercise on this date (mirror parent-view's exerciseSlotsOn semantics)
  const timeSlots = (ex.override_time_of_day || hw.time_of_day || 'morning').split(',').filter(Boolean);
  const slots = timeSlots.length ? timeSlots : [''];

  let doneN = 0, cantDoN = 0, skippedN = 0, anyCompletion = false;
  for (const slot of slots) {
    const comp = compMap[ex.id + ':' + box.dStr + ':' + (slot || '')];
    if (!comp) continue;
    anyCompletion = true;
    if (comp.status === 'done') doneN++;
    else if (comp.status === 'cant_do') cantDoN++;
    else if (comp.status === 'skipped') skippedN++;
  }

  if (cantDoN > 0) return 'cant_do';
  if (skippedN > 0) return 'skipped';
  if (doneN === slots.length && doneN > 0) return 'done';

  // No qualifying completion → pending. Subdivide for visual.
  if (box.isToday) return 'today_pending';
  if (box.isFuture) return 'future_pending';
  return 'past_pending';
}

// Day-box renderer for specialist (3-status color encoding).
function _renderDayBoxSpec(box, dayState, H, onTap) {
  const { el } = H;
  const { date, isToday } = box;
  const label = _DAY_LETTERS[date.getDay()] + ' ' + date.getDate();

  let bg, color, border, content, fontWeight;
  if (dayState === 'done') {
    bg = '#1D9E75'; color = '#fff'; border = 'none';
    content = '✓'; fontWeight = '700';
  } else if (dayState === 'cant_do') {
    bg = '#A32D2D'; color = '#fff'; border = 'none';
    content = '×'; fontWeight = '700';
  } else if (dayState === 'skipped') {
    bg = '#D97706'; color = '#fff'; border = 'none';
    content = '→'; fontWeight = '700';
  } else if (dayState === 'today_pending') {
    bg = 'transparent'; color = '#0d9488'; border = '2px solid #0d9488';
    content = label; fontWeight = '700';
  } else {
    // past_pending or future_pending — same neutral visual
    bg = 'transparent'; color = '#7aaba5'; border = '1px solid #e2e8f0';
    content = label; fontWeight = '600';
  }

  const boxEl = el('div', {
    style: {
      flexShrink: '0',
      width: '44px',
      height: '36px',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      background: bg,
      color,
      border,
      fontSize: dayState === 'done' || dayState === 'cant_do' || dayState === 'skipped' ? '15px' : '11px',
      fontWeight,
      textAlign: 'center',
      userSelect: 'none',
      WebkitTouchCallout: 'none',
      transition: 'transform .12s, border-color .12s',
    },
  });
  if (isToday) boxEl.dataset.today = '1';
  boxEl.appendChild(document.createTextNode(content));
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
      const statusColors = { done: '#1D9E75', skipped: '#D97706', cant_do: '#A32D2D' };
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

// ── Week strip (kept from previous version — 7-day overview across all exercises) ──

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
