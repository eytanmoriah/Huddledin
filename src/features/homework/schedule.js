// Schedule block component — frequency, days, times, duration
// Collapsed by default; summary card expands/collapses controls.

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function scheduleSummary(s) {
  const parts = [];
  if (s.recurrence === 'once') return 'Once';
  if (s.recurrence === 'daily') parts.push('Daily');
  else if (s.recurrence === 'every_other_day') parts.push('Every other day');
  else if (s.recurrence === 'specific_days' && s.specificDays?.length) {
    parts.push(s.specificDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', '));
  }
  const times = (s.timeOfDay || '').split(',').filter(Boolean);
  if (times.length) parts.push(times.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' + '));
  if (s.durationType === 'open_ended') parts.push('ongoing');
  else if (s.durationType === 'next_appointment') parts.push('until next session');
  else if (s.durationType === 'end_date' && s.endDate) parts.push('until ' + s.endDate);
  return parts.join(', ') || 'Daily, ongoing';
}

export function renderScheduleBlock(state, onChange) {
  if (!state.timeOfDay) { state.timeOfDay = 'morning'; onChange(state); }

  const el = (tag, attrs = {}, kids = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else e.setAttribute(k, v);
    }
    for (const c of kids) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return e;
  };

  const wrap = el('div');
  const selDays = new Set(state.specificDays || []);
  let expanded = false;
  let summaryEl, controlsEl;

  function _pill(label, active, onclick) {
    const b = el('button', { class: 'hw2-pill' + (active ? ' active' : '') }, [label]);
    b.onclick = onclick;
    return b;
  }

  function _update(patch) { Object.assign(state, patch); onChange(state); _renderSummary(); }
  function _renderSummary() {
    if (summaryEl) summaryEl.textContent = '\ud83d\udcc5 ' + scheduleSummary(state) + (expanded ? '' : ' \u2014 tap to customize');
  }

  // Summary card (always visible, toggles expand)
  summaryEl = el('div', { style: { padding: '10px 14px', background: '#f0fdf9', borderRadius: '8px', border: '1px solid #d1e0dd', fontSize: '13px', color: '#0d6b63', fontWeight: 500, cursor: 'pointer', transition: 'background .12s' } });
  summaryEl.onclick = () => { expanded = !expanded; controlsEl.style.display = expanded ? 'block' : 'none'; _renderSummary(); };
  wrap.appendChild(summaryEl);

  // Controls container (hidden by default)
  controlsEl = el('div', { style: { display: 'none', marginTop: '12px' } });

  // Frequency
  controlsEl.appendChild(el('div', { class: 'hw2-section-label' }, ['Frequency']));
  const cadRow = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' } });
  const cadOpts = [['daily', 'Daily'], ['specific_days', 'Some days'], ['once', 'Once'], ['every_other_day', 'Every other day']];
  function _renderCad() {
    cadRow.innerHTML = '';
    cadOpts.forEach(([val, label]) => {
      cadRow.appendChild(_pill(label, state.recurrence === val, () => {
        _update({ recurrence: val });
        _renderCad(); _renderDays(); _renderDur();
      }));
    });
  }
  controlsEl.appendChild(cadRow);

  // Weekday pills
  const daysWrap = el('div', { style: { marginBottom: '12px' } });
  function _renderDays() {
    daysWrap.innerHTML = '';
    if (state.recurrence !== 'specific_days') return;
    const row = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    DAY_KEYS.forEach((d, i) => {
      row.appendChild(_pill(DAY_LABELS[i], selDays.has(d), () => {
        if (selDays.has(d)) selDays.delete(d); else selDays.add(d);
        _update({ specificDays: [...selDays] });
        _renderDays();
      }));
    });
    daysWrap.appendChild(row);
  }
  controlsEl.appendChild(daysWrap);

  // Times per day
  controlsEl.appendChild(el('div', { class: 'hw2-section-label' }, ['Times per day']));
  const timesRow = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' } });
  const selTimes = new Set((state.timeOfDay || 'morning').split(',').filter(Boolean));
  function _renderTimes() {
    timesRow.innerHTML = '';
    ['morning', 'afternoon', 'evening'].forEach(t => {
      timesRow.appendChild(_pill(t.charAt(0).toUpperCase() + t.slice(1), selTimes.has(t), () => {
        if (selTimes.has(t) && selTimes.size <= 1) return;
        if (selTimes.has(t)) selTimes.delete(t); else selTimes.add(t);
        _update({ timeOfDay: [...selTimes].join(',') });
        _renderTimes();
      }));
    });
  }
  controlsEl.appendChild(timesRow);
  controlsEl.appendChild(el('div', { style: { fontSize: '12px', color: '#94a3b8', marginBottom: '12px' } }, ['Pick at least one time of day']));

  // Duration
  const durWrap = el('div', { style: { marginBottom: '12px' } });
  function _renderDur() {
    durWrap.innerHTML = '';
    if (state.recurrence === 'once') return;
    durWrap.appendChild(el('div', { class: 'hw2-section-label' }, ['Duration']));
    const row = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' } });
    [['open_ended', 'Ongoing'], ['next_appointment', 'Next session'], ['end_date', 'Specific date']].forEach(([val, label]) => {
      row.appendChild(_pill(label, state.durationType === val, () => {
        _update({ durationType: val }); _renderDur();
      }));
    });
    durWrap.appendChild(row);
    if (state.durationType === 'end_date') {
      const dateInp = el('input', { type: 'date', class: 'hw2-input', style: { maxWidth: '200px' } });
      dateInp.min = new Date().toISOString().split('T')[0];
      dateInp.value = state.endDate || '';
      dateInp.onchange = () => _update({ endDate: dateInp.value });
      durWrap.appendChild(dateInp);
    }
  }
  controlsEl.appendChild(durWrap);
  wrap.appendChild(controlsEl);

  _renderCad(); _renderDays(); _renderTimes(); _renderDur(); _renderSummary();
  return wrap;
}

// Mini schedule for per-exercise overrides
export function renderMiniSchedule(overrides, homeworkState, onChange) {
  const el = (tag, attrs = {}, kids = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else e.setAttribute(k, v);
    }
    for (const c of kids) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return e;
  };

  const wrap = el('div', { style: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px', marginTop: '8px' } });

  function _pill(label, active, onclick) {
    const b = el('button', { class: 'hw2-pill' + (active ? ' active' : '') }, [label]);
    b.style.fontSize = '12px'; b.style.padding = '5px 10px';
    b.onclick = onclick;
    return b;
  }

  // Mutable local state
  let rec = overrides.overrideRecurrence || homeworkState.recurrence || 'daily';
  const selDays = new Set(overrides.overrideSpecificDays || homeworkState.specificDays || []);
  const selTimes = new Set((overrides.overrideTimeOfDay || homeworkState.timeOfDay || 'morning').split(',').filter(Boolean));

  function _emit() {
    onChange({ overrideRecurrence: rec, overrideSpecificDays: rec === 'specific_days' ? [...selDays] : null, overrideTimeOfDay: [...selTimes].join(',') });
  }

  // Frequency
  wrap.appendChild(el('div', { style: { fontSize: '10px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '4px' } }, ['Frequency']));
  const cadRow = el('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' } });
  const cadBtns = {};
  [['daily', 'Daily'], ['specific_days', 'Some days'], ['once', 'Once'], ['every_other_day', 'Every other']].forEach(([val, label]) => {
    const btn = _pill(label, rec === val, () => {
      Object.values(cadBtns).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      rec = val;
      dayRow.style.display = val === 'specific_days' ? '' : 'none';
      _emit();
    });
    cadBtns[val] = btn;
    cadRow.appendChild(btn);
  });
  wrap.appendChild(cadRow);

  // Day-of-week row (visible only when rec === 'specific_days')
  const dayRow = el('div', { style: { display: rec === 'specific_days' ? 'flex' : 'none', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' } });
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].forEach((d, i) => {
    const btn = _pill(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i], selDays.has(d), () => {
      if (selDays.has(d)) { selDays.delete(d); btn.classList.remove('active'); }
      else { selDays.add(d); btn.classList.add('active'); }
      _emit();
    });
    dayRow.appendChild(btn);
  });
  wrap.appendChild(dayRow);

  // Times
  wrap.appendChild(el('div', { style: { fontSize: '10px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: '4px' } }, ['Times']));
  const timeRow = el('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } });
  ['morning', 'afternoon', 'evening'].forEach(t => {
    const btn = _pill(t.charAt(0).toUpperCase() + t.slice(1), selTimes.has(t), () => {
      if (selTimes.has(t) && selTimes.size <= 1) return;
      if (selTimes.has(t)) { selTimes.delete(t); btn.classList.remove('active'); }
      else { selTimes.add(t); btn.classList.add('active'); }
      _emit();
    });
    timeRow.appendChild(btn);
  });
  wrap.appendChild(timeRow);

  return wrap;
}
