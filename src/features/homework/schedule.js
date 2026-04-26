// Schedule block component — cadence, days, times, duration

const T = (k, p) => window.HUD?.T?.(k, p) || k;

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
  // S1: normalize empty timeOfDay to 'morning'
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
  let summaryEl;

  function _pill(label, active, onclick) {
    const b = el('button', { class: 'hw2-pill' + (active ? ' active' : '') }, [label]);
    b.onclick = onclick;
    return b;
  }

  function _update(patch) { Object.assign(state, patch); onChange(state); _renderSummary(); }
  function _renderSummary() { if (summaryEl) summaryEl.textContent = '\ud83d\udcc5 ' + scheduleSummary(state); }

  // Cadence
  wrap.appendChild(el('div', { class: 'hw2-section-label' }, ['Cadence']));
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
  wrap.appendChild(cadRow);

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
  wrap.appendChild(daysWrap);

  // Times per day
  wrap.appendChild(el('div', { class: 'hw2-section-label' }, ['Times per day']));
  const timesRow = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' } });
  const selTimes = new Set((state.timeOfDay || 'morning').split(',').filter(Boolean));
  function _renderTimes() {
    timesRow.innerHTML = '';
    ['morning', 'afternoon', 'evening'].forEach(t => {
      timesRow.appendChild(_pill(t.charAt(0).toUpperCase() + t.slice(1), selTimes.has(t), () => {
        // S2: prevent deselecting last slot
        if (selTimes.has(t) && selTimes.size <= 1) return;
        if (selTimes.has(t)) selTimes.delete(t); else selTimes.add(t);
        _update({ timeOfDay: [...selTimes].join(',') });
        _renderTimes();
      }));
    });
  }
  wrap.appendChild(timesRow);
  // S3: updated helper text
  wrap.appendChild(el('div', { style: { fontSize: '12px', color: '#94a3b8', marginBottom: '12px' } }, ['Pick at least one time of day']));

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
  wrap.appendChild(durWrap);

  // Summary card
  summaryEl = el('div', { style: { padding: '10px 14px', background: '#f0fdf9', borderRadius: '8px', border: '1px solid #d1e0dd', fontSize: '13px', color: '#0d6b63', fontWeight: 500 } });
  wrap.appendChild(summaryEl);

  _renderCad(); _renderDays(); _renderTimes(); _renderDur(); _renderSummary();
  return wrap;
}
