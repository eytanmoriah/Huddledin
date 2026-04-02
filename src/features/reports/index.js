// Reports Module v2 — Template System + Report Form
import { SECTION_LIBRARY, getSectionsForSpecialty, getOtherSpecialtySections, getSectionById, loadTemplates, saveTemplate, deleteTemplate } from './templates.js';
import { renderForm } from './form-builder.js';
import { injectStyles } from './styles.js';

const RS = {
  templates: [], templatesLoaded: false,
  reports: [], reportsLoaded: false,
  monthlyCount: 0,
  // Current flow state
  view: 'hub', // hub | templates | edit-template | new-report
  step: 0, // new-report steps: 0=patient, 1=template, 2=sections, 3=form
  currentTemplate: null,
  currentReport: null,
  selectedChildId: null,
  selectedSections: [],
  formData: {},
  showOtherSpecs: false,
  dirty: false, // true if form has unsaved changes
};

const MONTHLY_LIMIT = 5;

function H() { return window.HUD || {}; }

function calcAge(dob) {
  if (!dob) return '';
  const b = new Date(dob), n = new Date();
  let y = n.getFullYear() - b.getFullYear(), m = n.getMonth() - b.getMonth();
  if (m < 0) { y--; m += 12; }
  return y + (y === 1 ? ' year' : ' years') + (m ? ' ' + m + (m === 1 ? ' month' : ' months') : '');
}

function getChildren() {
  const { DB } = H();
  const db = DB?.children || [], ls = (window.HUD?.LS?.get?.('children', []) || []);
  const seen = new Set(), out = [];
  [...db, ...ls].forEach(c => { if (!seen.has(c.id)) { seen.add(c.id); out.push(c); } });
  return out;
}

function statusBadge(status) {
  const { el } = H();
  const m = { finalized: ['rpt-badge-finalized', '✅ Finalized'], generated: ['rpt-badge-generated', '📄 Generated'], draft: ['rpt-badge-draft', '✏️ Draft'] };
  const [cls, lbl] = m[status] || m.draft;
  return el('span', { class: 'rpt-badge ' + cls }, [lbl]);
}

function nav(view, step) { RS.view = view; RS.step = step || 0; RS.dirty = false; H().re(); }

function exitWithCheck(destView) {
  if (!RS.dirty) { nav(destView || 'hub'); return; }
  const { openModal, el, mkBtn, _supa, session, toast } = H();
  openModal('Unsaved Changes', (mb, close) => {
    mb.appendChild(el('div', { style: { fontSize: '.88rem', color: '#475569', marginBottom: '16px', lineHeight: '1.6' } },
      ['You have unsaved changes. Save draft before leaving?']));
    const row = el('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' } });
    row.appendChild(mkBtn('Cancel', 'btn-md btn-ghost', close));
    row.appendChild(mkBtn('Discard', 'btn-md btn-danger', () => { close(); nav(destView || 'hub'); }));
    row.appendChild(mkBtn('Save & Exit', 'btn-md btn-primary', async () => {
      try {
        const tplName = RS.currentTemplate?.name || RS.currentReport?.report_type || 'Report';
        const payload = {
          specialist_id: session.id, child_id: RS.selectedChildId,
          report_type: tplName, template_id: RS.currentTemplate?.id || null,
          sections_included: RS.selectedSections,
          status: 'draft', form_data: RS.formData,
          updated_at: new Date().toISOString(),
        };
        if (RS.currentReport?.id) {
          await _supa.from('reports').update(payload).eq('id', RS.currentReport.id);
        } else {
          const { data, error } = await _supa.from('reports').insert(payload).select('id').single();
          if (error) throw error;
          RS.currentReport = { ...payload, id: data.id };
        }
        RS.reportsLoaded = false;
        toast('💾 Draft saved!');
        close(); nav(destView || 'hub');
      } catch (e) { console.error(e); toast('Could not save.', 'error'); }
    }));
    mb.appendChild(row);
  }, 400);
}

async function loadData() {
  const { _supa, session } = H();
  if (!_supa || !session) return;
  if (!RS.templatesLoaded) { RS.templates = await loadTemplates(); RS.templatesLoaded = true; }
  if (!RS.reportsLoaded) {
    try {
      const { data } = await _supa.from('reports').select('*').eq('specialist_id', session.id).order('created_at', { ascending: false });
      RS.reports = data || [];
      const ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      RS.monthlyCount = RS.reports.filter(r => r.created_at >= ms).length;
      RS.reportsLoaded = true;
    } catch (e) { console.error('Load reports:', e); }
  }
}

// ════════════════════════════════════════
// REPORTS HUB
// ════════════════════════════════════════
export function renderReports() {
  injectStyles();
  const { el, mkBtn, toast, _hasSpecAiAccess, _showSpecAiUpgradeModal, S } = H();
  S.activeTab = 'reports';
  const sec = document.createElement('div'); sec.className = 'section';

  if (!_hasSpecAiAccess()) {
    sec.appendChild(el('div', { class: 'empty-state' }, [
      el('span', { class: 'empty-state-icon' }, ['📋']),
      el('div', { class: 'empty-state-title' }, ['🔒 Reports']),
      el('div', { class: 'empty-state-body' }, ['Generate professional clinical reports with AI. Unlock with AI subscription.']),
      el('div', { class: 'empty-state-actions' }, [mkBtn('✨ Unlock Reports', 'btn-md btn-primary', () => _showSpecAiUpgradeModal('Reports'))])
    ]));
    return sec;
  }

  if (!RS.templatesLoaded || !RS.reportsLoaded) {
    sec.appendChild(el('div', { style: { textAlign: 'center', padding: '24px', color: '#64748b' } }, ['Loading...']));
    loadData().then(() => H().re());
    return sec;
  }

  // First time — no templates
  if (!RS.templates.length) {
    sec.appendChild(el('h2', { class: 'page-title' }, ['📋 Reports']));
    sec.appendChild(el('div', { class: 'empty-state', style: { marginTop: '8px' } }, [
      el('span', { class: 'empty-state-icon' }, ['📋']),
      el('div', { class: 'empty-state-title' }, ['Welcome to the Report Builder!']),
      el('div', { class: 'empty-state-body' }, ['Create your first template to start writing reports.']),
      el('div', { class: 'empty-state-actions' }, [
        mkBtn('🔧 Build From Scratch', 'btn-md btn-primary', () => { RS.currentTemplate = null; nav('edit-template'); })
      ])
    ]));
    return sec;
  }

  // Hub with reports
  const hdr = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' } });
  hdr.appendChild(el('h2', { class: 'page-title', style: { margin: 0 } }, ['📋 Reports']));
  const hdrR = el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } });
  hdrR.appendChild(el('span', { class: 'rpt-counter' }, [RS.monthlyCount + ' / ' + MONTHLY_LIMIT + ' this month']));
  hdrR.appendChild(mkBtn('📄 My Templates', 'btn-sm btn-ghost', () => nav('templates')));
  hdrR.appendChild(mkBtn('+ New Report', 'btn-sm btn-primary', () => {
    if (RS.monthlyCount >= MONTHLY_LIMIT) { toast('Monthly limit reached (5/5).', 'error'); return; }
    RS.selectedChildId = null; RS.currentTemplate = null; RS.selectedSections = []; RS.formData = {}; RS.currentReport = null; RS.step = 0;
    nav('new-report');
  }));
  hdr.appendChild(hdrR); sec.appendChild(hdr);

  if (!RS.reports.length) {
    sec.appendChild(el('div', { style: { textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '.88rem' } }, ['No reports yet. Create your first one!']));
    return sec;
  }

  const children = getChildren();
  RS.reports.forEach(r => {
    const child = children.find(c => c.id === r.child_id);
    const card = el('div', { class: 'rpt-card' });
    const top = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' } });
    top.appendChild(el('div', { style: { fontWeight: 700, color: '#0f172a', fontSize: '.88rem' } }, [(child?.avatar || '🧒') + ' ' + (child?.name || 'Patient') + ' — ' + (r.report_type || 'Report')]));
    top.appendChild(statusBadge(r.status));
    card.appendChild(top);
    card.appendChild(el('div', { style: { fontSize: '.76rem', color: '#64748b' } }, [(r.created_at ? new Date(r.created_at).toLocaleDateString() : '')]));
    card.onclick = () => {
      RS.currentReport = r; RS.selectedChildId = r.child_id;
      RS.formData = r.form_data || {}; RS.selectedSections = r.sections_included || [];
      RS.step = 3; nav('new-report', 3);
    };
    sec.appendChild(card);
  });
  return sec;
}

// ════════════════════════════════════════
// MY TEMPLATES
// ════════════════════════════════════════
export function renderTemplates() {
  injectStyles();
  const { el, mkBtn, toast, openConfirm } = H();
  const sec = document.createElement('div'); sec.className = 'section';

  const back = el('span', { style: { color: '#0d9488', cursor: 'pointer', fontWeight: 600, fontSize: '.84rem' } }, ['← Back to Reports']);
  back.onclick = () => nav('hub'); sec.appendChild(back);

  const hdr = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 16px' } });
  hdr.appendChild(el('h2', { style: { fontWeight: 800, color: '#0f172a', fontSize: '1.1rem', margin: 0 } }, ['My Templates']));
  hdr.appendChild(mkBtn('+ New Template', 'btn-sm btn-primary', () => { RS.currentTemplate = null; nav('edit-template'); }));
  sec.appendChild(hdr);

  if (!RS.templates.length) {
    sec.appendChild(el('div', { style: { textAlign: 'center', padding: '20px', color: '#64748b' } }, ['No templates yet.']));
    return sec;
  }

  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '12px' } });
  RS.templates.forEach(t => {
    const card = el('div', { class: 'rpt-tpl-card' });
    card.appendChild(el('div', { style: { fontWeight: 700, color: '#0f172a', marginBottom: '4px' } }, [t.name]));
    card.appendChild(el('div', { style: { fontSize: '.76rem', color: '#64748b', marginBottom: '8px' } }, [t.description || '']));
    const meta = el('div', { style: { fontSize: '.7rem', color: '#94a3b8' } });
    const secCount = (t.sections || []).length;
    meta.textContent = secCount + ' section' + (secCount !== 1 ? 's' : '') + ' · Used ' + (t.use_count || 0) + ' time' + ((t.use_count || 0) !== 1 ? 's' : '');
    card.appendChild(meta);
    // Actions
    const acts = el('div', { style: { display: 'flex', gap: '8px', marginTop: '10px' } });
    acts.appendChild(mkBtn('Edit', 'btn-sm btn-ghost', (e) => { e.stopPropagation(); RS.currentTemplate = { ...t, sections: [...(t.sections || [])] }; nav('edit-template'); }));
    acts.appendChild(mkBtn('Delete', 'btn-sm btn-ghost', (e) => {
      e.stopPropagation();
      openConfirm('Delete Template?', 'This cannot be undone.', true, async () => {
        await deleteTemplate(t.id); RS.templatesLoaded = false; await loadData(); H().re();
      });
    }));
    card.appendChild(acts);
    card.onclick = () => { RS.currentTemplate = { ...t, sections: [...(t.sections || [])] }; nav('edit-template'); };
    grid.appendChild(card);
  });
  sec.appendChild(grid);
  return sec;
}

// ════════════════════════════════════════
// TEMPLATE EDITOR
// ════════════════════════════════════════
export function renderTemplateEditor() {
  injectStyles();
  const { el, mkBtn, toast, session } = H();
  const sec = document.createElement('div'); sec.className = 'section';

  const back = el('span', { style: { color: '#0d9488', cursor: 'pointer', fontWeight: 600, fontSize: '.84rem' } }, ['← Back']);
  back.onclick = () => nav(RS.templates.length ? 'templates' : 'hub'); sec.appendChild(back);

  const isEdit = !!RS.currentTemplate?.id;
  sec.appendChild(el('h2', { style: { fontWeight: 800, color: '#0f172a', margin: '14px 0 16px', fontSize: '1.1rem' } }, [isEdit ? 'Edit Template' : 'New Template']));

  // Template name
  const nameInp = el('input', { class: 'rpt-form-input', placeholder: 'Template name (e.g. Speech Assessment)', style: { marginBottom: '8px' } });
  nameInp.value = RS.currentTemplate?.name || '';
  sec.appendChild(el('label', { class: 'rpt-form-label' }, ['Template Name']));
  sec.appendChild(nameInp);

  const descInp = el('input', { class: 'rpt-form-input', placeholder: 'Brief description (optional)', style: { marginBottom: '16px' } });
  descInp.value = RS.currentTemplate?.description || '';
  sec.appendChild(el('label', { class: 'rpt-form-label', style: { marginTop: '8px' } }, ['Description']));
  sec.appendChild(descInp);

  // Track selected section IDs
  const selected = new Set((RS.currentTemplate?.sections || []).map(s => typeof s === 'string' ? s : s.id));

  // Always included
  const alwaysGroup = el('div', { class: 'rpt-sec-group' });
  alwaysGroup.appendChild(el('div', { class: 'rpt-sec-group-title' }, ['Always Included']));
  [['admin', '📋 Administrative Info (auto-filled)'], ['signature', '✍️ Signature (auto-filled from credentials)']].forEach(([id, label]) => {
    const row = el('div', { class: 'rpt-sec-check', style: { opacity: .6 } });
    const cb = el('input', { type: 'checkbox', checked: true, disabled: true });
    row.appendChild(cb);
    row.appendChild(el('div', {}, [el('div', { style: { fontWeight: 600, color: '#0f172a', fontSize: '.84rem' } }, [label])]));
    alwaysGroup.appendChild(row);
  });
  sec.appendChild(alwaysGroup);

  // Section checkbox builder
  const mkSecRow = (s) => {
    const row = el('div', { class: 'rpt-sec-check' });
    const cb = el('input', { type: 'checkbox' });
    cb.checked = selected.has(s.id);
    cb.onchange = () => { if (cb.checked) selected.add(s.id); else selected.delete(s.id); };
    row.appendChild(cb);
    const info = el('div', { style: { flex: 1 } });
    info.appendChild(el('div', { style: { fontWeight: 600, color: '#0f172a', fontSize: '.84rem' } }, [s.title]));
    const typeLbl = s.type === 'freetext' ? 'Free text' : s.type === 'structured' ? 'Structured' : 'Mixed';
    info.appendChild(el('div', { style: { fontSize: '.7rem', color: '#94a3b8' } }, [typeLbl + ' · ' + (s.fields || []).length + ' field' + ((s.fields || []).length !== 1 ? 's' : '')]));
    row.appendChild(info);
    return row;
  };

  // Specialty sections
  const profession = session?.profession || '';
  const { universal, specific, specKey } = getSectionsForSpecialty(profession);

  const uniGroup = el('div', { class: 'rpt-sec-group' });
  uniGroup.appendChild(el('div', { class: 'rpt-sec-group-title' }, ['Universal Sections']));
  universal.forEach(s => uniGroup.appendChild(mkSecRow(s)));
  sec.appendChild(uniGroup);

  if (specific.length) {
    const specGroup = el('div', { class: 'rpt-sec-group' });
    const specLabel = { speech: 'Speech-Language', ot: 'Occupational Therapy', pt: 'Physical Therapy', behavioral: 'Behavioral / Psychology' }[specKey] || specKey;
    specGroup.appendChild(el('div', { class: 'rpt-sec-group-title' }, [specLabel + ' Sections']));
    specific.forEach(s => specGroup.appendChild(mkSecRow(s)));
    sec.appendChild(specGroup);
  }

  // Other specialties (collapsible)
  const others = getOtherSpecialtySections(specKey);
  if (Object.keys(others).length) {
    const togBtn = el('button', { style: { background: 'none', border: 'none', color: '#0d9488', cursor: 'pointer', fontWeight: 600, fontSize: '.82rem', padding: '8px 0', display: 'flex', alignItems: 'center', gap: '4px' } });
    togBtn.textContent = (RS.showOtherSpecs ? '▴' : '▾') + ' Show other specialties';
    togBtn.onclick = () => { RS.showOtherSpecs = !RS.showOtherSpecs; H().re(); };
    sec.appendChild(togBtn);

    if (RS.showOtherSpecs) {
      Object.entries(others).forEach(([key, sections]) => {
        const lbl = { speech: 'Speech-Language', ot: 'Occupational Therapy', pt: 'Physical Therapy', behavioral: 'Behavioral / Psychology' }[key] || key;
        const grp = el('div', { class: 'rpt-sec-group' });
        grp.appendChild(el('div', { class: 'rpt-sec-group-title' }, [lbl]));
        sections.forEach(s => grp.appendChild(mkSecRow(s)));
        sec.appendChild(grp);
      });
    }
  }

  // Save button
  const saveBtn = mkBtn(isEdit ? '💾 Save Template' : '✅ Create Template', 'btn-md btn-primary', async () => {
    if (!nameInp.value.trim()) { toast('Please enter a template name.', 'error'); return; }
    saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
    try {
      const tpl = RS.currentTemplate || {};
      tpl.name = nameInp.value.trim();
      tpl.description = descInp.value.trim();
      tpl.sections = [...selected];
      const id = await saveTemplate(tpl);
      RS.templatesLoaded = false; await loadData();
      toast(isEdit ? '💾 Template saved!' : '✅ Template created!');
      nav('templates');
    } catch (e) { console.error(e); toast('Could not save template.', 'error'); saveBtn.disabled = false; saveBtn.textContent = isEdit ? '💾 Save Template' : '✅ Create Template'; }
  });
  sec.appendChild(el('div', { style: { marginTop: '20px' } }, [saveBtn]));

  return sec;
}

// ════════════════════════════════════════
// NEW REPORT FLOW
// ════════════════════════════════════════
export function renderNewReport() {
  injectStyles();
  const { el, mkBtn, toast, session, _supa, S } = H();
  const sec = document.createElement('div'); sec.className = 'section';

  const navRow = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: '0', zIndex: 10, background: '#f0fdf9', padding: '10px 0', marginBottom: '4px' } });
  const backLabel = RS.step === 0 ? '← Back to Reports' : '← Back';
  const back = el('span', { style: { color: '#0d9488', cursor: 'pointer', fontWeight: 600, fontSize: '.84rem' } }, [backLabel]);
  back.onclick = () => {
    if (RS.step > 0 && RS.step <= 2) { RS.step--; H().re(); }
    else if (RS.step === 3) { exitWithCheck('hub'); }
    else { nav('hub'); }
  };
  navRow.appendChild(back);
  // Exit button — always visible during flow
  if (RS.step > 0) {
    const exitBtn = el('button', { style: { background: 'none', border: '1px solid #e8f4f2', borderRadius: '8px', padding: '4px 12px', fontSize: '.76rem', fontWeight: 600, color: '#64748b', cursor: 'pointer' } }, ['✕ Exit']);
    exitBtn.onclick = () => exitWithCheck('hub');
    navRow.appendChild(exitBtn);
  }
  sec.appendChild(navRow);

  // ── Step 0: Pick Patient ──
  if (RS.step === 0) {
    sec.appendChild(el('h2', { style: { fontWeight: 800, color: '#0f172a', margin: '14px 0 12px', fontSize: '1.1rem' } }, ['Select Patient']));
    const children = getChildren();
    if (!children.length) { sec.appendChild(el('div', { style: { color: '#64748b' } }, ['No patients connected.'])); return sec; }
    children.forEach(c => {
      const row = el('div', { class: 'rpt-card', style: { display: 'flex', alignItems: 'center', gap: '12px' } });
      row.appendChild(el('span', { style: { fontSize: '1.4rem' } }, [c.avatar || '🧒']));
      const info = el('div', { style: { flex: 1 } });
      info.appendChild(el('div', { style: { fontWeight: 700, color: '#0f172a' } }, [c.name]));
      info.appendChild(el('div', { style: { fontSize: '.76rem', color: '#64748b' } }, [calcAge(c.dob)]));
      row.appendChild(info);
      row.onclick = () => { RS.selectedChildId = c.id; RS.step = 1; H().re(); };
      sec.appendChild(row);
    });
    return sec;
  }

  // ── Step 1: Pick Template ──
  if (RS.step === 1) {
    sec.appendChild(el('h2', { style: { fontWeight: 800, color: '#0f172a', margin: '14px 0 12px', fontSize: '1.1rem' } }, ['Choose Template']));
    if (!RS.templates.length) {
      sec.appendChild(el('div', { style: { color: '#64748b', marginBottom: '12px' } }, ['No templates yet. Create one first.']));
      sec.appendChild(mkBtn('🔧 Create Template', 'btn-md btn-primary', () => { RS.currentTemplate = null; nav('edit-template'); }));
      return sec;
    }
    const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '12px' } });
    RS.templates.forEach(t => {
      const card = el('div', { class: 'rpt-tpl-card' });
      card.appendChild(el('div', { style: { fontWeight: 700, color: '#0f172a', marginBottom: '4px' } }, [t.name]));
      card.appendChild(el('div', { style: { fontSize: '.76rem', color: '#64748b' } }, [(t.sections || []).length + ' sections']));
      card.onclick = () => { RS.currentTemplate = t; RS.selectedSections = [...(t.sections || [])]; RS.step = 2; H().re(); };
      grid.appendChild(card);
    });
    sec.appendChild(grid);
    return sec;
  }

  // ── Step 2: Toggle Sections ──
  if (RS.step === 2) {
    sec.appendChild(el('h2', { style: { fontWeight: 800, color: '#0f172a', margin: '14px 0 4px', fontSize: '1.1rem' } }, ['Select Sections for This Report']));
    sec.appendChild(el('div', { style: { fontSize: '.78rem', color: '#64748b', marginBottom: '14px' } }, ['Uncheck sections not relevant for this patient.']));

    const selected = new Set(RS.selectedSections);

    // Always on
    [['admin', '📋 Administrative Info'], ['signature', '✍️ Signature']].forEach(([id, lbl]) => {
      const row = el('div', { class: 'rpt-sec-check', style: { opacity: .6 } });
      row.appendChild(el('input', { type: 'checkbox', checked: true, disabled: true }));
      row.appendChild(el('div', { style: { fontWeight: 600, fontSize: '.84rem' } }, [lbl]));
      sec.appendChild(row);
    });

    RS.selectedSections.forEach(secId => {
      const secDef = getSectionById(secId);
      if (!secDef) return;
      const row = el('div', { class: 'rpt-sec-check' });
      const cb = el('input', { type: 'checkbox' });
      cb.checked = selected.has(secId);
      cb.onchange = () => { if (cb.checked) selected.add(secId); else selected.delete(secId); };
      row.appendChild(cb);
      row.appendChild(el('div', { style: { fontWeight: 600, fontSize: '.84rem', flex: 1 } }, [secDef.title]));
      sec.appendChild(row);
    });

    sec.appendChild(el('div', { style: { marginTop: '16px' } }, [
      mkBtn('Continue →', 'btn-md btn-primary', () => { RS.selectedSections = [...selected]; RS.formData = RS.currentReport?.form_data || {}; RS.step = 3; H().re(); })
    ]));
    return sec;
  }

  // ── Step 3: Fill Form ──
  if (RS.step === 3) {
    const children = getChildren();
    const child = children.find(c => c.id === RS.selectedChildId);
    const childInfo = { name: child?.name || '—', dob: child?.dob || '—', age: calcAge(child?.dob) };
    const specInfo = { name: session?.displayName || session?.name || '—', specialty: session?.profession || '—', credentials: session?.credentials_title || '' };
    const tplName = RS.currentTemplate?.name || RS.currentReport?.report_type || 'Report';

    sec.appendChild(el('h2', { style: { fontWeight: 800, color: '#0f172a', margin: '14px 0 4px', fontSize: '1.1rem' } }, [tplName]));
    sec.appendChild(el('div', { style: { fontSize: '.78rem', color: '#64748b', marginBottom: '14px' } }, ['For ' + childInfo.name + ' · ' + childInfo.age]));

    const formContainer = el('div');
    // Track dirty state — any input/change in the form sets dirty
    formContainer.addEventListener('input', () => { RS.dirty = true; }, true);
    formContainer.addEventListener('change', () => { RS.dirty = true; }, true);
    const activeSections = RS.selectedSections.filter(id => getSectionById(id));
    renderForm(activeSections, formContainer, RS.formData, childInfo, specInfo);
    sec.appendChild(formContainer);

    // Save draft
    const actions = el('div', { style: { display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' } });
    const saveBtn = mkBtn('💾 Save Draft', 'btn-md btn-primary', async () => {
      saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
      try {
        const payload = {
          specialist_id: session.id, child_id: RS.selectedChildId,
          report_type: tplName, template_id: RS.currentTemplate?.id || null,
          sections_included: RS.selectedSections,
          status: 'draft', form_data: RS.formData,
          updated_at: new Date().toISOString(),
        };
        if (RS.currentReport?.id) {
          const { error } = await _supa.from('reports').update(payload).eq('id', RS.currentReport.id);
          if (error) throw error;
        } else {
          const { data, error } = await _supa.from('reports').insert(payload).select('id').single();
          if (error) throw error;
          RS.currentReport = { ...payload, id: data.id };
        }
        RS.reportsLoaded = false;
        // Increment template use count
        if (RS.currentTemplate?.id) {
          await _supa.from('report_templates').update({ use_count: (RS.currentTemplate.use_count || 0) + 1 }).eq('id', RS.currentTemplate.id);
        }
        RS.dirty = false;
        toast('💾 Draft saved!');
        nav('hub'); // go back to reports list
      } catch (e) { console.error(e); toast('Could not save.', 'error'); saveBtn.disabled = false; saveBtn.textContent = '💾 Save Draft'; }
    });
    actions.appendChild(saveBtn);
    sec.appendChild(actions);
    return sec;
  }

  return sec;
}

// ════════════════════════════════════════
// INIT + ROUTING
// ════════════════════════════════════════
export function initReports() {
  injectStyles();
  console.log('[Huddledin] Reports v2 module initialized');
}

// Main render dispatcher (called from index.html glue)
function renderMain() {
  switch (RS.view) {
    case 'templates': return renderTemplates();
    case 'edit-template': return renderTemplateEditor();
    case 'new-report': return renderNewReport();
    default: return renderReports();
  }
}

window.HUD_REPORTS = {
  renderReports: renderMain,
  renderTemplates,
  renderTemplateEditor,
  renderNewReport,
  initReports,
  RS,
};
