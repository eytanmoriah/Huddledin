// Reports Module v2 — Templates + Form + AI Generation + Import
import { SECTION_LIBRARY, getSectionsForSpecialty, getOtherSpecialtySections, getSectionById, loadTemplates, saveTemplate, deleteTemplate } from './templates.js';
import { renderForm } from './form-builder.js';
import { generateReport, importTemplate } from './ai-generator.js';
import { injectStyles } from './styles.js';
import { generatePDFBlob, parseReportText, stripInlineMarkdown, getSkippedPrefix, reconstructMarkdown } from './pdf-util.js';

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
  regenCount: 0,
  importedTemplate: null,
  returnToPatient: null,
  branding: null, // report_settings row
  brandingLoaded: false,
  brandingBannerDismissed: false,
};

const MONTHLY_LIMIT = 5;
const DEFAULT_BRANDING = { header_color: '#0d9488', font_style: 'sans-serif', header_style: 'compact', footer_text: 'Confidential — For Clinical Use Only' };

function H() { return window.HUD || {}; }

// Get section IDs from either format: array of strings OR {ids:[], imported:[]}
function _getSectionIds(sections) {
  if (!sections) return [];
  if (Array.isArray(sections)) return sections;
  return sections.ids || [];
}

function _getSectionCount(sections) {
  return _getSectionIds(sections).length;
}

function _buildCredentials(session) {
  const parts = [];
  if (session?.credentials_title) parts.push(session.credentials_title);
  if (session?.credentials_certs) parts.push(session.credentials_certs);
  if (session?.credentials_license) parts.push('Lic. ' + session.credentials_license);
  return parts.join(', ');
}

function _downloadBlob(blob, reportType, childName) {
  const name = (reportType || 'Report').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
  const child = (childName || 'Patient').replace(/\s+/g, '_');
  const date = new Date().toISOString().split('T')[0];
  const filename = name + '_' + child + '_' + date + '.pdf';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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

function nav(view, step) {
  RS.view = view; RS.step = step || 0; RS.dirty = false;
  // If going to 'hub' and we came from a patient tab, go back to patient context instead
  if (view === 'hub' && RS.returnToPatient) {
    const { S } = H();
    S.activeChild = RS.returnToPatient;
    S.activeTab = 'patient-reports';
    RS.returnToPatient = null;
  }
  H().re();
}

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
  if (!RS.brandingLoaded) {
    try {
      const { data } = await _supa.from('report_settings').select('*').eq('specialist_id', session.id).limit(1);
      RS.branding = data?.[0] || null;
      RS.brandingLoaded = true;
    } catch (e) { console.error('Load branding:', e); RS.brandingLoaded = true; }
  }
}

async function ensureBranding() {
  if (RS.brandingLoaded) return;
  const { _supa, session } = H();
  if (!_supa || !session) return;
  try {
    const { data } = await _supa.from('report_settings').select('*').eq('specialist_id', session.id).limit(1);
    RS.branding = data?.[0] || null;
    RS.brandingLoaded = true;
    console.log('[reports] Branding loaded on demand:', RS.branding?.practice_name || '(none)');
  } catch (e) { console.error('Load branding:', e); RS.brandingLoaded = true; }
}

function getBranding() {
  const result = { ...DEFAULT_BRANDING, ...(RS.branding || {}) };
  return result;
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
  hdrR.appendChild(mkBtn('⚙️', 'btn-sm btn-ghost', () => { const { S } = H(); S.activeTab = 'settings'; H().re(); }));
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
    const badges = el('div', { style: { display: 'flex', gap: '4px' } });
    badges.appendChild(statusBadge(r.status));
    if (r.shared_with_parents) badges.appendChild(el('span', { class: 'rpt-badge', style: { background: '#dbeafe', color: '#1e40af' } }, ['📤 Shared']));
    top.appendChild(badges);
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
    const nameRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' } });
    nameRow.appendChild(el('span', { style: { fontWeight: 700, color: '#0f172a' } }, [t.name]));
    if (t.name?.includes('(Draft)')) nameRow.appendChild(el('span', { class: 'rpt-badge rpt-badge-draft' }, ['Draft']));
    if (t.source === 'imported') nameRow.appendChild(el('span', { class: 'rpt-badge', style: { background: '#ede9fe', color: '#6d28d9' } }, ['Imported']));
    card.appendChild(nameRow);
    card.appendChild(el('div', { style: { fontSize: '.76rem', color: '#64748b', marginBottom: '8px' } }, [t.description || '']));
    const meta = el('div', { style: { fontSize: '.7rem', color: '#94a3b8' } });
    const secCount = _getSectionCount(t.sections);
    meta.textContent = secCount + ' section' + (secCount !== 1 ? 's' : '') + ' · Used ' + (t.use_count || 0) + ' time' + ((t.use_count || 0) !== 1 ? 's' : '');
    card.appendChild(meta);
    // Actions
    const acts = el('div', { style: { display: 'flex', gap: '8px', marginTop: '10px' } });
    const _copyTpl = () => ({ ...t, sections: JSON.parse(JSON.stringify(t.sections || [])) });
    acts.appendChild(mkBtn('Edit', 'btn-sm btn-ghost', (e) => { e.stopPropagation(); RS.currentTemplate = _copyTpl(); nav('edit-template'); }));
    acts.appendChild(mkBtn('Duplicate', 'btn-sm btn-ghost', async (e) => {
      e.stopPropagation();
      try {
        const clone = _copyTpl();
        delete clone.id;
        clone.name = (clone.name || 'Template') + ' (Copy)';
        clone.use_count = 0;
        const newId = await saveTemplate(clone);
        clone.id = newId;
        RS.currentTemplate = clone;
        RS.templatesLoaded = false;
        toast('📋 Template duplicated!');
        nav('edit-template');
      } catch (ex) { console.error(ex); toast('Could not duplicate.', 'error'); }
    }));
    acts.appendChild(mkBtn('Delete', 'btn-sm btn-ghost', (e) => {
      e.stopPropagation();
      openConfirm('Delete Template?', 'This cannot be undone.', true, async () => {
        await deleteTemplate(t.id); RS.templatesLoaded = false; await loadData(); H().re();
      });
    }));
    card.appendChild(acts);
    card.onclick = () => { RS.currentTemplate = _copyTpl(); nav('edit-template'); };
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
  back.onclick = async () => {
    // Auto-save imported templates as draft to prevent losing work
    if (!isEdit && RS.currentTemplate?.source === 'imported' && nameInp?.value?.trim()) {
      try {
        const tpl = RS.currentTemplate || {};
        tpl.name = nameInp.value.trim() + (tpl.name?.includes('(Draft)') ? '' : ' (Draft)');
        tpl.description = descInp?.value?.trim() || tpl.description || '';
        tpl.sections = { ids: [...selected], imported: importedSections.length ? importedSections : undefined };
        await saveTemplate(tpl);
        RS.templatesLoaded = false;
        toast('💾 Draft template saved');
      } catch (e) { console.error('Auto-save template:', e); }
    }
    nav(RS.templates.length ? 'templates' : 'hub');
  }; sec.appendChild(back);

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

  // Track selected section IDs — handle both old format (array) and new format ({ids, imported})
  const rawSections = RS.currentTemplate?.sections || [];
  const sectionIds = Array.isArray(rawSections) ? rawSections : (rawSections.ids || []);
  const selected = new Set(sectionIds.map(s => typeof s === 'string' ? s : s.id));
  // Imported section definitions: from current flow OR restored from saved template
  const importedSections = RS.currentTemplate?._importedSections || (Array.isArray(rawSections) ? [] : (rawSections.imported || []));
  // Restore original text from saved writing_style if not already in memory
  if (!RS.importedOriginalText && RS.currentTemplate?.writing_style?._originalText) {
    RS.importedOriginalText = RS.currentTemplate.writing_style._originalText;
  }
  const hasImportedText = !!(RS.importedOriginalText && (RS.currentTemplate?.source === 'imported' || importedSections.length > 0));
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
    // Hover/click highlight for imported templates
    if (hasImportedText && isWebView) {
      row.onmouseenter = () => _highlightSection(s.id, true);
      row.onmouseleave = () => _highlightSection(null, false);
      row.onclick = (e) => { if (e.target.tagName !== 'INPUT') _highlightSection(s.id, true); };
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
      // Save section IDs + imported section definitions (so they survive reload)
      tpl.sections = { ids: [...selected], imported: importedSections.length ? importedSections : undefined };
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
    // Right column — original report segmented by section for highlighting
    const rightCol = el('div', { style: { flex: 1, minWidth: 0, position: 'sticky', top: '60px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' } });
    rightCol.appendChild(el('div', { style: { fontWeight: 700, color: '#0f172a', fontSize: '.84rem', marginBottom: '8px' } }, ['📄 Original Report']));
    rightCol.appendChild(_buildSegmentedOriginal(RS.importedOriginalText, importedSections));
    splitWrap.appendChild(rightCol);
    sec.appendChild(splitWrap);
  } else {
    sec.appendChild(leftCol);
  }

  return sec;
}

// ── Import split-view highlight system ──
// Segments the original text into blocks tagged by section title.
// Each block in the right column gets a data-section-id for CSS targeting.

function _buildSegmentedOriginal(originalText, sectionTitles) {
  // Split original text into segments. Each segment starts where a section title appears.
  const { el } = H();
  const container = el('div', { id: 'rpt-import-original', style: { fontSize: '.8rem', lineHeight: '1.7', color: '#334155', padding: '14px', background: '#fff', borderRadius: '12px', border: '1px solid #e8f4f2', fontFamily: 'inherit' } });
  if (!originalText) return container;

  const lines = originalText.split('\n');
  const titleMap = {}; // line index → section id
  sectionTitles.forEach(s => {
    const tLow = s.title.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(tLow) && !titleMap[i]) {
        titleMap[i] = s.id;
        break;
      }
    }
  });

  // Build blocks: group consecutive lines under the same section
  let currentId = '_header';
  let blockLines = [];
  const flush = () => {
    if (!blockLines.length) return;
    const block = el('div', { 'data-rpt-section': currentId, style: { padding: '4px 6px', borderRadius: '6px', marginBottom: '2px', transition: 'background .15s', whiteSpace: 'pre-wrap' } });
    block.textContent = blockLines.join('\n');
    container.appendChild(block);
    blockLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    if (titleMap[i] && titleMap[i] !== currentId) {
      flush();
      currentId = titleMap[i];
    }
    blockLines.push(lines[i]);
  }
  flush();
  return container;
}

function _highlightSection(sectionId, on) {
  const container = document.getElementById('rpt-import-original');
  if (!container) return;
  container.querySelectorAll('[data-rpt-section]').forEach(b => { b.style.background = ''; });
  if (on && sectionId) {
    const block = container.querySelector('[data-rpt-section="' + sectionId + '"]');
    if (block) {
      block.style.background = '#ccfbf1';
      // Scroll within the right column only (its parent has overflow-y:auto)
      const scrollParent = container.parentElement;
      if (scrollParent) {
        const blockTop = block.offsetTop - container.offsetTop;
        const visible = blockTop >= scrollParent.scrollTop && blockTop <= scrollParent.scrollTop + scrollParent.clientHeight - 60;
        if (!visible) scrollParent.scrollTo({ top: Math.max(0, blockTop - 40), behavior: 'smooth' });
      }
    }
  }
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
      card.appendChild(el('div', { style: { fontSize: '.76rem', color: '#64748b' } }, [_getSectionCount(t.sections) + ' sections']));
      card.onclick = () => { RS.currentTemplate = t; RS.selectedSections = [..._getSectionIds(t.sections)]; RS.step = 2; H().re(); };
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
    const specInfo = { name: session?.displayName || session?.name || '—', specialty: session?.profession || '—', credentials: _buildCredentials(session) };
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
        const sectionTitles = activeSections.map(id => getSectionById(id)?.title).filter(Boolean);
        // Send writing style WITHOUT _originalText (it's huge and makes AI write in the wrong language)
        let wsForAI = null;
        if (RS.currentTemplate?.writing_style) {
          const { _originalText, ...styleOnly } = RS.currentTemplate.writing_style;
          if (styleOnly.tone || styleOnly.characteristics?.length) wsForAI = JSON.stringify(styleOnly);
        }
        const text = await generateReport({
          reportType: tplName,
          formData: RS.formData,
          childInfo, specialistInfo: specInfo,
          writingStyle: wsForAI,
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
    try { await _supa.from('report_templates').update({ use_count: (RS.currentTemplate.use_count || 0) + 1 }).eq('id', RS.currentTemplate.id); } catch(e) {}
  }
}

// Share finalized report with parents — uploads to specialist's shared folder, sends notifications
async function _shareReportWithParents(report, generatedText, _supa, session) {
  const { DB, SB } = H();
  const childId = report.child_id;
  const children = getChildren();
  const child = children.find(c => c.id === childId);
  if (!child) throw new Error('Child not found');

  const folderKey = 'spec_' + session.id;
  const specName = session.displayName || session.name || 'Specialist';
  const childInfo = { name: child.name, dob: child.dob, age: calcAge(child.dob) };
  const specInfo = { name: specName, specialty: session.profession || '', credentials: session.credentials_title || '' };

  // Ensure branding is loaded before PDF generation
  await ensureBranding();
  console.log('[share] Generating PDF...');
  const pdfBlob = await generatePDFBlob(generatedText, report.report_type, childInfo, specInfo, getBranding());
  const fileName = (report.report_type || 'Report').replace(/[^a-zA-Z0-9\u0590-\u05FF ._-]/g, '').replace(/\s+/g, '_') + '_' + (child.name || '').replace(/\s+/g, '_') + '_' + new Date().toISOString().split('T')[0] + '.pdf';
  console.log('[share] PDF generated:', pdfBlob.size, 'bytes');

  // Upload PDF to huddledin-files bucket
  const storagePath = childId + '/' + Date.now() + '_' + fileName;
  const { error: upErr } = await _supa.storage.from('huddledin-files').upload(storagePath, pdfBlob, { contentType: 'application/pdf', upsert: false });
  if (upErr) { console.error('[share] Upload error:', upErr); throw new Error('Upload failed: ' + upErr.message); }
  console.log('[share] Upload OK');

  // Insert file record into the specialist's shared folder
  const { data: fileData, error: fileErr } = await _supa.from('files').insert({
    child_id: childId, uploaded_by: session.id,
    name: fileName, storage_path: storagePath,
    mime_type: 'application/pdf', size_bytes: pdfBlob.size,
    category: folderKey, shared_with: []
  }).select('id').single();
  if (fileErr) { console.error('[share] File record error:', fileErr.message, fileErr.details); throw new Error('File record failed: ' + fileErr.message); }
  console.log('[share] File record created:', fileData?.id);

  // Mark report as shared
  const { error: rptErr } = await _supa.from('reports').update({
    shared_with_parents: true, shared_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }).eq('id', report.id);
  if (rptErr) console.error('Report share update error:', rptErr);

  // Notify parents in household
  const hid = child.householdId || child.household_id;
  if (hid && session.id !== 'demo') {
    try {
      const { data: members } = await _supa.from('profiles').select('id,role').eq('household_id', hid);
      const parents = (members || []).filter(m => m.role === 'parent');
      const specName = session.displayName || session.name || 'Specialist';
      for (const p of parents) {
        try {
          await _supa.from('notifications').insert({
            id: 'n_op_' + Date.now() + '_' + p.id,
            user_id: p.id, child_id: childId,
            type: 'report',
            message: '📋 ' + specName + ' shared a report for ' + (child.name || 'your child'),
            read: false, link_tab: 'files'
          });
        } catch (e) { console.error('Notify parent:', e); }
      }
    } catch (e) { console.error('Load household:', e); }
  }
}

// ════════════════════════════════════════
// FORMATTED REPORT HTML RENDERER
// ════════════════════════════════════════
function renderFormattedReport(text, branding, childInfo, specialistInfo, reportType, opts) {
  const { el } = H();
  const { editable, onUpdate, onFlushRef } = opts || {};
  const brand = branding || {};
  const hColor = brand.header_color || '#0d9488';
  const blocks = parseReportText(text);
  const skippedPrefix = editable ? getSkippedPrefix(text) : '';

  const outerWrap = el('div', { style: { background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' } });

  // ── Header area ──
  const header = el('div', { style: { padding: '24px 24px 16px', borderBottom: '2px solid ' + hColor, textAlign: 'center' } });

  if (brand.logo_storage_path) {
    const logoImg = el('img', { style: { maxHeight: '48px', maxWidth: '180px', objectFit: 'contain', marginBottom: '8px', display: 'block', marginInline: 'auto' } });
    (async () => {
      try {
        const _supa = H()._supa;
        if (!_supa) return;
        const { data } = await _supa.storage.from('specialist-storage').createSignedUrl(brand.logo_storage_path, 120);
        if (data?.signedUrl) logoImg.src = data.signedUrl;
      } catch (e) { console.error('[preview] Logo load:', e); }
    })();
    header.appendChild(logoImg);
  }

  header.appendChild(el('div', { style: { fontSize: '1.2rem', fontWeight: 800, color: hColor } }, [brand.practice_name || 'Huddledin']));
  const details = [brand.practice_address, brand.practice_phone, brand.practice_email].filter(Boolean);
  if (details.length) header.appendChild(el('div', { style: { fontSize: '.75rem', color: '#64748b', marginTop: '4px' } }, [details.join(' \u00B7 ')]));
  header.appendChild(el('div', { style: { fontSize: '.95rem', color: '#1e293b', marginTop: '6px' } }, [reportType || 'Clinical Report']));
  outerWrap.appendChild(header);

  // ── Patient info ──
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const infoGrid = el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px', padding: '12px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '.8rem', color: '#475569' } });
  [['Patient', childInfo?.name || '\u2014'], ['DOB', childInfo?.dob || '\u2014'],
   ['Age', childInfo?.age || '\u2014'], ['Date', date],
   ['Specialist', (specialistInfo?.name || '\u2014') + (specialistInfo?.credentials ? ', ' + specialistInfo.credentials : '')],
   ['Specialty', specialistInfo?.specialty || '\u2014']
  ].forEach(([label, value]) => {
    const row = el('div', { style: { padding: '2px 0' } });
    row.appendChild(el('span', { style: { fontWeight: 600, color: '#334155' } }, [label + ': ']));
    row.appendChild(el('span', {}, [value]));
    infoGrid.appendChild(row);
  });
  outerWrap.appendChild(infoGrid);

  // ── Helper: create a formatted block element ──
  function mkBlock(b) {
    switch (b.type) {
      case 'spacer': return el('div', { style: { height: '8px' } });
      case 'hr': return el('hr', { style: { border: 'none', borderTop: '1px solid #e2e8f0', margin: '12px 0' } });
      case 'header': {
        const fs = b.level === 1 ? '1.05rem' : b.level === 2 ? '.95rem' : '.88rem';
        return el('div', { style: { fontSize: fs, fontWeight: 700, color: hColor, marginTop: '16px', marginBottom: '6px', paddingBottom: b.level <= 2 ? '4px' : '0', borderBottom: b.level <= 2 ? '1px solid #e8f4f2' : 'none' } }, [b.text]);
      }
      case 'subheader':
        return el('div', { style: { fontWeight: 700, color: '#334155', fontSize: '.86rem', marginTop: '10px', marginBottom: '4px' } }, [b.text]);
      case 'bullet': {
        const li = el('div', { style: { display: 'flex', gap: '8px', paddingInlineStart: '12px', marginBottom: '2px' } });
        li.appendChild(el('span', { style: { color: '#94a3b8', flexShrink: 0 } }, ['\u2022']));
        li.appendChild(el('span', {}, [b.text]));
        return li;
      }
      case 'numbered': {
        const ni = el('div', { style: { display: 'flex', gap: '8px', paddingInlineStart: '12px', marginBottom: '2px' } });
        ni.appendChild(el('span', { style: { color: '#64748b', flexShrink: 0, fontWeight: 600, minWidth: '18px' } }, [b.num + '.']));
        ni.appendChild(el('span', {}, [b.text]));
        return ni;
      }
      default: return el('p', { style: { margin: '0 0 6px' } }, [b.text]);
    }
  }

  // ── Report body ──
  const body = el('div', { style: { padding: '20px 24px', lineHeight: '1.75', fontSize: '.86rem', color: '#1e293b' } });

  // Track active edit so it can be flushed synchronously before save
  let _activeFinish = null;
  if (editable) {
    const hint = el('div', { style: { fontSize: '.72rem', color: '#94a3b8', marginBottom: '10px', textAlign: 'center' } }, ['Double-click any section to edit']);
    body.appendChild(hint);
    // Expose flush function: commits any in-progress inline edit immediately
    if (onFlushRef) onFlushRef(() => { if (_activeFinish) _activeFinish(); });
  }

  blocks.forEach(block => {
    // Non-editable blocks (spacers, HRs) or read-only mode
    if (!editable || block.rawText === undefined) {
      body.appendChild(mkBlock(block));
      return;
    }

    // Editable wrapper
    const bw = el('div', { style: { borderRadius: '6px', transition: 'background .15s, box-shadow .15s', cursor: 'pointer', padding: '2px 4px', margin: '-2px -4px' } });
    bw.appendChild(mkBlock(block));
    bw._editing = false;

    bw.addEventListener('mouseenter', () => { if (!bw._editing) bw.style.background = '#f0fdf9'; });
    bw.addEventListener('mouseleave', () => { if (!bw._editing) { bw.style.background = ''; bw.style.boxShadow = ''; } });

    bw.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (bw._editing) return;
      bw._editing = true;
      bw.style.background = '';
      bw.style.cursor = '';
      bw.innerHTML = '';
      bw.style.position = 'relative';

      const ta = document.createElement('textarea');
      ta.value = block.rawText;
      Object.assign(ta.style, {
        width: '100%', padding: '8px 34px 8px 10px', border: '1.5px solid ' + hColor,
        borderRadius: '8px', fontSize: 'inherit', lineHeight: 'inherit',
        fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box',
        minHeight: '36px', outline: 'none', background: '#fafffe', display: 'block'
      });
      bw.appendChild(ta);

      const doneBtn = document.createElement('button');
      doneBtn.textContent = '\u2713';
      Object.assign(doneBtn.style, {
        position: 'absolute', insetInlineEnd: '8px', top: '8px',
        background: hColor, color: '#fff', border: 'none', borderRadius: '50%',
        width: '24px', height: '24px', fontSize: '.8rem', cursor: 'pointer',
        lineHeight: '24px', textAlign: 'center', flexShrink: '0'
      });
      bw.appendChild(doneBtn);

      const autoSize = () => { ta.style.height = 'auto'; ta.style.height = Math.max(36, ta.scrollHeight) + 'px'; };
      ta.addEventListener('input', autoSize);
      requestAnimationFrame(() => { ta.focus(); autoSize(); });

      const finish = () => {
        if (!bw._editing) return;
        bw._editing = false;
        _activeFinish = null;
        const newVal = ta.value.trim();
        if (newVal !== block.rawText) {
          block.rawText = newVal;
          block.text = stripInlineMarkdown(newVal);
          if (onUpdate) onUpdate(reconstructMarkdown(blocks, skippedPrefix));
        }
        bw.innerHTML = '';
        bw.style.position = '';
        bw.style.cursor = 'pointer';
        bw.appendChild(mkBlock(block));
      };

      _activeFinish = finish;
      doneBtn.onclick = (e) => { e.stopPropagation(); finish(); };
      ta.addEventListener('blur', () => setTimeout(finish, 180));
      ta.addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(); });
    });

    body.appendChild(bw);
  });
  outerWrap.appendChild(body);

  // ── Footer ──
  const footerText = brand.footer_text !== undefined ? brand.footer_text : 'Confidential \u2014 For Clinical Use Only';
  if (footerText) {
    const footer = el('div', { style: { padding: '10px 24px', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '.7rem', color: '#94a3b8' } });
    footer.appendChild(el('span', {}, [footerText + ' \u00B7 ' + date]));
    outerWrap.appendChild(footer);
  }

  return outerWrap;
}

// Generate print HTML from formatted blocks
function _buildPrintHTML(text, branding, childInfo, specialistInfo, reportType) {
  const brand = branding || {};
  const hColor = brand.header_color || '#0d9488';
  const blocks = parseReportText(text);
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const footerText = brand.footer_text !== undefined ? brand.footer_text : 'Confidential \u2014 For Clinical Use Only';

  let html = `<html><head><title>${(reportType || 'Report')} \u2014 ${childInfo?.name || 'Patient'}</title>
<style>
body{font-family:-apple-system,system-ui,sans-serif;max-width:700px;margin:0 auto;line-height:1.75;color:#1e293b;font-size:11pt;}
.hdr{text-align:center;padding-bottom:12px;border-bottom:2px solid ${hColor};margin-bottom:16px;}
.hdr .name{font-size:16pt;font-weight:800;color:${hColor};}
.hdr .details{font-size:8pt;color:#64748b;margin-top:2px;}
.hdr .rtype{font-size:11pt;color:#1e293b;margin-top:4px;}
.info{display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;padding:8px 0 12px;border-bottom:1px solid #e2e8f0;font-size:9pt;color:#475569;margin-bottom:14px;}
.info b{color:#334155;}
h2{font-size:12pt;font-weight:700;color:${hColor};margin:16px 0 6px;padding-bottom:3px;border-bottom:1px solid #e8f4f2;}
h3{font-size:11pt;font-weight:700;color:${hColor};margin:12px 0 4px;}
h4{font-size:10pt;font-weight:700;color:#334155;margin:10px 0 4px;}
hr{border:none;border-top:1px solid #e2e8f0;margin:10px 0;}
ul,ol{margin:4px 0 8px 20px;padding:0;}
li{margin-bottom:2px;}
p{margin:0 0 6px;}
.footer{text-align:center;font-size:7pt;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px;margin-top:20px;}
@media print{body{margin:0;padding:15mm;max-width:none;}}
</style></head><body>`;

  // Header
  html += '<div class="hdr">';
  html += `<div class="name">${esc(brand.practice_name || 'Huddledin')}</div>`;
  const dets = [brand.practice_address, brand.practice_phone, brand.practice_email].filter(Boolean);
  if (dets.length) html += `<div class="details">${esc(dets.join(' · '))}</div>`;
  html += `<div class="rtype">${esc(reportType || 'Clinical Report')}</div>`;
  html += '</div>';

  // Patient info
  html += '<div class="info">';
  const items = [
    ['Patient', childInfo?.name], ['DOB', childInfo?.dob],
    ['Age', childInfo?.age], ['Date', date],
    ['Specialist', (specialistInfo?.name || '') + (specialistInfo?.credentials ? ', ' + specialistInfo.credentials : '')],
    ['Specialty', specialistInfo?.specialty],
  ];
  items.forEach(([l, v]) => { html += `<div><b>${l}:</b> ${esc(v || '\u2014')}</div>`; });
  html += '</div>';

  // Body
  blocks.forEach(b => {
    switch (b.type) {
      case 'spacer': html += '<br>'; break;
      case 'hr': html += '<hr>'; break;
      case 'header': {
        const tag = b.level === 1 ? 'h2' : b.level === 2 ? 'h2' : b.level === 3 ? 'h3' : 'h4';
        html += `<${tag}>${esc(b.text)}</${tag}>`; break;
      }
      case 'subheader': html += `<h4>${esc(b.text)}</h4>`; break;
      case 'bullet': html += `<ul><li>${esc(b.text)}</li></ul>`; break;
      case 'numbered': html += `<ol start="${b.num}"><li>${esc(b.text)}</li></ol>`; break;
      case 'paragraph': default: html += `<p>${esc(b.text)}</p>`; break;
    }
  });

  if (footerText) html += `<div class="footer">${esc(footerText)} · ${date}</div>`;
  html += '</body></html>';
  return html;
}

function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ════════════════════════════════════════
// REPORT PREVIEW
// ════════════════════════════════════════
function renderPreview() {
  injectStyles();
  const { el, mkBtn, toast, session, _supa, openConfirm } = H();
  const sec = document.createElement('div'); sec.className = 'section';
  const report = RS.currentReport || {};
  const isFinalized = report.status === 'finalized';

  // ── FINALIZED: clean read-only view ──
  if (isFinalized) {
    const navRow = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: '0', zIndex: 10, background: '#f0fdf9', padding: '10px 0' } });
    const back = el('span', { style: { color: '#0d9488', cursor: 'pointer', fontWeight: 600, fontSize: '.84rem' } }, ['← Back to Reports']);
    back.onclick = () => nav('hub');
    navRow.appendChild(back);
    sec.appendChild(navRow);

    // Header with badge
    sec.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 10px' } }, [
      el('h2', { style: { fontWeight: 800, color: '#0f172a', fontSize: '1.05rem', margin: 0 } }, ['📄 ' + (report.report_type || 'Report')]),
      statusBadge('finalized')
    ]));

    // Finalized date
    if (report.finalized_at) {
      sec.appendChild(el('div', { style: { fontSize: '.76rem', color: '#64748b', marginBottom: '12px' } }, [
        '🔒 Finalized on ' + new Date(report.finalized_at).toLocaleDateString()
      ]));
    }

    // Formatted report view
    const children = getChildren();
    const child = children.find(c => c.id === report.child_id);
    const ci = { name: child?.name || 'Patient', dob: child?.dob || '', age: calcAge(child?.dob) };
    const si = { name: session?.displayName || session?.name || '', specialty: session?.profession || '', credentials: _buildCredentials(session) };
    sec.appendChild(renderFormattedReport(RS.generatedText, getBranding(), ci, si, report.report_type));

    // Shared status
    if (report.shared_with_parents) {
      sec.appendChild(el('div', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#d1fae5', borderRadius: '8px', fontSize: '.78rem', fontWeight: 600, color: '#065f46', marginBottom: '12px' } }, [
        '✅ Shared with parents' + (report.shared_at ? ' · ' + new Date(report.shared_at).toLocaleDateString() : '')
      ]));
    }

    // Actions
    const actions = el('div', { style: { display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' } });

    // Share with parents (if not already shared)
    if (!report.shared_with_parents) {
      actions.appendChild(mkBtn('📤 Share with Parents', 'btn-md btn-primary', () => {
        openConfirm('Share Report?', 'This will upload the report as a PDF to the child\'s shared files and notify both parents. Continue?', false, async () => {
          try {
            await _shareReportWithParents(report, RS.generatedText, _supa, session);
            report.shared_with_parents = true;
            report.shared_at = new Date().toISOString();
            RS.reportsLoaded = false;
            toast('📤 Report shared with parents!');
            H().re();
          } catch (e) { console.error(e); toast('Could not share: ' + e.message, 'error'); }
        });
      }));
    }

    // Download PDF
    actions.appendChild(mkBtn('📥 Download PDF', 'btn-md btn-secondary', async () => {
      try {
        await ensureBranding();
        const children = getChildren();
        const child = children.find(c => c.id === report.child_id);
        const ci = { name: child?.name || 'Patient', dob: child?.dob || '', age: calcAge(child?.dob) };
        const si = { name: session?.displayName || session?.name || '', specialty: session?.profession || '', credentials: _buildCredentials(session) };
        const blob = await generatePDFBlob(RS.generatedText, report.report_type, ci, si, getBranding());
        _downloadBlob(blob, report.report_type, child?.name);
        toast('📥 PDF downloaded!');
      } catch (e) { console.error(e); toast('PDF failed: ' + e.message, 'error'); }
    }));

    // Print
    actions.appendChild(mkBtn('🖨 Print', 'btn-md btn-ghost', () => {
      const w = window.open('', '_blank');
      w.document.write(_buildPrintHTML(RS.generatedText, getBranding(), ci, si, report.report_type));
      w.document.close();
      w.print();
    }));

    actions.appendChild(mkBtn('← Reports', 'btn-md btn-ghost', () => nav('hub')));
    sec.appendChild(actions);
    return sec;
  }

  // ── EDITABLE: generated but not finalized ──
  // Branding nudge — show once if no branding configured
  const br = getBranding();
  if (!RS.brandingBannerDismissed && !RS.branding?.practice_name && !RS.branding?.logo_storage_path) {
    const nudge = el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', marginBottom: '10px', fontSize: '.8rem' } });
    nudge.appendChild(el('span', {}, ['✨ Add your practice logo and branding to personalize your reports.']));
    const nudgeLink = el('span', { style: { color: '#0d9488', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' } }, ['Settings →']);
    nudgeLink.onclick = () => { const { S } = H(); S.activeTab = 'settings'; H().re(); };
    nudge.appendChild(nudgeLink);
    const dismiss = el('button', { style: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem', flexShrink: 0 } }, ['✕']);
    dismiss.onclick = () => { RS.brandingBannerDismissed = true; nudge.remove(); };
    nudge.appendChild(dismiss);
    sec.appendChild(nudge);
  }

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

  // Title row with badge
  sec.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 10px' } }, [
    el('h2', { style: { fontWeight: 800, color: '#0f172a', fontSize: '1.05rem', margin: 0 } }, ['📄 ' + (report.report_type || 'Report')]),
    statusBadge(report.status || 'generated')
  ]));

  // Build child/specialist info for preview
  const eChildren = getChildren();
  const eChild = eChildren.find(c => c.id === RS.selectedChildId);
  const eCi = { name: eChild?.name || 'Patient', dob: eChild?.dob || '', age: calcAge(eChild?.dob) };
  const eSi = { name: session?.displayName || session?.name || '', specialty: session?.profession || '', credentials: _buildCredentials(session) };

  // Formatted report with inline editing
  let _flushEdit = null; // called before save to commit any active inline edit
  sec.appendChild(renderFormattedReport(RS.generatedText, getBranding(), eCi, eSi, report.report_type, {
    editable: true,
    onUpdate: (newText) => { RS.generatedText = newText; },
    onFlushRef: (fn) => { _flushEdit = fn; }
  }));

  const actions = el('div', { style: { display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' } });

  actions.appendChild(mkBtn('💾 Save', 'btn-md btn-secondary', async () => {
    try {
      if (_flushEdit) _flushEdit(); // commit any active inline edit
      await _supa.from('reports').update({ generated_text: RS.generatedText, updated_at: new Date().toISOString() }).eq('id', RS.currentReport.id);
      toast('💾 Saved!');
    } catch (e) { toast('Could not save.', 'error'); }
  }));

  if (RS.regenCount < 3) {
    actions.appendChild(mkBtn('🔄 Regenerate (' + (3 - RS.regenCount) + ' left)', 'btn-md btn-ghost', () => {
      RS.regenCount++;
      RS.step = 3; nav('new-report', 3);
    }));
  }

  actions.appendChild(mkBtn('📥 Download PDF', 'btn-md btn-ghost', async () => {
    try {
      if (_flushEdit) _flushEdit(); // commit any active inline edit
      await ensureBranding();
      const children = getChildren();
      const child = children.find(c => c.id === RS.selectedChildId);
      const ci = { name: child?.name || 'Patient', dob: child?.dob || '', age: calcAge(child?.dob) };
      const si = { name: session?.displayName || session?.name || '', specialty: session?.profession || '', credentials: _buildCredentials(session) };
      const blob = await generatePDFBlob(RS.generatedText, report.report_type, ci, si, getBranding());
      _downloadBlob(blob, report.report_type, child?.name);
      toast('📥 PDF downloaded!');
    } catch (e) { console.error(e); toast('PDF failed: ' + e.message, 'error'); }
  }));

  actions.appendChild(mkBtn('✅ Finalize', 'btn-md btn-primary', () => {
    if (_flushEdit) _flushEdit(); // commit any active inline edit
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
  inp.accept = '.pdf,.docx,.png,.jpg,.jpeg';
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
          // Section IDs assigned for highlight mapping (matched in _buildSegmentedOriginal)
          const sectionIds = (tpl.sections || []).map(s => s.id || s.title?.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
          // Ensure each imported section has an id
          (tpl.sections || []).forEach(s => { if (!s.id) s.id = s.title?.toLowerCase().replace(/[^a-z0-9]+/g, '_'); });
          // Bundle original text into writing_style for persistence
          const wsData = tpl.writing_style || {};
          wsData._originalText = result.originalText || '';
          RS.currentTemplate = {
            name: (tpl.name || 'Imported Template') + ' (Draft)',
            description: tpl.description || 'Imported from ' + file.name,
            sections: { ids: sectionIds, imported: tpl.sections || [] },
            writing_style: wsData,
            source: 'imported',
            _importedSections: tpl.sections || [],
          };
          // Auto-save as draft immediately so work isn't lost
          try {
            const id = await saveTemplate(RS.currentTemplate);
            RS.currentTemplate.id = id;
            RS.templatesLoaded = false;
            console.log('[import] Auto-saved draft template:', id);
          } catch (e) { console.error('[import] Auto-save failed:', e); }
          nav('edit-template');
          toast('📄 Template extracted! Review and edit.');
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

// ════════════════════════════════════════
// PATIENT REPORTS TAB (filtered by child)
// ════════════════════════════════════════
function renderPatientReports() {
  injectStyles();
  const { el, mkBtn, toast, session, _supa, _hasSpecAiAccess, _showSpecAiUpgradeModal, S } = H();
  const sec = document.createElement('div'); sec.className = 'section';
  const childId = S.activeChild;

  // Lock gate
  if (!_hasSpecAiAccess()) {
    sec.appendChild(el('div', { class: 'empty-state' }, [
      el('span', { class: 'empty-state-icon' }, ['📋']),
      el('div', { class: 'empty-state-title' }, ['🔒 Reports']),
      el('div', { class: 'empty-state-body' }, ['Generate professional clinical reports with AI. Unlock with AI subscription.']),
      el('div', { class: 'empty-state-actions' }, [mkBtn('✨ Unlock Reports', 'btn-md btn-primary', () => _showSpecAiUpgradeModal('Reports'))])
    ]));
    return sec;
  }

  if (!RS.reportsLoaded || !RS.templatesLoaded) {
    sec.appendChild(el('div', { style: { textAlign: 'center', padding: '24px', color: '#64748b' } }, ['Loading...']));
    loadData().then(() => H().re());
    return sec;
  }

  const children = getChildren();
  const child = children.find(c => c.id === childId);
  const childReports = RS.reports.filter(r => r.child_id === childId);

  // Header
  const hdr = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' } });
  hdr.appendChild(el('h2', { style: { fontWeight: 800, color: '#0f172a', fontSize: '1rem', margin: 0 } }, ['📋 Reports']));
  hdr.appendChild(mkBtn('+ New Report', 'btn-sm btn-primary', () => {
    if (RS.monthlyCount >= MONTHLY_LIMIT) { toast('Monthly limit reached (5/5).', 'error'); return; }
    RS.selectedChildId = childId;
    RS.returnToPatient = childId;
    RS.currentTemplate = null; RS.selectedSections = []; RS.formData = {};
    RS.currentReport = null; RS.lastSavedFormData = null;
    // Skip patient picker — go straight to template selection
    RS.step = RS.templates.length ? 1 : 0;
    S.activeTab = 'reports';
    nav('new-report', RS.step);
  }));
  sec.appendChild(hdr);

  // Empty state
  if (!childReports.length) {
    sec.appendChild(el('div', { class: 'empty-state', style: { marginTop: '8px' } }, [
      el('span', { class: 'empty-state-icon' }, ['📋']),
      el('div', { class: 'empty-state-title' }, ['No reports yet']),
      el('div', { class: 'empty-state-body' }, ['Create your first report for ' + (child?.name || 'this patient') + '.'])
    ]));
    return sec;
  }

  // Report list
  childReports.forEach(r => {
    const card = el('div', { class: 'rpt-card' });
    const top = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' } });
    top.appendChild(el('div', { style: { fontWeight: 700, color: '#0f172a', fontSize: '.88rem' } }, [r.report_type || 'Report']));
    const badges = el('div', { style: { display: 'flex', gap: '4px' } });
    badges.appendChild(statusBadge(r.status));
    if (r.shared_with_parents) badges.appendChild(el('span', { class: 'rpt-badge', style: { background: '#dbeafe', color: '#1e40af' } }, ['📤 Shared']));
    top.appendChild(badges);
    card.appendChild(top);
    card.appendChild(el('div', { style: { fontSize: '.76rem', color: '#64748b' } }, [r.created_at ? new Date(r.created_at).toLocaleDateString() : '']));
    card.onclick = () => {
      RS.currentReport = r; RS.selectedChildId = r.child_id;
      RS.returnToPatient = childId;
      RS.formData = r.form_data ? JSON.parse(JSON.stringify(r.form_data)) : {};
      RS.lastSavedFormData = JSON.parse(JSON.stringify(RS.formData));
      RS.selectedSections = _getSectionIds(r.sections_included);
      RS.generatedText = r.generated_text || null;
      RS.regenCount = 0;
      S.activeTab = 'reports';
      if (r.status === 'generated' || r.status === 'finalized') { nav('preview'); }
      else { RS.step = 3; nav('new-report', 3); }
    };
    sec.appendChild(card);
  });

  return sec;
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
  renderPatientReports,
  renderTemplates,
  renderTemplateEditor,
  renderNewReport,
  initReports,
  RS,
};
