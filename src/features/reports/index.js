// Reports Module v2 — Templates + Form + AI Generation + Import
import { SECTION_LIBRARY, getSectionsForSpecialty, getOtherSpecialtySections, getSectionById, loadTemplates, saveTemplate, deleteTemplate } from './templates.js';
import { renderForm } from './form-builder.js';
import { generateReport, importTemplate } from './ai-generator.js';
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
  dirty: false,
  lastSavedFormData: null,
  generatedText: null,
  regenCount: 0, // max 3 regenerations per report
  importedTemplate: null, // template proposed by AI import
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
    row.appendChild(mkBtn('Discard', 'btn-md btn-danger', async () => {
      close();
      // Revert form data to last saved snapshot
      if (RS.lastSavedFormData) {
        RS.formData = JSON.parse(JSON.stringify(RS.lastSavedFormData));
      }
      // If report was never saved (no id), it doesn't exist in DB — nothing to delete
      // If it was saved, the DB still has the last-saved version — formData is just reverted locally
      if (RS.currentReport?.id && !RS.lastSavedFormData) {
        // Brand new report that was auto-created but never intentionally saved — delete it
        try { await _supa.from('reports').delete().eq('id', RS.currentReport.id); RS.reportsLoaded = false; } catch (e) { console.error(e); }
      }
      nav(destView || 'hub');
    }));
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
      el('div', { class: 'empty-state-actions', style: { display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' } }, [
        mkBtn('📄 Upload a Past Report', 'btn-md btn-secondary', () => _startImport()),
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
    RS.selectedChildId = null; RS.currentTemplate = null; RS.selectedSections = []; RS.formData = {}; RS.currentReport = null; RS.lastSavedFormData = null; RS.step = 0;
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
      RS.formData = r.form_data ? JSON.parse(JSON.stringify(r.form_data)) : {};
      RS.lastSavedFormData = JSON.parse(JSON.stringify(RS.formData));
      RS.selectedSections = r.sections_included || [];
      RS.generatedText = r.generated_text || null;
      RS.regenCount = 0;
      if (r.status === 'generated' || r.status === 'finalized') { nav('preview'); }
      else { RS.step = 3; nav('new-report', 3); }
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
  const hdrBtns = el('div', { style: { display: 'flex', gap: '8px' } });
  hdrBtns.appendChild(mkBtn('📄 Import from Report', 'btn-sm btn-ghost', () => _startImport()));
  hdrBtns.appendChild(mkBtn('+ New Template', 'btn-sm btn-primary', () => _showNewTemplateChoice()));
  hdr.appendChild(hdrBtns);
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
  const importedSections = RS.currentTemplate?._importedSections || [];
  const hasImportedText = !!(RS.importedOriginalText && RS.currentTemplate?.source === 'imported');
  const isWebView = window.innerWidth >= 1024;

  // Build section content into a container (left column in split view)
  const leftCol = el('div', { style: { flex: 1, minWidth: 0 } });

  // Always included
  const alwaysGroup = el('div', { class: 'rpt-sec-group' });
  alwaysGroup.appendChild(el('div', { class: 'rpt-sec-group-title' }, ['Always Included']));
  [['admin', '📋 Administrative Info (auto-filled)'], ['signature', '✍️ Signature (auto-filled from credentials)']].forEach(([id, label]) => {
    const row = el('div', { class: 'rpt-sec-check', style: { opacity: .6 } });
    row.appendChild(el('input', { type: 'checkbox', checked: true, disabled: true }));
    row.appendChild(el('div', {}, [el('div', { style: { fontWeight: 600, color: '#0f172a', fontSize: '.84rem' } }, [label])]));
    alwaysGroup.appendChild(row);
  });
  leftCol.appendChild(alwaysGroup);

  // Right column ref for highlighting
  let rightTextEl = null;

  // Section checkbox builder with hover highlight
  const mkSecRow = (s) => {
    const impSec = importedSections.find(is => is.id === s.id);
    const excerpt = impSec?.source_excerpt || '';
    const row = el('div', { class: 'rpt-sec-check', 'data-section-id': s.id });
    const cb = el('input', { type: 'checkbox' });
    cb.checked = selected.has(s.id);
    cb.onchange = () => { if (cb.checked) selected.add(s.id); else selected.delete(s.id); };
    row.appendChild(cb);
    const info = el('div', { style: { flex: 1 } });
    info.appendChild(el('div', { style: { fontWeight: 600, color: '#0f172a', fontSize: '.84rem' } }, [s.title]));
    const typeLbl = s.type === 'freetext' ? 'Free text' : s.type === 'structured' ? 'Structured' : 'Mixed';
    info.appendChild(el('div', { style: { fontSize: '.7rem', color: '#94a3b8' } }, [typeLbl + ' · ' + (s.fields || []).length + ' field' + ((s.fields || []).length !== 1 ? 's' : '')]));
    row.appendChild(info);
    // Hover highlight for imported templates
    if (hasImportedText && isWebView && excerpt) {
      row.onmouseenter = () => _highlightExcerpt(excerpt, true);
      row.onmouseleave = () => _highlightExcerpt(excerpt, false);
      row.onclick = (e) => { if (e.target.tagName !== 'INPUT') _scrollToExcerpt(excerpt); };
    }
    return row;
  };

  // Imported sections (from AI analysis)
  if (importedSections.length) {
    const impGroup = el('div', { class: 'rpt-sec-group' });
    impGroup.appendChild(el('div', { class: 'rpt-sec-group-title' }, ['Imported Sections']));
    importedSections.forEach(s => {
      if (!s.id) s.id = s.title?.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'sec_' + Math.random().toString(36).slice(2, 6);
      selected.add(s.id); // auto-select imported sections
      impGroup.appendChild(mkSecRow(s));
    });
    leftCol.appendChild(impGroup);
  }

  // Library sections
  const profession = session?.profession || '';
  const { universal, specific, specKey } = getSectionsForSpecialty(profession);

  const uniGroup = el('div', { class: 'rpt-sec-group' });
  uniGroup.appendChild(el('div', { class: 'rpt-sec-group-title' }, ['Universal Sections']));
  universal.forEach(s => uniGroup.appendChild(mkSecRow(s)));
  leftCol.appendChild(uniGroup);

  if (specific.length) {
    const specGroup = el('div', { class: 'rpt-sec-group' });
    const specLabel = { speech: 'Speech-Language', ot: 'Occupational Therapy', pt: 'Physical Therapy', behavioral: 'Behavioral / Psychology' }[specKey] || specKey;
    specGroup.appendChild(el('div', { class: 'rpt-sec-group-title' }, [specLabel + ' Sections']));
    specific.forEach(s => specGroup.appendChild(mkSecRow(s)));
    leftCol.appendChild(specGroup);
  }

  const others = getOtherSpecialtySections(specKey);
  if (Object.keys(others).length) {
    const togBtn = el('button', { style: { background: 'none', border: 'none', color: '#0d9488', cursor: 'pointer', fontWeight: 600, fontSize: '.82rem', padding: '8px 0' } });
    togBtn.textContent = (RS.showOtherSpecs ? '▴' : '▾') + ' Show other specialties';
    togBtn.onclick = () => { RS.showOtherSpecs = !RS.showOtherSpecs; H().re(); };
    leftCol.appendChild(togBtn);
    if (RS.showOtherSpecs) {
      Object.entries(others).forEach(([key, sections]) => {
        const lbl = { speech: 'Speech-Language', ot: 'Occupational Therapy', pt: 'Physical Therapy', behavioral: 'Behavioral / Psychology' }[key] || key;
        const grp = el('div', { class: 'rpt-sec-group' });
        grp.appendChild(el('div', { class: 'rpt-sec-group-title' }, [lbl]));
        sections.forEach(s => grp.appendChild(mkSecRow(s)));
        leftCol.appendChild(grp);
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
      await saveTemplate(tpl);
      RS.templatesLoaded = false; RS.importedOriginalText = ''; await loadData();
      toast(isEdit ? '💾 Template saved!' : '✅ Template created!');
      nav('templates');
    } catch (e) { console.error(e); toast('Could not save template.', 'error'); saveBtn.disabled = false; saveBtn.textContent = isEdit ? '💾 Save Template' : '✅ Create Template'; }
  });
  leftCol.appendChild(el('div', { style: { marginTop: '20px' } }, [saveBtn]));

  // Split view (web + imported) or single column
  if (hasImportedText && isWebView) {
    const splitWrap = el('div', { style: { display: 'flex', gap: '20px', alignItems: 'flex-start' } });
    splitWrap.appendChild(leftCol);
    // Right column — original report text
    const rightCol = el('div', { style: { flex: 1, minWidth: 0, position: 'sticky', top: '60px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' } });
    rightCol.appendChild(el('div', { style: { fontWeight: 700, color: '#0f172a', fontSize: '.84rem', marginBottom: '8px' } }, ['📄 Original Report']));
    rightTextEl = el('div', { id: 'rpt-import-original', style: { fontSize: '.8rem', lineHeight: '1.7', color: '#334155', padding: '14px', background: '#fff', borderRadius: '12px', border: '1px solid #e8f4f2', whiteSpace: 'pre-wrap', fontFamily: 'inherit' } });
    rightTextEl.textContent = RS.importedOriginalText;
    rightCol.appendChild(rightTextEl);
    splitWrap.appendChild(rightCol);
    sec.appendChild(splitWrap);
  } else {
    sec.appendChild(leftCol);
  }

  return sec;
}

// Highlight helpers for import split view
// Find the paragraph in original text that best matches a section title (client-side)
function _findExcerptForSection(sectionTitle, originalText) {
  if (!sectionTitle || !originalText) return '';
  const lines = originalText.split('\n');
  const titleLower = sectionTitle.toLowerCase();
  // Find the line that contains the section title (or close match)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(titleLower)) {
      // Return this line + next 2-3 non-empty lines as the excerpt
      const excerpt = [];
      for (let j = i; j < Math.min(i + 4, lines.length); j++) {
        if (lines[j].trim()) excerpt.push(lines[j].trim());
      }
      return excerpt.join(' ');
    }
  }
  // Fallback: try matching first word of title
  const firstWord = titleLower.split(/\s/)[0];
  if (firstWord.length > 3) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(firstWord)) {
        const excerpt = [];
        for (let j = i; j < Math.min(i + 3, lines.length); j++) {
          if (lines[j].trim()) excerpt.push(lines[j].trim());
        }
        return excerpt.join(' ');
      }
    }
  }
  return '';
}

function _highlightExcerpt(excerpt, on) {
  const container = document.getElementById('rpt-import-original');
  if (!container || !excerpt) return;
  if (!on) { container.innerHTML = ''; container.textContent = RS.importedOriginalText; return; }
  const text = RS.importedOriginalText || '';
  const idx = text.indexOf(excerpt);
  if (idx === -1) { container.innerHTML = ''; container.textContent = text; return; }
  container.innerHTML = '';
  container.appendChild(document.createTextNode(text.substring(0, idx)));
  const mark = document.createElement('mark');
  mark.style.cssText = 'background:#ccfbf1;border-radius:3px;padding:1px 2px;';
  mark.textContent = excerpt;
  container.appendChild(mark);
  container.appendChild(document.createTextNode(text.substring(idx + excerpt.length)));
}

function _scrollToExcerpt(excerpt) {
  const container = document.getElementById('rpt-import-original');
  if (!container) return;
  _highlightExcerpt(excerpt, true);
  const mark = container.querySelector('mark');
  if (mark) mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    // Actions
    const actions = el('div', { style: { display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' } });

    // Save draft
    actions.appendChild(mkBtn('💾 Save Draft', 'btn-md btn-secondary', async () => {
      try { await _saveDraft(session, _supa, tplName); toast('💾 Draft saved!'); nav('hub'); }
      catch (e) { console.error(e); toast('Could not save.', 'error'); }
    }));

    // Generate with AI
    const genBtn = mkBtn('✨ Generate Report', 'btn-md btn-primary', async () => {
      if (RS.monthlyCount >= MONTHLY_LIMIT) { toast('Monthly limit reached (5/5).', 'error'); return; }
      genBtn.disabled = true; genBtn.textContent = '⏳ Generating...';
      try {
        // Save draft first
        await _saveDraft(session, _supa, tplName);
        // Call AI
        const hasStyle = RS.currentTemplate?.writing_style;
        const sectionTitles = activeSections.map(id => getSectionById(id)?.title).filter(Boolean);
        const text = await generateReport({
          reportType: tplName,
          formData: RS.formData,
          childInfo, specialistInfo: specInfo,
          writingStyle: hasStyle ? JSON.stringify(RS.currentTemplate.writing_style) : null,
          sections: sectionTitles,
        });
        RS.generatedText = text;
        RS.regenCount = 0;
        // Save generated text
        await _supa.from('reports').update({ generated_text: text, status: 'generated', updated_at: new Date().toISOString() }).eq('id', RS.currentReport.id);
        RS.currentReport.generated_text = text;
        RS.currentReport.status = 'generated';
        RS.reportsLoaded = false;
        nav('preview');
      } catch (e) {
        console.error(e); toast('Generation failed: ' + e.message, 'error');
        genBtn.disabled = false; genBtn.textContent = '✨ Generate Report';
      }
    });
    actions.appendChild(genBtn);

    sec.appendChild(actions);
    return sec;
  }

  return sec;
}

// Save draft helper (reused by save and generate)
async function _saveDraft(session, _supa, tplName) {
  const payload = {
    specialist_id: session.id, child_id: RS.selectedChildId,
    report_type: tplName, template_id: RS.currentTemplate?.id || null,
    sections_included: RS.selectedSections,
    status: RS.currentReport?.status || 'draft', form_data: RS.formData,
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
  RS.dirty = false;
  RS.lastSavedFormData = JSON.parse(JSON.stringify(RS.formData));
  if (RS.currentTemplate?.id) {
    _supa.from('report_templates').update({ use_count: (RS.currentTemplate.use_count || 0) + 1 }).eq('id', RS.currentTemplate.id).catch(() => {});
  }
}

// ════════════════════════════════════════
// REPORT PREVIEW
// ════════════════════════════════════════
function renderPreview() {
  injectStyles();
  const { el, mkBtn, toast, session, _supa, openModal, openConfirm } = H();
  const sec = document.createElement('div'); sec.className = 'section';

  const navRow = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: '0', zIndex: 10, background: '#f0fdf9', padding: '10px 0' } });
  const back = el('span', { style: { color: '#0d9488', cursor: 'pointer', fontWeight: 600, fontSize: '.84rem' } }, ['← Back to Form']);
  back.onclick = () => { RS.step = 3; nav('new-report', 3); };
  navRow.appendChild(back);
  const exitBtn = el('button', { style: { background: 'none', border: '1px solid #e8f4f2', borderRadius: '8px', padding: '4px 12px', fontSize: '.76rem', fontWeight: 600, color: '#64748b', cursor: 'pointer' } }, ['✕ Exit']);
  exitBtn.onclick = () => nav('hub');
  navRow.appendChild(exitBtn);
  sec.appendChild(navRow);

  if (!RS.generatedText) {
    sec.appendChild(el('div', { style: { color: '#64748b', padding: '24px', textAlign: 'center' } }, ['No report generated yet.']));
    return sec;
  }

  const report = RS.currentReport || {};
  const isFinalized = report.status === 'finalized';

  // Header
  sec.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 10px' } }, [
    el('h2', { style: { fontWeight: 800, color: '#0f172a', fontSize: '1.05rem', margin: 0 } }, ['📄 ' + (report.report_type || 'Report')]),
    statusBadge(report.status || 'generated')
  ]));

  // Report text — editable unless finalized
  const textArea = el('textarea', { style: { width: '100%', minHeight: '400px', padding: '16px', borderRadius: '14px', border: '1.5px solid #e8f4f2', fontSize: '.84rem', lineHeight: '1.7', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: isFinalized ? '#f8fafc' : '#fff' } });
  textArea.value = RS.generatedText;
  textArea.readOnly = isFinalized;
  textArea.oninput = () => { RS.generatedText = textArea.value; };
  sec.appendChild(textArea);

  // Actions
  const actions = el('div', { style: { display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' } });

  if (!isFinalized) {
    // Save edits
    actions.appendChild(mkBtn('💾 Save', 'btn-md btn-secondary', async () => {
      try {
        await _supa.from('reports').update({ generated_text: RS.generatedText, updated_at: new Date().toISOString() }).eq('id', RS.currentReport.id);
        toast('💾 Saved!');
      } catch (e) { toast('Could not save.', 'error'); }
    }));

    // Regenerate (max 3)
    if (RS.regenCount < 3) {
      actions.appendChild(mkBtn('🔄 Regenerate (' + (3 - RS.regenCount) + ' left)', 'btn-md btn-ghost', () => {
        RS.regenCount++;
        RS.step = 3; nav('new-report', 3);
      }));
    }

    // Finalize
    actions.appendChild(mkBtn('✅ Finalize', 'btn-md btn-primary', () => {
      openConfirm('Finalize Report?', 'Once finalized, the report cannot be edited. This action is permanent.', false, async () => {
        try {
          const { error } = await _supa.from('reports').update({
            generated_text: RS.generatedText, status: 'finalized',
            finalized_at: new Date().toISOString(), updated_at: new Date().toISOString()
          }).eq('id', RS.currentReport.id);
          if (error) throw error;
          RS.currentReport.status = 'finalized';
          RS.reportsLoaded = false;
          toast('✅ Report finalized!');
          H().re();
        } catch (e) { toast('Could not finalize.', 'error'); }
      });
    }));
  }

  sec.appendChild(actions);
  return sec;
}


// ════════════════════════════════════════
// INIT + ROUTING
// ════════════════════════════════════════
export function initReports() {
  injectStyles();
  console.log('[Huddledin] Reports v2 module initialized');
}

// ─── New template choice ───
function _showNewTemplateChoice() {
  const { el, mkBtn, openModal } = H();
  openModal('New Template', (mb, close) => {
    mb.appendChild(el('div', { style: { fontSize: '.88rem', color: '#475569', marginBottom: '16px' } }, ['How would you like to create your template?']));
    const opts = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    const opt1 = el('div', { class: 'rpt-card', style: { display: 'flex', alignItems: 'center', gap: '14px' } });
    opt1.appendChild(el('span', { style: { fontSize: '1.6rem' } }, ['📄']));
    const i1 = el('div', { style: { flex: 1 } });
    i1.appendChild(el('div', { style: { fontWeight: 700, color: '#0f172a' } }, ['Upload a Past Report']));
    i1.appendChild(el('div', { style: { fontSize: '.76rem', color: '#64748b' } }, ['AI analyzes your report and creates a template from it']));
    opt1.appendChild(i1);
    opt1.onclick = () => { close(); _startImport(); };
    opts.appendChild(opt1);
    const opt2 = el('div', { class: 'rpt-card', style: { display: 'flex', alignItems: 'center', gap: '14px' } });
    opt2.appendChild(el('span', { style: { fontSize: '1.6rem' } }, ['🔧']));
    const i2 = el('div', { style: { flex: 1 } });
    i2.appendChild(el('div', { style: { fontWeight: 700, color: '#0f172a' } }, ['Build From Scratch']));
    i2.appendChild(el('div', { style: { fontSize: '.76rem', color: '#64748b' } }, ['Pick sections from the library and customize']));
    opt2.appendChild(i2);
    opt2.onclick = () => { close(); RS.currentTemplate = null; nav('edit-template'); };
    opts.appendChild(opt2);
    mb.appendChild(opts);
  }, 400);
}

// ─── Import helper ───
function _startImport() {
  const { el, mkBtn, toast, openModal } = H();
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.pdf,.png,.jpg,.jpeg';
  inp.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    openModal('📄 Analyzing Report...', (mb, close) => {
      mb.appendChild(el('div', { style: { textAlign: 'center', padding: '20px' } }, [
        el('div', { style: { fontSize: '2rem', marginBottom: '10px' } }, ['⏳']),
        el('div', { style: { fontWeight: 600, color: '#0f172a' } }, ['AI is analyzing your report...']),
        el('div', { style: { fontSize: '.78rem', color: '#64748b', marginTop: '6px' } }, ['This may take up to a minute.'])
      ]));
      (async () => {
        try {
          const result = await importTemplate(file);
          close();
          const tpl = result.template;
          RS.importedTemplate = tpl;
          RS.importedOriginalText = result.originalText || '';
          // Match section titles to original text for highlight excerpts (client-side)
          if (RS.importedOriginalText && tpl.sections) {
            tpl.sections.forEach(s => {
              s.source_excerpt = _findExcerptForSection(s.title, RS.importedOriginalText);
            });
          }
          RS.currentTemplate = {
            name: tpl.name || 'Imported Template',
            description: tpl.description || 'Imported from ' + file.name,
            sections: (tpl.sections || []).map(s => s.id || s.title?.toLowerCase().replace(/[^a-z0-9]+/g, '_')),
            writing_style: tpl.writing_style || null,
            source: 'imported',
            _importedSections: tpl.sections || [],
          };
          nav('edit-template');
          toast('📄 Template extracted! Review and save.');
        } catch (err) {
          close();
          console.error(err);
          toast('Could not analyze document: ' + err.message, 'error');
        }
      })();
    }, 340);
  };
  document.body.appendChild(inp); inp.click(); inp.remove();
}

// Main render dispatcher (called from index.html glue)
function renderMain() {
  switch (RS.view) {
    case 'templates': return renderTemplates();
    case 'edit-template': return renderTemplateEditor();
    case 'new-report': return renderNewReport();
    case 'preview': return renderPreview();
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
