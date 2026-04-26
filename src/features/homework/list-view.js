// Specialist homework list view — Phase 3a
// Replaces v1 renderHomeworkSpec. Reads homework_tasks + homework_exercises.

import { loadHomeworksForChild, computeWeekStats } from './data.js';
import { scheduleSummary } from './schedule.js';
import { injectHomeworkStyles } from './styles.js';

const T = (k, p) => window.HUD?.T?.(k, p) || k;

export function renderHomeworkSpecList({ childId, isWeb }) {
  injectHomeworkStyles();
  const H = window.HUD || {};
  const { el, mkBtn, toast, openConfirm, _supa, re, DB, S } = H;
  const child = DB?.children?.find(c => c.id === childId);
  const isRemoved = (child?.connectionStatus || 'approved') === 'removed';

  const sec = el('div', { class: 'section' });

  // Back bar (mobile only)
  if (H.session?.role === 'specialist' && !isWeb) {
    const backBar = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' } });
    const backBtn = el('button', { style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--teal)', fontWeight: 600, fontSize: '.84rem', fontFamily: 'inherit', padding: '4px 0' } }, ['\u2190 ' + (child?.name || 'Back')]);
    backBtn.onclick = () => { S.activeTab = 'patient-detail'; re(); };
    backBar.appendChild(backBtn);
    sec.appendChild(backBar);
  }

  // Header
  const hd = el('div', { class: 'sec-hd' });
  hd.appendChild(el('div', { class: 'sec-hd-left' }, [
    el('h2', { class: 'page-title' }, [T('hw_title')]),
    el('p', { class: 'page-sub' }, [(child?.avatar || '') + ' ' + (child?.name || '') + T('hw_spec_tasks_sub')])
  ]));
  if (!isRemoved) {
    const btns = el('div', { class: 'sec-hd-right', style: { display: 'flex', gap: '8px' } });
    btns.appendChild(mkBtn(T('hw2_templates_btn'), 'btn-md btn-ghost', () => window.HUD_HOMEWORK.openTemplatePicker({
      onPick: (tmpl) => window.HUD_HOMEWORK.mountHomeworkCreateModal({ childId, template: tmpl }),
      onCancel: () => {}
    })));
    btns.appendChild(mkBtn(T('hw_new_homework'), 'btn-md btn-primary', () => window.HUD_HOMEWORK.mountHomeworkCreateModal({ childId })));
    hd.appendChild(btns);
  }
  sec.appendChild(hd);

  // Lock message if removed
  if (isRemoved) {
    const lock = el('div', { style: { background: '#f1f5f9', border: '1.5px solid #cbd5e1', borderRadius: '14px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', color: '#475569' } });
    lock.appendChild(el('span', { style: { fontSize: '1.1rem' } }, ['\ud83d\udd12']));
    lock.appendChild(el('div', { style: { fontSize: '.83rem', fontWeight: 600 } }, [T('hw_not_connected_no_tasks')]));
    sec.appendChild(lock);
    return sec;
  }

  // Loading state
  const listHost = el('div');
  listHost.appendChild(el('div', { style: { textAlign: 'center', padding: '24px', color: '#64748b' } }, [T('btn_loading')]));
  sec.appendChild(listHost);

  // Async load
  _loadAndRender(listHost, childId, isWeb, { el, mkBtn, toast, openConfirm, _supa, re, DB, S });

  return sec;
}

async function _loadAndRender(host, childId, isWeb, H) {
  const { el, mkBtn, toast, openConfirm, _supa, re, DB, S } = H;
  const tab = S._hwSpecTab || 'active';
  const includeArchived = tab === 'archive';

  const homeworks = await loadHomeworksForChild(childId, true);
  const occurrences = DB?.homeworkOccurrences || [];
  const stats = computeWeekStats(homeworks, occurrences);

  const active = homeworks.filter(h => h.status === 'active');
  const archived = homeworks.filter(h => h.status === 'archived');

  host.innerHTML = '';

  // Filter tabs
  const tabBar = el('div', { style: { display: 'flex', gap: '8px', marginBottom: '18px' } });
  [['active', T('hw_active'), active.length], ['archive', T('hw_archived'), archived.length]].forEach(([key, label, cnt]) => {
    const isAct = tab === key;
    const btn = el('button', { class: isAct ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost' }, [label]);
    btn.appendChild(el('span', { class: 'patient-count-badge' }, [String(cnt)]));
    btn.onclick = () => { S._hwSpecTab = key; re(); };
    tabBar.appendChild(btn);
  });
  host.appendChild(tabBar);

  const tasks = tab === 'active' ? active : archived;

  // Empty state
  if (!tasks.length) {
    host.appendChild(el('div', { class: 'empty-state' }, [
      el('span', { class: 'empty-state-icon' }, ['\ud83d\udccb']),
      el('div', { class: 'empty-state-title' }, [tab === 'active' ? T('hw_no_tasks') : T('hw_archived')]),
      el('div', { class: 'empty-state-body' }, [tab === 'active' ? T('hw_no_tasks_spec_desc') : T('hw3_no_archived')])
    ]));
    return;
  }

  // Pinned / rest split
  const pinned = tasks.filter(t => t.is_pinned);
  const rest = tasks.filter(t => !t.is_pinned);

  if (pinned.length) {
    host.appendChild(el('div', { class: 'hw2-section-label' }, [T('hw_pinned_label')]));
    pinned.forEach(hw => host.appendChild(_renderCard(hw, stats[hw.id], isWeb, childId, H)));
    if (rest.length) host.appendChild(el('div', { class: 'hw2-section-label', style: { marginTop: '14px' } }, [T('hw_other_tasks')]));
  }
  rest.forEach(hw => host.appendChild(_renderCard(hw, stats[hw.id], isWeb, childId, H)));
}

function _renderCard(hw, weekStat, isWeb, childId, H) {
  const { el, mkBtn, toast, openConfirm, _supa, re, DB, S } = H;
  const isPinned = hw.is_pinned;
  const isPaused = hw.is_paused;
  const isArchived = hw.status === 'archived';
  const borderColor = isPinned ? '#f59e0b' : isPaused ? '#94a3b8' : '#0d9488';

  const card = el('div', { style: {
    background: '#fff',
    border: '1.5px solid #e2e8f0',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '12px',
    opacity: isArchived || isPaused ? '0.65' : '1',
    borderInlineStart: '4px solid ' + borderColor,
    cursor: 'pointer',
    transition: 'box-shadow .15s, border-color .15s',
  } });

  if (isWeb) {
    card.onmouseenter = () => { card.style.boxShadow = '0 4px 12px rgba(13,148,136,.1)'; card.style.borderColor = '#0d9488'; };
    card.onmouseleave = () => { card.style.boxShadow = ''; card.style.borderColor = '#e2e8f0'; };
  }

  // Top meta row: pinned pill + schedule summary
  const meta = el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' } });
  if (isPinned) meta.appendChild(el('span', { style: { fontSize: '10px', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '1px 8px', borderRadius: '99px' } }, ['\ud83d\udccc Pinned']));
  if (isPaused) meta.appendChild(el('span', { style: { fontSize: '10px', fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '1px 8px', borderRadius: '99px' } }, ['Paused']));
  const sched = scheduleSummary({
    recurrence: hw.recurrence, specificDays: hw.specific_days || [],
    timeOfDay: hw.time_of_day || 'morning', durationType: hw.duration_type,
    endDate: hw.end_date
  });
  meta.appendChild(el('span', { style: { fontSize: '11px', color: '#64748b', fontWeight: 500 } }, [sched]));
  card.appendChild(meta);

  // Title
  card.appendChild(el('div', { style: { fontWeight: 600, fontSize: isWeb ? '16px' : '15px', color: '#0f1a18', marginBottom: '8px' } }, [hw.title]));

  // Exercises inline
  const exercises = hw.exercises || [];
  if (exercises.length) {
    const exWrap = el('div', { style: {
      display: isWeb && exercises.length >= 4 ? 'grid' : 'flex',
      gridTemplateColumns: isWeb && exercises.length >= 4 ? '1fr 1fr' : undefined,
      flexDirection: 'column',
      gap: '3px',
      marginBottom: '8px',
    } });
    exercises.forEach(ex => {
      const row = el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155' } });
      row.appendChild(el('span', { style: { color: '#0d9488', fontSize: '8px', flexShrink: '0' } }, ['\u25cf']));
      row.appendChild(el('span', { style: { flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, [ex.title]));
      const measure = _measureLabel(ex);
      if (measure) row.appendChild(el('span', { style: { color: '#94a3b8', fontSize: '12px', flexShrink: '0' } }, [measure]));
      exWrap.appendChild(row);
    });
    card.appendChild(exWrap);
  }

  // Bottom row: week stat + actions
  const bottom = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } });

  const leftInfo = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b', fontWeight: 500 } });
  if (weekStat && weekStat.scheduled > 0) {
    leftInfo.appendChild(el('span', { style: { color: weekStat.done === weekStat.scheduled ? '#0d9488' : '#64748b' } },
      [T('hw3_week_stat', { done: weekStat.done, total: weekStat.scheduled })]));
  }
  bottom.appendChild(leftInfo);

  // Action buttons (stop propagation so card click doesn't fire)
  const acts = el('div', { style: { display: 'flex', gap: '4px', flexShrink: '0' } });
  acts.onclick = (e) => e.stopPropagation();

  acts.appendChild(_iconBtn('\u270f\ufe0f', 'Edit', () => {
    window.HUD_HOMEWORK.mountHomeworkCreateModal({ childId, homeworkId: hw.id });
  }));

  if (hw.status === 'active') {
    acts.appendChild(_iconBtn('\ud83d\uddc4', 'Archive', () => {
      openConfirm(T('hw3_archive_title'), T('hw3_archive_body'), false, async () => {
        const { error } = await _supa.from('homework_tasks').update({ status: 'archived' }).eq('id', hw.id);
        if (error) { toast('Could not archive.', 'error'); return; }
        re();
      });
    }));
  } else {
    acts.appendChild(_iconBtn('\u267b\ufe0f', 'Restore', () => {
      openConfirm(T('hw3_restore_title'), T('hw3_restore_body'), false, async () => {
        const { error } = await _supa.from('homework_tasks').update({ status: 'active' }).eq('id', hw.id);
        if (error) { toast('Could not restore.', 'error'); return; }
        re();
      });
    }));
  }

  acts.appendChild(_iconBtn('\ud83d\uddd1', 'Delete', () => {
    openConfirm(T('hw3_delete_title'), T('hw3_delete_body'), true, async () => {
      const { error } = await _supa.from('homework_tasks').update({ status: 'deleted' }).eq('id', hw.id);
      if (error) { toast('Could not delete.', 'error'); return; }
      re();
    });
  }));

  bottom.appendChild(acts);
  card.appendChild(bottom);

  // Card click → detail view (Phase 3b stub)
  card.onclick = () => { toast(T('hw3_detail_coming'), 'info'); };

  return card;
}

function _iconBtn(icon, title, onclick) {
  const b = document.createElement('button');
  b.textContent = icon;
  b.title = title;
  b.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;padding:4px;border-radius:6px;min-width:32px;min-height:32px;display:flex;align-items:center;justify-content:center;transition:background .12s;';
  b.onmouseenter = () => { b.style.background = '#f1f5f9'; };
  b.onmouseleave = () => { b.style.background = 'none'; };
  b.onclick = onclick;
  return b;
}

function _measureLabel(ex) {
  if (ex.sets && ex.reps) return ex.sets + '\u00d7' + ex.reps;
  if (ex.duration_seconds) return Math.round(ex.duration_seconds / 60) + ' min';
  if (ex.measure_unit) return ex.measure_unit;
  return '';
}
