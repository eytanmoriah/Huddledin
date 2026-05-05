// Parent homework view — Session B Sub-commit 1 of 3
// Bubble shell with name + meta line + day-box row placeholder.
// Day-box generation lands in Sub-commit 2; auto-scroll polish in Sub-commit 3.
//
// Removed in this commit (Session 3.x and earlier): date strip, filter chips
// (All / Missed / Completed), per-exercise rows, week footer, once-off
// hide-on-mark cascade, missed/completed count helpers, _isHomeworkHidden.

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

// Sub-commit 1: bubble shell. Day-box row is a placeholder; Sub-commit 2 builds the real one.
function _renderHomeworkBubble(hw, compMap, childId, isWeb, H) {
  const { el } = H;

  // Paused homeworks completely hidden from active list (design doc §8.2)
  if (hw.is_paused) return null;

  const exercises = hw.exercises || [];

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
    alignItems: 'flex-start',
  } });
  if (isWeb) {
    bubble.onmouseenter = () => { bubble.style.boxShadow = '0 4px 12px rgba(13,148,136,.10),0 2px 4px rgba(0,0,0,.06)'; bubble.style.borderColor = '#c4dbd8'; };
    bubble.onmouseleave = () => { bubble.style.boxShadow = '0 1px 3px rgba(13,148,136,.08),0 1px 2px rgba(0,0,0,.04)'; bubble.style.borderColor = '#e8f4f2'; };
  }

  // Left: name + meta line (tap → drill into today's exercises)
  const left = el('div', { style: { flex: '1 1 160px', minWidth: '0', cursor: 'pointer' } });
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

  // Right: day-box row placeholder (Sub-commit 2 replaces this with _renderDayBoxRow)
  const placeholder = el('div', { style: {
    minWidth: '160px',
    flexShrink: '0',
    fontSize: '11px',
    color: '#94a3b8',
    fontStyle: 'italic',
    alignSelf: 'center',
    padding: '6px 10px',
    border: '1px dashed #cbd5e1',
    borderRadius: '8px',
    background: '#f8fafc',
  } }, ['[day-box row — Sub-commit 2]']);
  bubble.appendChild(placeholder);

  return bubble;
}
