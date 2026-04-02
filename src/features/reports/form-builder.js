// Form Builder — renders dynamic form from selected sections

import { getSectionById } from './templates.js';

export function renderForm(sections, container, formData, childInfo, specialistInfo) {
  const { el } = window.HUD;

  // Admin section (always first, auto-filled)
  const adminCard = el('div', { class: 'rpt-form-section', style: { background: '#f0fdf9' } });
  adminCard.appendChild(el('div', { class: 'rpt-form-section-title' }, ['📋 Administrative Information']));
  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: '.8rem', color: '#475569', marginTop: '8px' } });
  grid.appendChild(el('div', {}, ['Patient: ' + (childInfo?.name || '—')]));
  grid.appendChild(el('div', {}, ['DOB: ' + (childInfo?.dob || '—')]));
  grid.appendChild(el('div', {}, ['Age: ' + (childInfo?.age || '—')]));
  grid.appendChild(el('div', {}, ['Date: ' + new Date().toISOString().split('T')[0]]));
  grid.appendChild(el('div', {}, ['Specialist: ' + (specialistInfo?.name || '—')]));
  grid.appendChild(el('div', {}, ['Specialty: ' + (specialistInfo?.specialty || '—')]));
  adminCard.appendChild(grid);
  container.appendChild(adminCard);

  // Render each selected section
  sections.forEach(secDef => {
    const sec = typeof secDef === 'string' ? getSectionById(secDef) : secDef;
    if (!sec) return;

    const card = el('div', { class: 'rpt-form-section' });
    card.appendChild(el('div', { class: 'rpt-form-section-title' }, [sec.title]));
    if (sec.description) card.appendChild(el('div', { class: 'rpt-form-section-desc' }, [sec.description]));

    (sec.fields || []).forEach(field => {
      const fKey = sec.id + '.' + field.id;
      const wrap = el('div', { style: { marginBottom: '12px' } });
      wrap.appendChild(el('label', { class: 'rpt-form-label' }, [field.label]));

      if (field.type === 'textarea') {
        const ta = el('textarea', { class: 'rpt-form-input rpt-form-textarea', placeholder: field.placeholder || '' });
        ta.value = formData[fKey] || '';
        ta.oninput = () => { formData[fKey] = ta.value; };
        wrap.appendChild(ta);
      } else if (field.type === 'text') {
        const inp = el('input', { type: 'text', class: 'rpt-form-input', placeholder: field.placeholder || '' });
        inp.value = formData[fKey] || '';
        inp.oninput = () => { formData[fKey] = inp.value; };
        wrap.appendChild(inp);
      } else if (field.type === 'dropdown') {
        const sel = el('select', { class: 'rpt-form-input' });
        sel.appendChild(el('option', { value: '' }, ['— Select —']));
        (field.options || []).forEach(opt => {
          const o = el('option', { value: opt }, [opt]);
          if (formData[fKey] === opt) o.selected = true;
          sel.appendChild(o);
        });
        sel.onchange = () => { formData[fKey] = sel.value; };
        wrap.appendChild(sel);
      } else if (field.type === 'scale') {
        const val = formData[fKey] !== undefined ? formData[fKey] : (field.defaultValue || 0);
        const row = el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } });
        const range = el('input', { type: 'range', min: field.min || 0, max: field.max || 100, step: field.step || 1, value: val, style: { flex: 1 } });
        const lbl = el('span', { style: { fontWeight: 700, fontSize: '.88rem', color: '#0d9488', minWidth: '36px', textAlign: 'center' } }, [String(val)]);
        range.oninput = () => { lbl.textContent = range.value; formData[fKey] = parseInt(range.value); };
        formData[fKey] = parseInt(val);
        row.appendChild(range); row.appendChild(lbl);
        wrap.appendChild(row);
      } else if (field.type === 'checklist') {
        const checked = formData[fKey] || [];
        (field.options || []).forEach(opt => {
          const lbl = el('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', fontSize: '.84rem', cursor: 'pointer' } });
          const cb = el('input', { type: 'checkbox' });
          cb.checked = checked.includes(opt);
          cb.onchange = () => {
            const cur = formData[fKey] || [];
            if (cb.checked) { if (!cur.includes(opt)) cur.push(opt); }
            else { const i = cur.indexOf(opt); if (i > -1) cur.splice(i, 1); }
            formData[fKey] = cur;
          };
          lbl.appendChild(cb); lbl.appendChild(document.createTextNode(opt));
          wrap.appendChild(lbl);
        });
        if (!formData[fKey]) formData[fKey] = checked;
      } else if (field.type === 'goals') {
        const goals = formData[fKey] || [{ text: '', target: '' }];
        formData[fKey] = goals;
        const goalsWrap = el('div');
        const renderGoals = () => {
          goalsWrap.innerHTML = '';
          goals.forEach((g, i) => {
            const row = el('div', { style: { display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' } });
            const inp = el('input', { type: 'text', class: 'rpt-form-input', value: g.text || '', placeholder: field.placeholder || 'Goal ' + (i + 1), style: { flex: 1 } });
            inp.oninput = () => { goals[i].text = inp.value; };
            const dateInp = el('input', { type: 'date', class: 'rpt-form-input', value: g.target || '', style: { width: '140px', flexShrink: 0 } });
            dateInp.oninput = () => { goals[i].target = dateInp.value; };
            row.appendChild(inp); row.appendChild(dateInp);
            if (goals.length > 1) {
              const rm = el('button', { style: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', padding: '4px', flexShrink: 0 } }, ['✕']);
              rm.onclick = () => { goals.splice(i, 1); renderGoals(); };
              row.appendChild(rm);
            }
            goalsWrap.appendChild(row);
          });
          const addBtn = el('button', { style: { background: 'none', border: '1px dashed #0d9488', color: '#0d9488', borderRadius: '8px', padding: '6px 12px', fontSize: '.76rem', fontWeight: 600, cursor: 'pointer', width: '100%' } }, ['+ Add Goal']);
          addBtn.onclick = () => { goals.push({ text: '', target: '' }); renderGoals(); };
          goalsWrap.appendChild(addBtn);
        };
        renderGoals();
        wrap.appendChild(goalsWrap);
      } else if (field.type === 'repeatable') {
        const entries = formData[fKey] || [{}];
        formData[fKey] = entries;
        const repWrap = el('div');
        const renderEntries = () => {
          repWrap.innerHTML = '';
          entries.forEach((entry, i) => {
            const entryCard = el('div', { style: { padding: '10px 12px', background: '#f8fafc', borderRadius: '10px', marginBottom: '8px', border: '1px solid #e8f4f2' } });
            (field.subfields || []).forEach(sf => {
              const sfKey = sf.id;
              entryCard.appendChild(el('label', { style: { display: 'block', fontSize: '.7rem', fontWeight: 600, color: '#64748b', marginBottom: '2px', marginTop: '6px' } }, [sf.label]));
              if (sf.type === 'dropdown') {
                const sel = el('select', { class: 'rpt-form-input', style: { marginBottom: '4px' } });
                sel.appendChild(el('option', { value: '' }, ['—']));
                (sf.options || []).forEach(o => { const opt = el('option', { value: o }, [o]); if (entry[sfKey] === o) opt.selected = true; sel.appendChild(opt); });
                sel.onchange = () => { entry[sfKey] = sel.value; };
                entryCard.appendChild(sel);
              } else {
                const inp = el('input', { type: 'text', class: 'rpt-form-input', placeholder: sf.placeholder || '', style: { marginBottom: '4px' } });
                inp.value = entry[sfKey] || '';
                inp.oninput = () => { entry[sfKey] = inp.value; };
                entryCard.appendChild(inp);
              }
            });
            if (entries.length > 1) {
              const rm = el('button', { style: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '.78rem', fontWeight: 600, marginTop: '4px' } }, ['✕ Remove']);
              rm.onclick = () => { entries.splice(i, 1); renderEntries(); };
              entryCard.appendChild(rm);
            }
            repWrap.appendChild(entryCard);
          });
          const addBtn = el('button', { style: { background: 'none', border: '1px dashed #0d9488', color: '#0d9488', borderRadius: '8px', padding: '6px 12px', fontSize: '.76rem', fontWeight: 600, cursor: 'pointer', width: '100%' } }, ['+ Add Entry']);
          addBtn.onclick = () => { entries.push({}); renderEntries(); };
          repWrap.appendChild(addBtn);
        };
        renderEntries();
        wrap.appendChild(repWrap);
      }

      card.appendChild(wrap);
    });

    container.appendChild(card);
  });
}
