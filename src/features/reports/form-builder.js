// Form Builder — renders dynamic form from template definition

export function buildForm(template, container, formState, childInfo, specialistInfo) {
  const { el, mkBtn, T } = window.HUD;
  formState._values = formState._values || {};

  template.sections.forEach(section => {
    if (section.autoFilled && section.fields.length === 0) {
      // Auto-filled admin section — show read-only summary
      const card = el('div', { style: { background: '#f0fdf9', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', border: '1px solid #d1fae5' } });
      card.appendChild(el('div', { style: { fontWeight: 700, color: '#0f172a', fontSize: '.82rem', marginBottom: '6px' } }, ['📋 ' + section.title]));
      const grid = el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: '.78rem', color: '#475569' } });
      grid.appendChild(el('div', {}, ['Patient: ' + (childInfo?.name || '—')]));
      grid.appendChild(el('div', {}, ['DOB: ' + (childInfo?.dob || '—')]));
      grid.appendChild(el('div', {}, ['Age: ' + (childInfo?.age || '—')]));
      grid.appendChild(el('div', {}, ['Date: ' + new Date().toISOString().split('T')[0]]));
      grid.appendChild(el('div', {}, ['Specialist: ' + (specialistInfo?.name || '—')]));
      grid.appendChild(el('div', {}, ['Specialty: ' + (specialistInfo?.specialty || '—')]));
      card.appendChild(grid);
      container.appendChild(card);
      return;
    }

    // Section header
    const secDiv = el('div', { style: { marginBottom: '20px' } });
    const hdr = el('div', { style: { fontWeight: 800, color: '#0f172a', fontSize: '.92rem', marginBottom: section.description ? '2px' : '10px' } }, [section.title]);
    secDiv.appendChild(hdr);
    if (section.description) {
      secDiv.appendChild(el('div', { style: { fontSize: '.76rem', color: '#64748b', marginBottom: '10px' } }, [section.description]));
    }

    // Fields
    section.fields.forEach(field => {
      const fieldWrap = el('div', { style: { marginBottom: '12px' } });
      fieldWrap.appendChild(el('label', { style: { display: 'block', fontSize: '.76rem', fontWeight: 600, color: '#475569', marginBottom: '4px' } }, [field.label]));

      const fKey = section.id + '.' + field.id;
      const saved = formState._values[fKey];

      if (field.type === 'textarea') {
        const ta = el('textarea', { style: { width: '100%', minHeight: '80px', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #d1fae5', fontSize: '.84rem', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }, placeholder: field.placeholder || '' });
        ta.value = saved || '';
        ta.oninput = () => { formState._values[fKey] = ta.value; };
        fieldWrap.appendChild(ta);
      } else if (field.type === 'dropdown') {
        const sel = el('select', { style: { width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1.5px solid #d1fae5', fontSize: '.84rem', fontFamily: 'inherit', boxSizing: 'border-box' } });
        sel.appendChild(el('option', { value: '' }, ['— Select —']));
        (field.options || []).forEach(opt => {
          const o = el('option', { value: opt }, [opt]);
          if (saved === opt) o.selected = true;
          sel.appendChild(o);
        });
        sel.onchange = () => { formState._values[fKey] = sel.value; };
        fieldWrap.appendChild(sel);
      } else if (field.type === 'text') {
        const inp = el('input', { type: 'text', style: { width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1.5px solid #d1fae5', fontSize: '.84rem', fontFamily: 'inherit', boxSizing: 'border-box' }, placeholder: field.placeholder || '' });
        inp.value = saved || '';
        inp.oninput = () => { formState._values[fKey] = inp.value; };
        fieldWrap.appendChild(inp);
      } else if (field.type === 'scale') {
        const val = saved !== undefined ? saved : (field.defaultValue || 50);
        const row = el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } });
        const range = el('input', { type: 'range', min: field.min || 0, max: field.max || 100, step: field.step || 5, value: val, style: { flex: 1 } });
        const lbl = el('span', { style: { fontWeight: 700, fontSize: '.88rem', color: '#0d9488', minWidth: '40px', textAlign: 'center' } }, [val + '%']);
        range.oninput = () => { lbl.textContent = range.value + '%'; formState._values[fKey] = parseInt(range.value); };
        formState._values[fKey] = parseInt(val);
        row.appendChild(range);
        row.appendChild(lbl);
        fieldWrap.appendChild(row);
      } else if (field.type === 'checklist') {
        const checks = saved || [];
        (field.options || []).forEach(opt => {
          const lbl = el('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '.84rem', cursor: 'pointer' } });
          const cb = el('input', { type: 'checkbox' });
          cb.checked = checks.includes(opt);
          cb.onchange = () => {
            const cur = formState._values[fKey] || [];
            if (cb.checked) { if (!cur.includes(opt)) cur.push(opt); }
            else { const i = cur.indexOf(opt); if (i > -1) cur.splice(i, 1); }
            formState._values[fKey] = cur;
          };
          lbl.appendChild(cb);
          lbl.appendChild(document.createTextNode(opt));
          fieldWrap.appendChild(lbl);
        });
        if (!formState._values[fKey]) formState._values[fKey] = checks;
      } else if (field.type === 'goals') {
        const goals = saved || [''];
        const goalsWrap = el('div');
        const renderGoals = () => {
          goalsWrap.innerHTML = '';
          goals.forEach((g, i) => {
            const row = el('div', { style: { display: 'flex', gap: '6px', marginBottom: '6px' } });
            const inp = el('input', { type: 'text', value: g, placeholder: field.placeholder || 'Goal ' + (i + 1), style: { flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1.5px solid #d1fae5', fontSize: '.82rem', fontFamily: 'inherit' } });
            inp.oninput = () => { goals[i] = inp.value; formState._values[fKey] = [...goals]; };
            row.appendChild(inp);
            if (goals.length > 1) {
              const rm = el('button', { style: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem', padding: '4px' } }, ['✕']);
              rm.onclick = () => { goals.splice(i, 1); formState._values[fKey] = [...goals]; renderGoals(); };
              row.appendChild(rm);
            }
            goalsWrap.appendChild(row);
          });
          const addBtn = el('button', { style: { background: 'none', border: '1px dashed #0d9488', color: '#0d9488', borderRadius: '8px', padding: '6px 12px', fontSize: '.76rem', fontWeight: 600, cursor: 'pointer', width: '100%' } }, ['+ Add Goal']);
          addBtn.onclick = () => { goals.push(''); formState._values[fKey] = [...goals]; renderGoals(); };
          goalsWrap.appendChild(addBtn);
        };
        formState._values[fKey] = goals;
        renderGoals();
        fieldWrap.appendChild(goalsWrap);
      }

      secDiv.appendChild(fieldWrap);
    });

    container.appendChild(secDiv);
  });
}

export function collectFormData(formState) {
  return { ...formState._values };
}
