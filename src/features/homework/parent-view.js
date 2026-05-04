// Parent homework view — Phase 4 redesign
// Collapsible specialist sections, per-exercise status rows, week day-pills
// Sub-commit 3: date-strip nav + past-date marking

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

  const todayStr = _fmtLocal(new Date());
  // Backward-compat migration: S._hwMissedFilter (boolean) → S._hwActiveFilter (string)
  if (S && S._hwMissedFilter && !S._hwActiveFilter) {
    S._hwActiveFilter = 'missed';
  }
  if (S) delete S._hwMissedFilter;  // legacy key gone after first read
  // If active date or filter was set for a different child, clear them (avoids stale state across child switches)
  if (S && S._hwActiveDateForChild !== childId) {
    if (S._hwActiveDate) S._hwActiveDate = null;
    if (S._hwActiveFilter && S._hwActiveFilter !== 'all') S._hwActiveFilter = 'all';
    S._hwActiveDateForChild = null;
  }
  const activeDate = S?._hwActiveDate || todayStr;
  const isViewingPast = activeDate !== todayStr;

  const headerWrap = el('div', { style: { marginBottom: '18px' } });
  headerWrap.appendChild(el('h2', { class: 'page-title' }, [T('hw_title')]));

  const dateObj = isViewingPast ? new Date(activeDate + 'T12:00:00') : new Date();
  const childPart = (child?.avatar || '') + ' ' + (child?.name || '');
  const datePart = dateObj.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  const subPrefix = isViewingPast ? 'Viewing ' : '';
  const subEl = el('p', { class: 'page-sub' });
  subEl.appendChild(document.createTextNode(childPart + ' · ' + subPrefix + datePart));
  if (isViewingPast) {
    const link = el('span', { style: { color: '#0d9488', fontWeight: 600, cursor: 'pointer', marginInlineStart: '8px', textDecoration: 'underline' } }, ['Return to today']);
    link.onclick = () => { S._hwActiveDate = null; re(); };
    subEl.appendChild(link);
  }
  headerWrap.appendChild(subEl);
  sec.appendChild(headerWrap);

  const host = el('div');
  host.appendChild(el('div', { style: { textAlign: 'center', padding: '24px', color: '#64748b' } }, [T('btn_loading')]));
  sec.appendChild(host);

  _loadAndRender(host, childId, isWeb, H, activeDate);
  return sec;
}

async function _loadAndRender(host, childId, isWeb, H, activeDate) {
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
      el('div', { class: 'empty-state-body' }, [T('hw_no_tasks_parent_desc')])
    ]));
    return;
  }

  // Date strip — controls activeDate via S._hwActiveDate (scoped to current child)
  const strip = _renderDateStrip(homeworks, compMap, H, activeDate, (newDate) => {
    H.S._hwActiveDate = newDate;                                  // null = today
    H.S._hwActiveDateForChild = newDate ? childId : null;         // tag for cross-child clear
    H.re?.();
  });
  host.appendChild(strip);
  // Scroll today into view (right edge) after mount
  requestAnimationFrame(() => { try { strip.scrollLeft = strip.scrollWidth; } catch (_) {} });

  // Filter chip row (Session 3: All / Missed (N) / Completed (M))
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const todayStrLocal = _fmtLocal(todayDate);
  const isViewingToday = activeDate === todayStrLocal;
  const missedCount = _computeMissedCount(homeworks, compMap, todayDate);
  const completedCount = homeworks.filter(hw => _isHomeworkHidden(hw, todayDate, todayStrLocal)).length;
  // Auto-revert when active filter's count drops to 0 (no UX trap)
  let activeFilter = (H.S?._hwActiveFilter) || 'all';
  if (activeFilter === 'missed' && missedCount === 0) activeFilter = 'all';
  if (activeFilter === 'completed' && completedCount === 0) activeFilter = 'all';
  if (H.S) H.S._hwActiveFilter = activeFilter;

  if (missedCount > 0 || completedCount > 0) {
    host.appendChild(_renderFilterChips({ missedCount, completedCount, activeFilter, onChange: (newKey) => {
      H.S._hwActiveFilter = newKey;
      H.S._hwActiveDateForChild = childId;  // tag for cross-child clear alongside activeDate
      H.re?.();
    }, H }));
  }

  const specGroups = _groupBySpecialist(homeworks, H);
  let renderedSections = 0;
  specGroups.forEach(group => {
    const section = _renderSpecialistSection(group, compMap, childId, isWeb, H, activeDate, activeFilter, todayDate);
    if (section) { host.appendChild(section); renderedSections++; }
  });

  // Empty states — branch on filter and view context
  if (renderedSections === 0) {
    if (activeFilter === 'all' && isViewingToday) {
      // All view, today, all hidden (or no active homeworks at all)
      const empty = el('div', { class: 'empty-state', style: { marginTop: '12px' } });
      empty.appendChild(el('span', { class: 'empty-state-icon' }, ['📋']));
      empty.appendChild(el('div', { class: 'empty-state-title' }, ['No active homework right now']));
      if (completedCount > 0) {
        const link = el('div', {
          style: { color: '#0d9488', fontWeight: 600, marginTop: '12px', cursor: 'pointer', textDecoration: 'underline' }
        }, ['View completed (' + completedCount + ')']);
        link.onclick = () => { H.S._hwActiveFilter = 'completed'; H.S._hwActiveDateForChild = childId; H.re?.(); };
        empty.appendChild(link);
      } else {
        empty.appendChild(el('div', { class: 'empty-state-body' }, [T('hw_no_tasks_parent_desc')]));
      }
      host.appendChild(empty);
    } else if (activeFilter === 'all' && !isViewingToday) {
      // All view, past date, no homework was active that day
      const empty = el('div', { class: 'empty-state', style: { marginTop: '12px' } });
      empty.appendChild(el('span', { class: 'empty-state-icon' }, ['📅']));
      empty.appendChild(el('div', { class: 'empty-state-title' }, ['No homework was active on ' + new Date(activeDate + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })]));
      const link = el('div', {
        style: { color: '#0d9488', fontWeight: 600, marginTop: '12px', cursor: 'pointer', textDecoration: 'underline' }
      }, ['Return to today']);
      link.onclick = () => { H.S._hwActiveDate = null; H.re?.(); };
      empty.appendChild(link);
      host.appendChild(empty);
    } else {
      // Missed / Completed views shouldn't render empty (auto-revert handles it), but defensive fallback
      host.appendChild(el('div', { class: 'empty-state', style: { marginTop: '12px' } }, [
        el('span', { class: 'empty-state-icon' }, ['📋']),
        el('div', { class: 'empty-state-title' }, ['Nothing to show']),
      ]));
    }
  }
}

function _renderDateStrip(homeworks, compMap, H, activeDate, onSelect) {
  const { el } = H;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = _fmtLocal(today);
  const daysBack = window.innerWidth >= 768 ? 14 : 30;

  const strip = el('div', { style: {
    display: 'flex', gap: '6px', overflowX: 'auto',
    padding: '4px 2px 12px', marginBottom: '12px',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
  } });
  // Hide webkit scrollbar
  strip.style.cssText += ';-ms-overflow-style:none;';

  const dates = [];
  for (let i = daysBack; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    dates.push(d);
  }

  dates.forEach(d => {
    const dStr = _fmtLocal(d);
    const isToday = dStr === todayStr;
    const isFuture = d > today;
    const isActive = activeDate === dStr;
    const dot = _aggregateDayState(homeworks, d, compMap, today);

    const pill = el('div', { style: {
      flexShrink: '0', width: '56px', height: '64px',
      borderRadius: '12px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      cursor: isFuture ? 'default' : 'pointer',
      background: (isActive && isToday) ? '#0d9488' : (isActive ? '#fff' : (isFuture ? 'transparent' : '#f5fafa')),
      color: (isActive && isToday) ? '#fff' : (isFuture ? '#cbd5e1' : '#0f1a18'),
      border: (isActive && !isToday) ? '2px solid #0d9488' : (isFuture ? '1px dashed #e2e8f0' : '1px solid transparent'),
      opacity: isFuture ? '0.5' : '1',
      transition: 'all .12s',
      userSelect: 'none',
      WebkitTouchCallout: 'none',
    } });
    pill.appendChild(el('div', { style: { fontSize: '10px', fontWeight: 600, opacity: '0.8' } }, [d.toLocaleDateString([], { weekday: 'short' })]));
    pill.appendChild(el('div', { style: { fontSize: '15px', fontWeight: 700, marginTop: '2px' } }, [String(d.getDate())]));
    const dotEl = el('div', { style: { width: '6px', height: '6px', borderRadius: '50%', marginTop: '4px', background: dot || 'transparent' } });
    pill.appendChild(dotEl);

    if (!isFuture) {
      pill.onclick = () => onSelect(isToday ? null : dStr);
    }
    strip.appendChild(pill);
  });

  return strip;
}

function _aggregateDayState(homeworks, date, compMap, today) {
  const dStr = _fmtLocal(date);
  let totalSlots = 0, completedSlots = 0;
  (homeworks || []).forEach(hw => {
    (hw.exercises || []).forEach(ex => {
      const slots = exerciseSlotsOn(hw, ex, date);
      slots.forEach(slot => {
        totalSlots++;
        if (compMap[ex.id + ':' + dStr + ':' + slot]) completedSlots++;
      });
    });
  });
  if (totalSlots === 0) return null;
  if (completedSlots === totalSlots) return '#10b981';   // green: all done
  if (date < today) return '#f59e0b';                    // amber: missed past
  return null;                                            // today partial → no dot
}

// Count past-scheduled slots that have no completion within the 90-day lookback.
// Strictly past (i = 1..90); today's unmarked exercises are pending, not missed.
function _computeMissedCount(homeworks, compMap, today) {
  let count = 0;
  for (let i = 1; i <= 90; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const dStr = _fmtLocal(d);
    (homeworks || []).forEach(hw => {
      (hw.exercises || []).forEach(ex => {
        const slots = exerciseSlotsOn(hw, ex, d);
        slots.forEach(slot => {
          if (!compMap[ex.id + ':' + dStr + ':' + slot]) count++;
        });
      });
    });
  }
  return count;
}

function _exerciseHasMissedPastSlot(hw, ex, compMap, today) {
  for (let i = 1; i <= 90; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const dStr = _fmtLocal(d);
    const slots = exerciseSlotsOn(hw, ex, d);
    for (const slot of slots) {
      if (!compMap[ex.id + ':' + dStr + ':' + slot]) return true;
    }
  }
  return false;
}

// Session 3: hide expired/completed homework from parent's All today view.
// Returns true when the homework belongs in the Completed bucket.
// Paused homeworks intentionally NOT counted as completed (different semantics);
// they cascade to empty-card hide via isExerciseScheduledOn returning false.
function _isHomeworkHidden(hw, today, todayStr) {
  if (hw.is_paused) return false;

  // Rule 1: end_date passed (only honored when duration_type === 'end_date').
  // hw.end_date < todayStr means strictly less than → today === end_date is still active (last day).
  if (hw.duration_type === 'end_date' && hw.end_date && hw.end_date < todayStr) return true;

  // Rule 2: Once-only homework with created_at older than 2 days (grace period for retro-marking).
  // 'once' uses created_at as the schedule date — no separate scheduled_date column.
  if (hw.recurrence === 'once' && hw.created_at) {
    const createdDateStr = _fmtLocal(new Date(hw.created_at));
    const buffer = new Date(today); buffer.setDate(buffer.getDate() - 2);
    if (createdDateStr < _fmtLocal(buffer)) return true;
  }

  return false;
}

function _renderFilterChips({ missedCount, completedCount, activeFilter, onChange, H }) {
  const { el } = H;
  const row = el('div', { style: { display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' } });

  const chip = (key, label, baseColor, baseBorder) => {
    const isActive = activeFilter === key;
    const c = el('button', { style: {
      padding: '6px 14px', borderRadius: '99px',
      border: '1.5px solid ' + (isActive ? baseColor : baseBorder),
      background: isActive ? baseColor : '#fff',
      color: isActive ? '#fff' : baseColor,
      fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
      transition: 'all .12s',
      userSelect: 'none',
      WebkitTouchCallout: 'none',
    } }, [label]);
    c.onclick = () => { if (!isActive) onChange(key); };
    return c;
  };

  row.appendChild(chip('all', 'All', '#0d9488', '#e2e8f0'));
  if (missedCount > 0) row.appendChild(chip('missed', 'Missed (' + missedCount + ')', '#d97706', '#fde68a'));
  if (completedCount > 0) row.appendChild(chip('completed', 'Completed (' + completedCount + ')', '#64748b', '#cbd5e1'));
  return row;
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

function _renderSpecialistSection(group, compMap, childId, isWeb, H, activeDate, activeFilter, today) {
  const { el } = H;
  const { specId, specName, specRole, homeworks } = group;
  const collapsed = _collapseState[specId] || false;

  // Build cards first; if all are empty for activeDate, hide the entire section
  const cards = homeworks.map(hw => _renderHomeworkCard(hw, compMap, childId, isWeb, H, activeDate, activeFilter, today)).filter(Boolean);
  if (cards.length === 0) return null;

  const section = el('div', { style: { marginBottom: '20px' } });

  // Header
  const header = el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#f5fafa', borderRadius: '10px', cursor: 'pointer', userSelect: 'none', marginBottom: collapsed ? '0' : '10px', transition: 'margin-bottom .15s' } });
  const chevron = el('span', { style: { fontSize: '11px', color: '#4a7570', width: '14px', textAlign: 'center', flexShrink: '0' } }, [collapsed ? '▶' : '▼']);
  header.appendChild(chevron);
  const nameEl = el('span', { style: { flex: '1', fontWeight: 600, fontSize: '14px', color: '#0f1a18' } }, [specName + (specRole ? ' · ' + specRole : '')]);
  header.appendChild(nameEl);
  header.appendChild(el('span', { style: { fontSize: '12px', color: '#64748b', fontWeight: 500, flexShrink: '0' } }, [cards.length + (cards.length === homeworks.length ? ' active' : ' shown')]));

  const body = el('div', { style: {
    display: collapsed ? 'none' : (isWeb && cards.length >= 4 ? 'grid' : 'flex'),
    gridTemplateColumns: isWeb && cards.length >= 4 ? 'repeat(auto-fit,minmax(380px,1fr))' : undefined,
    flexDirection: 'column',
    gap: '12px',
  } });

  header.onclick = () => {
    _collapseState[specId] = !_collapseState[specId];
    body.style.display = _collapseState[specId] ? 'none' : (isWeb && cards.length >= 4 ? 'grid' : 'flex');
    chevron.textContent = _collapseState[specId] ? '▶' : '▼';
    header.style.marginBottom = _collapseState[specId] ? '0' : '10px';
  };

  section.appendChild(header);
  cards.forEach(c => body.appendChild(c));
  section.appendChild(body);
  return section;
}

function _renderHomeworkCard(hw, compMap, childId, isWeb, H, activeDate, activeFilter, today) {
  const { el } = H;
  let exercises = hw.exercises || [];
  const todayStr = today ? _fmtLocal(today) : null;
  const isViewingToday = todayStr && activeDate === todayStr;
  const isHidden = today && todayStr ? _isHomeworkHidden(hw, today, todayStr) : false;

  // Filter dispatch
  if (activeFilter === 'completed') {
    // Completed view shows ONLY hidden homeworks (excludes paused — _isHomeworkHidden gates that)
    if (!isHidden) return null;
  } else if (activeFilter === 'missed') {
    // Missed view: card must contain at least one exercise with a past missed slot
    exercises = exercises.filter(ex => _exerciseHasMissedPastSlot(hw, ex, compMap, today));
    if (exercises.length === 0) return null;
  } else {
    // 'all' view: hide expired/once-past-buffer when viewing today.
    // For past activeDate, no hide — empty-card cascade handles "wasn't active that day".
    if (isViewingToday && isHidden) return null;
  }

  // Build exercise rows; if all are null (none scheduled on activeDate), hide the card
  const rows = exercises.map(ex => _renderExerciseRow(hw, ex, compMap, childId, H, activeDate)).filter(Boolean);
  if (rows.length === 0) return null;

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
  else if (rec === 'specific_days') schedParts.push((hw.specific_days || []).map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(' · '));
  else if (rec === 'every_other_day') schedParts.push('Every other day');
  else if (rec === 'once') schedParts.push('Once');
  else schedParts.push(rec);
  schedParts.push(exercises.length + ' exercise' + (exercises.length !== 1 ? 's' : ''));
  hdrLeft.appendChild(el('div', { style: { fontSize: '12px', color: '#7aaba5', fontWeight: 500 } }, [schedParts.join(' · ')]));
  hdr.appendChild(hdrLeft);
  const kebab = el('button', { style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#94a3b8', padding: '4px 6px', borderRadius: '6px', lineHeight: '1' } }, ['⋯']);
  kebab.onclick = (e) => e.stopPropagation();
  hdr.appendChild(kebab);
  card.appendChild(hdr);

  if (hw.description) {
    card.appendChild(el('div', { style: { fontSize: '13px', color: '#475569', lineHeight: '1.5', whiteSpace: 'pre-wrap', padding: '10px 12px', background: '#f0fdf9', borderRadius: '8px', marginBottom: '8px' } }, [hw.description]));
  }

  rows.forEach(row => card.appendChild(row));

  // Week footer (display-only, always shows current week regardless of activeDate)
  card.appendChild(_renderWeekFooter(hw, compMap, el));

  return card;
}

function _renderExerciseRow(hw, ex, compMap, childId, H, activeDate) {
  const { el } = H;
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const todayStr = _fmtLocal(todayDate);
  const activeDateStr = activeDate || todayStr;
  const activeDateObj = new Date(activeDateStr + 'T12:00:00');
  const isToday = activeDateStr === todayStr;
  const isPast = activeDateObj < todayDate;

  const slots = exerciseSlotsOn(hw, ex, activeDateObj);
  const scheduledOn = slots.length > 0;

  // Past dates: hide rows for exercises that weren't scheduled that day
  if (!isToday && !scheduledOn) return null;

  let doneCount = 0, cantDoCount = 0, skippedCount = 0;
  slots.forEach(slot => {
    const comp = compMap[ex.id + ':' + activeDateStr + ':' + slot];
    if (comp?.status === 'done') doneCount++;
    else if (comp?.status === 'cant_do') cantDoCount++;
    else if (comp?.status === 'skipped') skippedCount++;
  });

  const allDone = scheduledOn && doneCount === slots.length;
  const hasCantDo = cantDoCount > 0;
  const hasSkipped = skippedCount > 0 && doneCount === 0 && cantDoCount === 0;
  const hasAnyCompletion = doneCount > 0 || cantDoCount > 0 || skippedCount > 0;
  // Past-scheduled-but-unmarked: surface "Missed" cue
  const isMissedPast = isPast && scheduledOn && !hasAnyCompletion;

  // Status icon
  let iconText, iconBg, iconColor;
  if (!scheduledOn) { iconText = '○'; iconBg = 'transparent'; iconColor = '#c4dbd8'; }
  else if (allDone) { iconText = '✓'; iconBg = '#0d9488'; iconColor = '#fff'; }
  else if (hasCantDo) { iconText = '⚠'; iconBg = '#fef3c7'; iconColor = '#d97706'; }
  else if (hasSkipped) { iconText = '—'; iconBg = '#f1f5f9'; iconColor = '#94a3b8'; }
  else if (slots.length > 1 && doneCount > 0) { iconText = doneCount + '/' + slots.length; iconBg = '#E1F5EE'; iconColor = '#0d9488'; }
  else if (isMissedPast) { iconText = '○'; iconBg = '#fef3c7'; iconColor = '#d97706'; }
  else { iconText = '○'; iconBg = '#E1F5EE'; iconColor = '#0d9488'; }

  // Row background
  let rowBg, rowBorder;
  if (!scheduledOn) { rowBg = 'transparent'; rowBorder = 'transparent'; }
  else if (allDone) { rowBg = '#E1F5EE'; rowBorder = 'rgba(13,148,136,.25)'; }
  else if (hasCantDo) { rowBg = '#FAEEDA'; rowBorder = 'rgba(217,119,6,.25)'; }
  else if (hasSkipped) { rowBg = '#f8fafc'; rowBorder = '#e2e8f0'; }
  else if (isMissedPast) { rowBg = '#fffbeb'; rowBorder = '#fde68a'; }
  else { rowBg = '#E1F5EE'; rowBorder = 'rgba(13,148,136,.25)'; }

  // Right label
  let rightLabel = '', rightColor = '#64748b';
  if (!scheduledOn) { rightLabel = _nextScheduledDay(hw, ex, todayDate); rightColor = '#94a3b8'; }
  else if (allDone) { rightLabel = T('hw4_done'); rightColor = '#059669'; }
  else if (hasCantDo) { rightLabel = T('hw4_cant_do'); rightColor = '#d97706'; }
  else if (hasSkipped) { rightLabel = T('hw4_skipped'); rightColor = '#94a3b8'; }
  else if (isMissedPast) { rightLabel = 'Missed'; rightColor = '#d97706'; }

  const interactive = scheduledOn;

  // Edit-mode lookup: single-slot exercises with an existing completion → edit
  let existingCompletion = null;
  if (interactive && slots.length === 1) {
    existingCompletion = compMap[ex.id + ':' + activeDateStr + ':' + slots[0]] || null;
  }

  const row = el('div', { style: {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
    background: rowBg, border: '0.5px solid ' + rowBorder, borderRadius: '8px',
    marginBottom: '5px', cursor: interactive ? 'pointer' : 'default',
    opacity: !scheduledOn ? '0.55' : (allDone ? '0.65' : '1'),
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
  content.appendChild(el('div', { style: { fontWeight: 500, fontSize: '13px', color: !scheduledOn ? '#94a3b8' : '#0f1a18', textDecoration: allDone ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, [ex.title]));
  const subParts = [];
  if (scheduledOn && slots.length === 1) subParts.push(slots[0].charAt(0).toUpperCase() + slots[0].slice(1));
  else if (scheduledOn && slots.length > 1) subParts.push(slots.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' + '));
  const measure = (ex.sets && ex.reps) ? ex.sets + '×' + ex.reps + ' reps' : ex.duration_seconds ? Math.round(ex.duration_seconds / 60) + ' min' : '';
  if (measure) subParts.push(measure);
  if (isToday && !scheduledOn && !measure) subParts.push('Not today');
  const attachCount = Math.max((ex.attached_file_paths || []).length, (ex.attached_file_urls || []).length);
  if (attachCount > 0) subParts.push('📎 ' + attachCount);
  if (subParts.length) content.appendChild(el('div', { style: { fontSize: '11px', color: '#94a3b8', marginTop: '1px' } }, [subParts.join(' · ')]));
  if (ex.instructions) content.appendChild(el('div', { style: { fontSize: '12px', color: '#64748b', lineHeight: '1.4', whiteSpace: 'pre-wrap', marginTop: '3px' } }, [ex.instructions]));
  row.appendChild(content);

  // Right label
  if (rightLabel) row.appendChild(el('span', { style: { fontSize: '11px', fontWeight: 600, color: rightColor, flexShrink: '0' } }, [rightLabel]));

  if (interactive) {
    row.onclick = () => {
      mountCompleteModal({
        homework: hw, exercise: ex,
        slot: slots.length === 1 ? slots[0] : null,
        scheduledDate: activeDateStr,
        childId,
        existingCompletion,
        onSaved: () => H.re?.(),
      });
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
