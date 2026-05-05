// Parent homework view — Session B Sub-commit 2 of 3
// Bubble = name + meta line + day-box row.
// Day-box row generates per duration_type window rules + recurrence schedule;
// renders ✓ for fully-done days, teal ring for today, neutral for past/future.
// Auto-scroll polish lands in Sub-commit 3.

import { loadHomeworkForParent, loadCompletionsV2, isExerciseScheduledOn, exerciseSlotsOn } from './data.js';
import { mountCompleteModal } from './complete-modal.js';
import { injectHomeworkStyles } from './styles.js';

const T = (k, p) => window.HUD?.T?.(k, p) || k;
const _pad = n => String(n).padStart(2, '0');
const _fmtLocal = d => d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate());

// Module-local collapse state per specialist (per-session, not persisted)
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
  const childPart = (child?.avatar || '') + ' ' + (child?.name || '');
  const datePart = today.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  const subEl = el('p', { class: 'page-sub' });
  subEl.appendChild(document.createTextNode(childPart + ' · ' + datePart));
  headerWrap.appendChild(subEl);
  sec.appendChild(headerWrap);

  const host = el('div');
  host.appendChild(el('div', { style: { textAlign: 'center', padding: '24px', color: '#64748b' } }, [T('btn_loading')]));
  sec.appendChild(host);

  _loadAndRender(host, childId, isWeb, H);
  return sec;
}

async function _loadAndRender(host, childId, isWeb, H) {
  const { el } = H;

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [homeworks, completions] = await Promise.all([
    loadHomeworkForParent(childId),
    loadCompletionsV2(childId, ninetyDaysAgo),
  ]);

  const compMap = {};
  completions.forEach(c => {
    compMap[c.homework_exercise_id + ':' + c.scheduled_date + ':' + (c.slot || '')] = c;
  });

  host.innerHTML = '';

  if (!homeworks.length) {
    host.appendChild(el('div', { class: 'empty-state' }, [
      el('span', { class: 'empty-state-icon' }, ['📋']),
      el('div', { class: 'empty-state-title' }, [T('hw_no_tasks')]),
      el('div', { class: 'empty-state-body' }, [T('hw_no_tasks_parent_desc')]),
    ]));
    return;
  }

  const specGroups = _groupBySpecialist(homeworks, H);
  let renderedSections = 0;
  specGroups.forEach(group => {
    const section = _renderSpecialistSection(group, compMap, childId, isWeb, H);
    if (section) { host.appendChild(section); renderedSections++; }
  });

  if (renderedSections === 0) {
    host.appendChild(el('div', { class: 'empty-state', style: { marginTop: '12px' } }, [
      el('span', { class: 'empty-state-icon' }, ['📋']),
      el('div', { class: 'empty-state-title' }, ['No active homework right now']),
      el('div', { class: 'empty-state-body' }, [T('hw_no_tasks_parent_desc')]),
    ]));
  }
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

  // Build bubbles; if all return null (e.g., all paused), hide the section entirely
  const bubbles = homeworks.map(hw => _renderHomeworkBubble(hw, compMap, childId, isWeb, H)).filter(Boolean);
  if (bubbles.length === 0) return null;

  const section = el('div', { style: { marginBottom: '20px' } });

  const header = el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#f5fafa', borderRadius: '10px', cursor: 'pointer', userSelect: 'none', marginBottom: collapsed ? '0' : '10px', transition: 'margin-bottom .15s' } });
  const chevron = el('span', { style: { fontSize: '11px', color: '#4a7570', width: '14px', textAlign: 'center', flexShrink: '0' } }, [collapsed ? '▶' : '▼']);
  header.appendChild(chevron);
  const nameEl = el('span', { style: { flex: '1', fontWeight: 600, fontSize: '14px', color: '#0f1a18' } }, [specName + (specRole ? ' · ' + specRole : '')]);
  header.appendChild(nameEl);
  header.appendChild(el('span', { style: { fontSize: '12px', color: '#64748b', fontWeight: 500, flexShrink: '0' } }, [bubbles.length + ' active']));

  const body = el('div', { style: {
    display: collapsed ? 'none' : (isWeb && bubbles.length >= 4 ? 'grid' : 'flex'),
    gridTemplateColumns: isWeb && bubbles.length >= 4 ? 'repeat(auto-fit,minmax(380px,1fr))' : undefined,
    flexDirection: 'column',
    gap: '12px',
  } });

  header.onclick = () => {
    _collapseState[specId] = !_collapseState[specId];
    body.style.display = _collapseState[specId] ? 'none' : (isWeb && bubbles.length >= 4 ? 'grid' : 'flex');
    chevron.textContent = _collapseState[specId] ? '▶' : '▼';
    header.style.marginBottom = _collapseState[specId] ? '0' : '10px';
  };

  section.appendChild(header);
  bubbles.forEach(b => body.appendChild(b));
  section.appendChild(body);
  return section;
}

// Day-letter (Sun..Sat) for box label format "M 15"
const _DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const _dayBoxLabel = date => _DAY_LETTERS[date.getDay()] + ' ' + date.getDate();

// Strict 'allDone' semantic — day shows ✓ only when every scheduled slot has status='done'.
function _isDayDone(hw, date, compMap) {
  const dStr = _fmtLocal(date);
  let total = 0, done = 0;
  (hw.exercises || []).forEach(ex => {
    const slots = exerciseSlotsOn(hw, ex, date);
    slots.forEach(slot => {
      total++;
      if (compMap[ex.id + ':' + dStr + ':' + slot]?.status === 'done') done++;
    });
  });
  return total > 0 && done === total;
}

// Find next non-deleted appointment for this child + specialist (or null).
function _findNextAppointment(childId, specId, H) {
  const apts = H.DB?.appointments || [];
  const todayStr = _fmtLocal(new Date());
  const matching = apts
    .filter(a => a.childId === childId
              && (a.specialistId === specId || (a.sharedWith || []).includes(specId))
              && !a.deletedAt
              && a.date && a.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));
  return matching[0]?.date || null;
}

// Generate the visible day-box window per duration_type rules + recurrence schedule.
// Returns array of { date, dStr, isToday, isPast, isFuture, isAssigned } — only days
// where the homework is actually scheduled. Empty array means the bubble should hide.
function _generateDayBoxWindow(hw, today, nextApptDate) {
  // Once-off: always show its single day, regardless of window position (Q2 locked).
  if (hw.recurrence === 'once') {
    if (!hw.created_at) return [];
    const d = new Date(hw.created_at); d.setHours(0, 0, 0, 0);
    const dStr = _fmtLocal(d);
    return [{
      date: d,
      dStr,
      isToday: dStr === _fmtLocal(today),
      isPast: d < today,
      isFuture: d > today,
      isAssigned: true,
    }];
  }

  if (!hw.created_at) return [];
  const startDate = new Date(hw.created_at); startDate.setHours(0, 0, 0, 0);

  const SLIDING_BACK = 14;  // days
  const SLIDING_FWD = 7;    // days
  const dayMs = 86400000;
  const todayMs = today.getTime();
  const startMs = startDate.getTime();

  let windowStart, windowEnd;
  if (hw.duration_type === 'end_date' && hw.end_date) {
    const endDate = new Date(hw.end_date + 'T00:00:00'); endDate.setHours(0, 0, 0, 0);
    const periodDays = Math.round((endDate.getTime() - startMs) / dayMs);
    if (periodDays > SLIDING_BACK) {
      // Long period → sliding window, clamped to [startDate, endDate]
      windowStart = new Date(Math.max(startMs, todayMs - SLIDING_BACK * dayMs));
      windowEnd = new Date(Math.min(endDate.getTime(), todayMs + SLIDING_FWD * dayMs));
    } else {
      // Short period → show the full bounded period
      windowStart = startDate;
      windowEnd = endDate;
    }
  } else if (hw.duration_type === 'next_appointment') {
    if (nextApptDate) {
      const apptDate = new Date(nextApptDate + 'T00:00:00'); apptDate.setHours(0, 0, 0, 0);
      windowStart = new Date(Math.max(startMs, todayMs - SLIDING_BACK * dayMs));
      windowEnd = apptDate;
    } else {
      // No upcoming appointment → fall back to sliding window
      windowStart = new Date(Math.max(startMs, todayMs - SLIDING_BACK * dayMs));
      windowEnd = new Date(todayMs + SLIDING_FWD * dayMs);
    }
  } else {
    // 'open_ended' or unrecognized → sliding window
    windowStart = new Date(Math.max(startMs, todayMs - SLIDING_BACK * dayMs));
    windowEnd = new Date(todayMs + SLIDING_FWD * dayMs);
  }
  windowStart.setHours(0, 0, 0, 0);
  windowEnd.setHours(0, 0, 0, 0);

  if (windowEnd < windowStart) return [];

  const todayStr = _fmtLocal(today);
  const out = [];
  const cursor = new Date(windowStart);
  while (cursor <= windowEnd) {
    const isAssigned = (hw.exercises || []).some(ex => isExerciseScheduledOn(hw, ex, cursor));
    if (isAssigned) {
      const dCopy = new Date(cursor);
      const dStr = _fmtLocal(dCopy);
      out.push({
        date: dCopy,
        dStr,
        isToday: dStr === todayStr,
        isPast: dCopy < today,
        isFuture: dCopy > today,
        isAssigned: true,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

// Render a single day-box. State-based styling per Round 1 design rules.
function _renderDayBox(box, isDone, H, onTap) {
  const { el } = H;
  const { date, isToday } = box;

  let bg, color, border, content, fontSize, fontWeight;
  if (isDone) {
    // Completed: ✓ checkmark
    bg = 'transparent';
    color = '#0d9488';
    border = '1.5px solid #0d9488';
    content = '✓';
    fontSize = '15px';
    fontWeight = 700;
  } else if (isToday) {
    // Today (uncompleted): teal ring + "M 15" label
    bg = 'transparent';
    color = '#0d9488';
    border = '2px solid #0d9488';
    content = _dayBoxLabel(date);
    fontSize = '11px';
    fontWeight = 700;
  } else {
    // Past missed / future open: identical neutral state
    bg = 'transparent';
    color = '#7aaba5';
    border = '1px solid #e2e8f0';
    content = _dayBoxLabel(date);
    fontSize = '11px';
    fontWeight = 600;
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
      fontSize,
      fontWeight: String(fontWeight),
      textAlign: 'center',
      userSelect: 'none',
      WebkitTouchCallout: 'none',
      transition: 'transform .12s, border-color .12s',
    },
  });
  if (isToday) boxEl.dataset.today = '1';  // Sub-commit 3 uses this for auto-center
  boxEl.appendChild(document.createTextNode(content));
  boxEl.onclick = onTap;
  return boxEl;
}

// Render the horizontal scrollable row of day-boxes for a homework.
function _renderDayBoxRow(boxes, hw, compMap, childId, H) {
  const { el } = H;
  const row = el('div', {
    style: {
      display: 'flex',
      gap: '6px',
      overflowX: 'auto',
      overflowY: 'hidden',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      padding: '4px 2px',
      flex: '1 1 240px',
      minWidth: '0',
    },
  });
  // Hide webkit scrollbar (matches existing pattern from removed _renderDateStrip)
  row.style.cssText += ';-ms-overflow-style:none;';
  row.classList.add('hw-bubble-daybox-row');

  boxes.forEach(box => {
    const isDone = _isDayDone(hw, box.date, compMap);
    const boxEl = _renderDayBox(box, isDone, H, () => {
      console.log('[hw bubble] day-box tap:', { hw: hw.id, date: box.dStr, child: childId });
    });
    row.appendChild(boxEl);
  });

  // Position today's box at 70% from left of viewport on initial render.
  // True centering (50/50) hid past ✓ history on narrow desktop columns; 70% past-bias
  // surfaces completion history while keeping today + a sliver of future visible.
  // rAF fires after the row is mounted and laid out. No-op when content fits without scrolling.
  requestAnimationFrame(() => {
    try {
      const todayBox = row.querySelector('[data-today="1"]');
      if (todayBox && row.scrollWidth > row.clientWidth) {
        const PAST_BIAS_FRACTION = 0.7;
        const target = todayBox.offsetLeft - (row.clientWidth * PAST_BIAS_FRACTION) + (todayBox.offsetWidth / 2);
        row.scrollLeft = Math.max(0, target);
      }
    } catch (_) {}
  });

  // Translate vertical mouse wheel into horizontal scroll on desktop. Skips trackpad
  // horizontal swipes (deltaX !== 0 → native handles). Edge detection lets the page
  // scroll naturally when at row boundaries — never traps the user. Mobile touch
  // events don't fire here, so swipe behavior is unchanged.
  row.addEventListener('wheel', (e) => {
    if (e.deltaX !== 0) return;
    if (e.deltaY === 0) return;
    if (row.scrollWidth <= row.clientWidth) return;
    const max = row.scrollWidth - row.clientWidth;
    const atLeft = row.scrollLeft <= 0;
    const atRight = row.scrollLeft >= max;
    if ((e.deltaY < 0 && atLeft) || (e.deltaY > 0 && atRight)) return;
    e.preventDefault();
    row.scrollLeft = Math.max(0, Math.min(max, row.scrollLeft + e.deltaY));
  }, { passive: false });

  // Click-and-drag scroll for desktop. Mobile touch swipe is unaffected — touch
  // events don't fire mousedown/mousemove on most modern browsers.
  // Drag detection threshold (5px) distinguishes click-to-tap from drag-to-scroll:
  //   movement < 5px → click passes through to day-box tap handler
  //   movement ≥ 5px → drag, click suppressed via preventDefault + stopPropagation
  let isDragging = false;
  let dragStartX = 0;
  let dragStartScrollLeft = 0;
  let totalDragDistance = 0;
  const DRAG_THRESHOLD_PX = 5;

  row.style.cursor = 'grab';
  row.style.userSelect = 'none';

  row.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;  // left click only
    isDragging = true;
    dragStartX = e.pageX;
    dragStartScrollLeft = row.scrollLeft;
    totalDragDistance = 0;
    row.style.cursor = 'grabbing';
  });

  row.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const dx = e.pageX - dragStartX;
    totalDragDistance = Math.abs(dx);
    row.scrollLeft = dragStartScrollLeft - dx;
  });

  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    row.style.cursor = 'grab';
  };

  row.addEventListener('mouseup', (e) => {
    // If user dragged > threshold, suppress the click that would otherwise fire on the day-box
    if (totalDragDistance > DRAG_THRESHOLD_PX) {
      e.preventDefault();
      e.stopPropagation();
    }
    endDrag();
  });

  row.addEventListener('mouseleave', endDrag);

  return row;
}

function _renderHomeworkBubble(hw, compMap, childId, isWeb, H) {
  const { el } = H;

  // Paused homeworks completely hidden from active list (design doc §8.2)
  if (hw.is_paused) return null;

  const exercises = hw.exercises || [];

  // Generate the day-box window before constructing the bubble — if 0 boxes, skip entirely (Q3).
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const nextApptDate = hw.duration_type === 'next_appointment'
    ? _findNextAppointment(childId, hw.specialist_id, H)
    : null;
  const boxes = _generateDayBoxWindow(hw, today, nextApptDate);
  if (boxes.length === 0) return null;

  const bubble = el('div', { style: {
    background: '#fff',
    border: '1px solid #e8f4f2',
    borderRadius: '14px',
    padding: isWeb ? '20px' : '14px',
    boxShadow: '0 1px 3px rgba(13,148,136,.08),0 1px 2px rgba(0,0,0,.04)',
    transition: 'box-shadow .15s, border-color .15s',
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
  } });
  if (isWeb) {
    bubble.onmouseenter = () => { bubble.style.boxShadow = '0 4px 12px rgba(13,148,136,.10),0 2px 4px rgba(0,0,0,.06)'; bubble.style.borderColor = '#c4dbd8'; };
    bubble.onmouseleave = () => { bubble.style.boxShadow = '0 1px 3px rgba(13,148,136,.08),0 1px 2px rgba(0,0,0,.04)'; bubble.style.borderColor = '#e8f4f2'; };
  }

  // Left: name + meta line (tap → drill into today's exercises).
  // flex basis 200px + day-box row basis 240px → wraps below ~452px container width
  // (≤480px viewport stacks name on top, day-box row below; >480px side-by-side).
  const left = el('div', { style: { flex: '1 1 200px', minWidth: '0', cursor: 'pointer' } });
  left.appendChild(el('div', { style: { fontWeight: 600, fontSize: '15px', color: '#0f1a18', marginBottom: '2px' } }, [hw.title]));

  // Meta: "N exercises · <recurrence label>" — exercises first per design doc §4.2.
  // Recurrence labels reuse existing copy except 'once' which becomes 'one-time' (Q9 locked).
  const metaParts = [exercises.length + ' exercise' + (exercises.length !== 1 ? 's' : '')];
  const rec = hw.recurrence || 'daily';
  if (rec === 'daily') metaParts.push(T('hw4_daily'));
  else if (rec === 'specific_days') metaParts.push((hw.specific_days || []).map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(' · '));
  else if (rec === 'every_other_day') metaParts.push('Every other day');
  else if (rec === 'once') metaParts.push('one-time');
  else metaParts.push(rec);
  left.appendChild(el('div', { style: { fontSize: '12px', color: '#7aaba5', fontWeight: 500 } }, [metaParts.join(' · ')]));

  left.onclick = () => {
    console.log('[hw bubble] name tap → today:', { hw: hw.id, child: childId });
  };
  bubble.appendChild(left);

  // Right: day-box row (Sub-commit 2 — generation + rendering)
  bubble.appendChild(_renderDayBoxRow(boxes, hw, compMap, childId, H));

  return bubble;
}
