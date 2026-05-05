// Parent homework view — Session C Sub-commit 2 of 5
// Routes between bubble list (Session B default) and drill-down screens via
// S._hwParentDrill = null | { childId, hwId, dateStr [, exerciseId [, status]] }.
// Sub-commits: 1 = exercise list, 2 = exercise detail (this), 3-4 = status + completion.
// Sub-commit 0 (3abe2de + a068e2d) added wheel + drag.

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

  // Cross-child guard: stale drill state from a different child auto-clears.
  if (S._hwParentDrill && S._hwParentDrill.childId !== childId) {
    S._hwParentDrill = null;
  }

  const drill = S?._hwParentDrill;
  const isDrilledIn = !!(drill && drill.hwId && drill.dateStr);

  const sec = el('div', { class: 'section' });

  if (isDrilledIn) {
    // Drill view header: back arrow only (no page title / child subtitle).
    // Back target depends on drill depth: exerciseId set → pop to exercise list; else → pop to bubble list.
    const backRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1.5px solid #e2e8f0' } });
    const backBtn = el('button', { style: { background: 'none', border: 'none', cursor: 'pointer', color: '#0d9488', fontWeight: 700, fontSize: '.84rem', fontFamily: 'inherit', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px', minHeight: '44px' } }, ['← Back']);
    backBtn.onclick = () => {
      const d = S._hwParentDrill;
      if (!d) return;
      if (d.status) {
        // Pop status only — return to exercise detail
        const { status, ...rest } = d;
        S._hwParentDrill = rest;
      } else if (d.exerciseId) {
        // Pop exerciseId — return to exercise list
        const { childId: c, hwId, dateStr } = d;
        S._hwParentDrill = { childId: c, hwId, dateStr };
      } else {
        // Pop drill entirely — return to bubble list
        S._hwParentDrill = null;
      }
      re();
    };
    backRow.appendChild(backBtn);
    sec.appendChild(backRow);
  } else {
    // Bubble list view header (Session B layout — unchanged).
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
  }

  const host = el('div');
  host.appendChild(el('div', { style: { textAlign: 'center', padding: '24px', color: '#64748b' } }, [T('btn_loading')]));
  sec.appendChild(host);

  _loadAndRender(host, childId, isWeb, H);
  return sec;
}

async function _loadAndRender(host, childId, isWeb, H) {
  const { el, re, S, toast } = H;

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

  // Drill view dispatch — runs before bubble-list path
  const drill = S?._hwParentDrill;
  if (drill && drill.hwId && drill.dateStr) {
    const hw = homeworks.find(h => h.id === drill.hwId);
    if (!hw) {
      // Stale drill state (homework archived/deleted by specialist mid-drill)
      S._hwParentDrill = null;
      toast?.('This homework was updated — returning to list');
      re();
      return;
    }
    if (drill.exerciseId && drill.status) {
      _renderDrillStatusPlaceholder(host, drill, hw, H);
    } else if (drill.exerciseId) {
      _renderDrillExerciseDetail(host, drill, hw, compMap, childId, isWeb, H);
    } else {
      _renderDrillExerciseList(host, drill, hw, compMap, H);
    }
    return;
  }

  // Bubble list view (Session B default)
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

// ── Drill-down helpers (Session C Sub-commit 1) ──

const _DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const _MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Today" when dateStr matches today; else "Weekday · Month Day".
function _formatDateChip(dateStr, todayStr) {
  if (dateStr === todayStr) return 'Today';
  const d = new Date(dateStr + 'T12:00:00');
  return _DAY_NAMES[d.getDay()] + ' · ' + _MONTH_NAMES[d.getMonth()] + ' ' + d.getDate();
}

// Exercise is "done for this day" if every scheduled slot on dateStr has status='done'.
function _isExerciseDoneOn(ex, hw, dateStr, compMap) {
  const date = new Date(dateStr + 'T12:00:00'); date.setHours(0, 0, 0, 0);
  const slots = exerciseSlotsOn(hw, ex, date);
  if (slots.length === 0) return false;
  return slots.every(slot => compMap[ex.id + ':' + dateStr + ':' + slot]?.status === 'done');
}

// Exercise-level progress: how many of the scheduled exercises that day are fully done.
function _computeExerciseProgress(hw, dateStr, compMap) {
  const date = new Date(dateStr + 'T12:00:00'); date.setHours(0, 0, 0, 0);
  let total = 0, done = 0;
  (hw.exercises || []).forEach(ex => {
    if (!isExerciseScheduledOn(hw, ex, date)) return;
    total++;
    if (_isExerciseDoneOn(ex, hw, dateStr, compMap)) done++;
  });
  return { total, done };
}

function _renderExerciseListRow(ex, hw, dateStr, compMap, onTap, H) {
  const { el } = H;
  const isDone = _isExerciseDoneOn(ex, hw, dateStr, compMap);

  const row = el('div', { style: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    background: '#fff',
    border: '1px solid #e8f4f2',
    borderRadius: '12px',
    marginBottom: '8px',
    cursor: 'pointer',
    transition: 'background .12s, border-color .12s',
    userSelect: 'none',
  } });
  row.onmouseenter = () => { row.style.background = '#f5fafa'; row.style.borderColor = '#c4dbd8'; };
  row.onmouseleave = () => { row.style.background = '#fff'; row.style.borderColor = '#e8f4f2'; };

  // Left indicator: ✓ if exercise fully done for this day, empty circle otherwise
  const indicator = el('div', { style: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    flexShrink: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: isDone ? '#0d9488' : 'transparent',
    color: '#fff',
    border: isDone ? 'none' : '1.5px solid #c4dbd8',
    fontSize: '14px',
    fontWeight: '700',
  } });
  if (isDone) indicator.textContent = '✓';
  row.appendChild(indicator);

  // Exercise name
  row.appendChild(el('div', { style: {
    flex: '1',
    fontSize: '14px',
    fontWeight: '500',
    color: '#0f1a18',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: '0',
  } }, [ex.title || 'Exercise']));

  // Right chevron
  row.appendChild(el('span', { style: { fontSize: '14px', color: '#94a3b8', flexShrink: '0' } }, ['›']));

  row.onclick = onTap;
  return row;
}

function _renderDrillExerciseList(host, drill, hw, compMap, H) {
  const { el, re, S } = H;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = _fmtLocal(today);

  // Date chip
  const chipWrap = el('div', { style: { marginBottom: '8px' } });
  chipWrap.appendChild(el('span', { style: {
    display: 'inline-block',
    padding: '6px 14px',
    borderRadius: '99px',
    background: '#f0fdf9',
    color: '#0d6b63',
    fontSize: '13px',
    fontWeight: '600',
    border: '1px solid #d1e0dd',
  } }, [_formatDateChip(drill.dateStr, todayStr)]));
  host.appendChild(chipWrap);

  // Homework title + progress
  const titleRow = el('div', { style: { marginBottom: '14px' } });
  titleRow.appendChild(el('div', { style: { fontSize: '17px', fontWeight: '600', color: '#0f1a18', marginBottom: '4px' } }, [hw.title]));
  const progress = _computeExerciseProgress(hw, drill.dateStr, compMap);
  if (progress.total > 0) {
    titleRow.appendChild(el('div', { style: { fontSize: '12px', color: '#7aaba5', fontWeight: '500' } },
      [progress.done + ' of ' + progress.total + ' done']));
  }
  host.appendChild(titleRow);

  // Exercise rows — only those scheduled on drill.dateStr
  const date = new Date(drill.dateStr + 'T12:00:00'); date.setHours(0, 0, 0, 0);
  const scheduled = (hw.exercises || []).filter(ex => isExerciseScheduledOn(hw, ex, date));

  if (scheduled.length === 0) {
    host.appendChild(el('div', { class: 'empty-state', style: { marginTop: '12px' } }, [
      el('span', { class: 'empty-state-icon' }, ['📋']),
      el('div', { class: 'empty-state-title' }, ['No exercises scheduled this day']),
    ]));
    return;
  }

  const list = el('div', {});
  scheduled.forEach(ex => {
    list.appendChild(_renderExerciseListRow(ex, hw, drill.dateStr, compMap, () => {
      S._hwParentDrill = { ...drill, exerciseId: ex.id };
      re();
    }, H));
  });
  host.appendChild(list);
}

// Helper: detect video by file extension on the attachment name.
function _isVideoFile(name) {
  return /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(name || '');
}

// Prev/next chevron row at top of exercise detail screen.
// Hides chevrons at boundaries (no wrap-around per design doc Round 6 Q11.2).
function _renderPrevNextChevrons(scheduledExercises, currentIdx, drill, H) {
  const { el, re, S } = H;
  const prevExId = currentIdx > 0 ? scheduledExercises[currentIdx - 1].id : null;
  const nextExId = currentIdx < scheduledExercises.length - 1 ? scheduledExercises[currentIdx + 1].id : null;

  const row = el('div', { style: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px',
  } });

  const chevronStyle = (enabled) => ({
    background: 'none',
    border: 'none',
    cursor: enabled ? 'pointer' : 'default',
    color: enabled ? '#0d9488' : '#cbd5e1',
    fontSize: '22px',
    fontWeight: '700',
    padding: '8px 14px',
    fontFamily: 'inherit',
    minHeight: '44px',
    minWidth: '44px',
    visibility: enabled ? 'visible' : 'hidden',
  });

  const prevBtn = el('button', { style: chevronStyle(!!prevExId) }, ['‹']);
  prevBtn.onclick = () => {
    if (!prevExId) return;
    S._hwParentDrill = { ...drill, exerciseId: prevExId };
    re();
  };
  row.appendChild(prevBtn);

  row.appendChild(el('span', { style: {
    fontSize: '12px',
    color: '#7aaba5',
    fontWeight: '500',
  } }, [(currentIdx + 1) + ' of ' + scheduledExercises.length]));

  const nextBtn = el('button', { style: chevronStyle(!!nextExId) }, ['›']);
  nextBtn.onclick = () => {
    if (!nextExId) return;
    S._hwParentDrill = { ...drill, exerciseId: nextExId };
    re();
  };
  row.appendChild(nextBtn);

  return row;
}

// Specialist metadata chips: reps, sets, duration, frequency.
function _renderDetailMetaChips(ex, hw, H) {
  const { el } = H;
  const chips = [];

  if (ex.reps && ex.sets) chips.push(ex.sets + '×' + ex.reps + ' reps');
  else if (ex.reps) chips.push(ex.reps + ' reps');

  if (ex.duration_seconds) {
    const m = Math.round(ex.duration_seconds / 60);
    chips.push(m >= 1 ? m + ' min' : ex.duration_seconds + ' sec');
  }

  const rec = hw.recurrence || 'daily';
  if (rec === 'daily') chips.push(T('hw4_daily'));
  else if (rec === 'specific_days') chips.push((hw.specific_days || []).map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(' · '));
  else if (rec === 'every_other_day') chips.push('Every other day');
  else if (rec === 'once') chips.push('one-time');

  if (chips.length === 0) return null;

  const wrap = el('div', { style: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginBottom: '16px',
  } });
  chips.forEach(c => {
    wrap.appendChild(el('span', { style: {
      padding: '4px 10px',
      borderRadius: '99px',
      background: '#f0fdf9',
      color: '#0d6b63',
      fontSize: '11px',
      fontWeight: '600',
      border: '1px solid #d1e0dd',
    } }, [c]));
  });
  return wrap;
}

// Media block with inline expansion: tap thumbnail → grow in place (image)
// or play in place (video). Tap again → collapse back.
function _renderDetailMediaBlock(ex, H) {
  const { el } = H;
  const paths = ex.attached_file_paths || [];
  const urls = ex.attached_file_urls || [];
  const names = ex.attached_file_names || [];
  const count = Math.max(paths.length, urls.length, names.length);
  if (count === 0) return null;

  const wrap = el('div', { style: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '20px',
  } });

  for (let i = 0; i < count; i++) {
    const path = paths[i] || null;
    const legacyUrl = urls[i] || null;
    const name = names[i] || ('Attachment ' + (i + 1));
    const isVideo = _isVideoFile(name);

    const item = el('div', { style: {
      borderRadius: '10px',
      overflow: 'hidden',
      cursor: 'pointer',
      background: '#f0fdf9',
      border: '1px solid #d1e0dd',
    } });

    let isExpanded = false;

    const resolveUrl = async () => {
      if (path) {
        try { const u = await H.SB?.signFile?.(path); if (u) return u; } catch (_) {}
      }
      return legacyUrl || null;
    };

    const renderCollapsed = () => {
      item.innerHTML = '';
      isExpanded = false;
      if (isVideo) {
        const thumb = el('div', { style: {
          height: '120px',
          background: '#1a2e2b',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          gap: '8px',
          fontWeight: '600',
        } });
        thumb.appendChild(document.createTextNode('▶  ' + name));
        item.appendChild(thumb);
      } else {
        const img = el('img', { style: {
          display: 'block',
          width: '100%',
          height: '160px',
          objectFit: 'cover',
        } });
        (async () => {
          const url = await resolveUrl();
          if (url) img.src = url;
        })();
        item.appendChild(img);
      }
    };

    const renderExpanded = async () => {
      const url = await resolveUrl();
      if (!url) return;
      item.innerHTML = '';
      isExpanded = true;
      if (isVideo) {
        const v = document.createElement('video');
        v.src = url;
        v.controls = true;
        v.autoplay = true;
        v.style.cssText = 'display:block;width:100%;max-height:60vh;background:#000;';
        item.appendChild(v);
      } else {
        const img = el('img', { src: url, style: {
          display: 'block',
          width: '100%',
          maxHeight: '60vh',
          objectFit: 'contain',
          background: '#1a2e2b',
        } });
        item.appendChild(img);
      }
    };

    renderCollapsed();
    item.onclick = () => {
      if (isExpanded) renderCollapsed();
      else renderExpanded();
    };

    wrap.appendChild(item);
  }

  return wrap;
}

// Exercise detail screen — design doc §4.4.
function _renderDrillExerciseDetail(host, drill, hw, compMap, childId, isWeb, H) {
  const { el, re, S, toast } = H;
  const ex = (hw.exercises || []).find(e => e.id === drill.exerciseId);

  if (!ex) {
    // Stale exercise (specialist removed it) — pop to exercise list
    const { childId: c, hwId, dateStr } = drill;
    S._hwParentDrill = { childId: c, hwId, dateStr };
    toast?.('This exercise was updated — returning to list');
    re();
    return;
  }

  const date = new Date(drill.dateStr + 'T12:00:00'); date.setHours(0, 0, 0, 0);

  // Prev/next chevrons (only render if more than one exercise scheduled that day)
  const scheduledExercises = (hw.exercises || [])
    .filter(e => isExerciseScheduledOn(hw, e, date))
    .sort((a, b) => (a.position || 0) - (b.position || 0));
  const currentIdx = scheduledExercises.findIndex(e => e.id === drill.exerciseId);
  if (currentIdx >= 0 && scheduledExercises.length > 1) {
    host.appendChild(_renderPrevNextChevrons(scheduledExercises, currentIdx, drill, H));
  }

  // Exercise title (small subheading)
  host.appendChild(el('div', { style: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#7aaba5',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    marginBottom: '8px',
  } }, [ex.title || 'Exercise']));

  // Big instruction text — primary visual element
  const instruction = ex.instructions || ex.title || 'Exercise';
  host.appendChild(el('div', { style: {
    fontSize: '17px',
    fontWeight: '500',
    color: '#0f1a18',
    lineHeight: '1.55',
    marginBottom: '16px',
    whiteSpace: 'pre-wrap',
  } }, [instruction]));

  // Metadata chips
  const chips = _renderDetailMetaChips(ex, hw, H);
  if (chips) host.appendChild(chips);

  // Media block
  const mediaBlock = _renderDetailMediaBlock(ex, H);
  if (mediaBlock) host.appendChild(mediaBlock);

  // CTA: "Complete it" if no completion exists for this exercise on this date,
  // "Edit completion" otherwise. Multi-slot: ANY slot's completion triggers edit mode.
  const slots = exerciseSlotsOn(hw, ex, date);
  const existingCompletion = slots
    .map(s => compMap[ex.id + ':' + drill.dateStr + ':' + (s || '')])
    .find(c => c);

  const cta = el('button', { style: {
    width: '100%',
    padding: '14px',
    border: 'none',
    borderRadius: '12px',
    background: '#0d9488',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: '8px',
  } }, [existingCompletion ? 'Edit completion' : 'Complete it']);
  cta.onclick = () => {
    S._hwParentDrill = { ...drill, status: '__pending_status__' };
    re();
  };
  host.appendChild(cta);
}

// Sub-commit 2 stub for the status screen — replaced in Sub-commit 3.
function _renderDrillStatusPlaceholder(host, drill, hw, H) {
  const { el } = H;
  const wrap = el('div', { style: {
    padding: '24px 16px',
    textAlign: 'center',
    color: '#64748b',
  } });
  wrap.appendChild(el('div', { style: { fontSize: '15px', fontWeight: '600', color: '#0f1a18', marginBottom: '8px' } },
    ['Status screen']));
  wrap.appendChild(el('div', { style: { fontSize: '13px', fontStyle: 'italic' } },
    ['Coming in next sub-commit (Session C Sub-commit 3 — status picker).']));
  host.appendChild(wrap);
}

// ── End drill-down helpers ──

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
      // Clamp future dates to today — parents shouldn't backfill forward.
      // The exercise list view's date chip will show "Today" so the redirect is visible.
      const todayStr = _fmtLocal(new Date());
      const effectiveDate = box.dStr > todayStr ? todayStr : box.dStr;
      H.S._hwParentDrill = { childId, hwId: hw.id, dateStr: effectiveDate };
      H.re?.();
    });
    row.appendChild(boxEl);
  });

  // Center today's box in the visible scroll viewport on initial render.
  // Uses getBoundingClientRect rather than offsetLeft because the row's offsetParent
  // is <body> (no positioned ancestor in the chain), so offsetLeft returned absolute
  // page-x coordinates and over-shot the scroll on long-history homeworks.
  // Double-rAF gives flex layout an extra frame to settle before measuring.
  // No-op when content fits without scrolling.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        const todayBox = row.querySelector('[data-today="1"]');
        if (!todayBox) return;
        if (row.scrollWidth <= row.clientWidth) return;
        const todayRect = todayBox.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const todayLeftInRow = todayRect.left - rowRect.left + row.scrollLeft;
        const target = todayLeftInRow + (todayRect.width / 2) - (row.clientWidth / 2);
        row.scrollLeft = Math.max(0, target);
      } catch (_) {}
    });
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
    H.S._hwParentDrill = { childId, hwId: hw.id, dateStr: _fmtLocal(new Date()) };
    H.re?.();
  };
  bubble.appendChild(left);

  // Right: day-box row (Sub-commit 2 — generation + rendering)
  bubble.appendChild(_renderDayBoxRow(boxes, hw, compMap, childId, H));

  return bubble;
}
