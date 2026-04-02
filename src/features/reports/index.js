// Reports Module — main entry point
import { TEMPLATES, getTemplate } from './templates.js';
import { buildForm, collectFormData } from './form-builder.js';
import { generateReport } from './ai-generator.js';
import { downloadReportPDF } from './pdf-export.js';
import { injectStyles } from './styles.js';

// State (module-local, survives re-renders until page refresh)
const RS = {
  selectedChildId: null,
  selectedTemplate: null,
  formState: {},
  generatedText: null,
  currentReportId: null,
  reports: [],
  reportsLoaded: false,
  monthlyCount: 0,
};

const MONTHLY_LIMIT = 5;

// ─── Helpers ───
function getHUD() {
  return window.HUD || {};
}

function calcAge(dob) {
  if (!dob) return '';
  const b = new Date(dob), now = new Date();
  let y = now.getFullYear() - b.getFullYear(), m = now.getMonth() - b.getMonth();
  if (m < 0) { y--; m += 12; }
  return y + (y === 1 ? ' year' : ' years') + (m ? ' ' + m + (m === 1 ? ' month' : ' months') : '');
}

function statusBadge(status) {
  const { el } = getHUD();
  const cls = status === 'finalized' ? 'rpt-badge-finalized' : status === 'generated' ? 'rpt-badge-generated' : 'rpt-badge-draft';
  const label = status === 'finalized' ? '✅ Finalized' : status === 'generated' ? '📄 Generated' : '✏️ Draft';
  return el('span', { class: 'rpt-badge ' + cls }, [label]);
}

async function loadReports() {
  const { _supa, session } = getHUD();
  if (!_supa || !session) return;
  try {
    const { data } = await _supa.from('reports').select('*').eq('specialist_id', session.id).order('created_at', { ascending: false });
    RS.reports = data || [];
    // Count this month's reports
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    RS.monthlyCount = RS.reports.filter(r => r.created_at >= monthStart).length;
    RS.reportsLoaded = true;
  } catch (e) { console.error('Load reports:', e); }
}

// ─── Reports Hub ───
export function renderReports() {
  injectStyles();
  const { el, mkBtn, toast, session, _supa, _hasSpecAiAccess, _showSpecAiUpgradeModal, DB, T } = getHUD();
  const sec = document.createElement('div');
  sec.className = 'section';

  // Lock gate
  if (!_hasSpecAiAccess()) {
    sec.appendChild(el('div', { class: 'empty-state' }, [
      el('span', { class: 'empty-state-icon' }, ['📋']),
      el('div', { class: 'empty-state-title' }, ['🔒 Reports']),
      el('div', { class: 'empty-state-body' }, ['Generate professional clinical reports with AI. Unlock with AI subscription.']),
      el('div', { class: 'empty-state-actions' }, [
        mkBtn('✨ Unlock Reports', 'btn-md btn-primary', () => _showSpecAiUpgradeModal('Reports'))
      ])
    ]));
    return sec;
  }

  // Header
  const hdr = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' } });
  hdr.appendChild(el('h2', { class: 'page-title', style: { margin: 0 } }, ['📋 Reports']));
  const hdrRight = el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } });
  hdrRight.appendChild(el('span', { class: 'rpt-counter' }, [RS.monthlyCount + ' / ' + MONTHLY_LIMIT + ' this month']));
  hdrRight.appendChild(mkBtn('+ New Report', 'btn-sm btn-primary', () => {
    if (RS.monthlyCount >= MONTHLY_LIMIT) {
      toast('Monthly report limit reached (5/5). Upgrade for more.', 'error');
      return;
    }
    RS.selectedChildId = null;
    RS.selectedTemplate = null;
    RS.formState = {};
    RS.generatedText = null;
    RS.currentReportId = null;
    const { S, re } = getHUD();
    S.activeTab = 'report-form';
    re();
  }));
  hdr.appendChild(hdrRight);
  sec.appendChild(hdr);

  // Load reports
  if (!RS.reportsLoaded) {
    sec.appendChild(el('div', { style: { textAlign: 'center', padding: '24px', color: '#64748b' } }, ['Loading reports...']));
    loadReports().then(() => { const { re } = getHUD(); re(); });
    return sec;
  }

  // Empty state
  if (!RS.reports.length) {
    sec.appendChild(el('div', { class: 'empty-state' }, [
      el('span', { class: 'empty-state-icon' }, ['📋']),
      el('div', { class: 'empty-state-title' }, ['No reports yet']),
      el('div', { class: 'empty-state-body' }, ['Create your first professional clinical report.']),
      el('div', { class: 'empty-state-actions' }, [
        mkBtn('+ New Report', 'btn-md btn-primary', () => {
          RS.selectedChildId = null; RS.selectedTemplate = null; RS.formState = {};
          const { S, re } = getHUD(); S.activeTab = 'report-form'; re();
        })
      ])
    ]));
    return sec;
  }

  // Report list
  const children = DB.children.concat(window.HUD.LS?.get?.('children', []) || []);
  RS.reports.forEach(r => {
    const child = children.find(c => c.id === r.child_id);
    const card = el('div', { class: 'rpt-hub-card' });
    const top = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' } });
    top.appendChild(el('div', { style: { fontWeight: 700, color: '#0f172a', fontSize: '.88rem' } }, [
      (child?.avatar || '🧒') + ' ' + (child?.name || 'Patient') + ' — ' + (r.report_type || 'Report')
    ]));
    top.appendChild(statusBadge(r.status));
    card.appendChild(top);
    card.appendChild(el('div', { style: { fontSize: '.76rem', color: '#64748b' } }, [
      (r.specialty_template || '') + ' · ' + (r.created_at ? new Date(r.created_at).toLocaleDateString() : '')
    ]));
    card.onclick = () => {
      RS.currentReportId = r.id;
      RS.generatedText = r.generated_text;
      RS.selectedChildId = r.child_id;
      RS.selectedTemplate = r.specialty_template;
      RS.formState = { _values: r.form_data || {} };
      const { S, re } = getHUD();
      S.activeTab = r.status === 'draft' ? 'report-form' : 'report-preview';
      re();
    };
    sec.appendChild(card);
  });

  return sec;
}

// ─── New Report Form (patient picker → template picker → form) ───
export function renderReportForm() {
  injectStyles();
  const { el, mkBtn, toast, session, _supa, DB, S, re, T } = getHUD();
  const sec = document.createElement('div');
  sec.className = 'section';

  // Back button
  const back = el('span', { style: { color: '#0d9488', cursor: 'pointer', fontWeight: 600, fontSize: '.84rem' } }, ['← Back to Reports']);
  back.onclick = () => { S.activeTab = 'reports'; re(); };
  sec.appendChild(back);

  // Step 1: Patient picker
  if (!RS.selectedChildId) {
    sec.appendChild(el('h2', { style: { fontWeight: 800, color: '#0f172a', margin: '16px 0 12px', fontSize: '1.1rem' } }, ['Select Patient']));
    const children = DB.children.concat(window.HUD.LS?.get?.('children', []) || []);
    if (!children.length) {
      sec.appendChild(el('div', { style: { color: '#64748b', fontSize: '.84rem' } }, ['No patients connected.']));
      return sec;
    }
    children.forEach(c => {
      const row = el('div', { class: 'rpt-hub-card', style: { display: 'flex', alignItems: 'center', gap: '12px' } });
      row.appendChild(el('span', { style: { fontSize: '1.4rem' } }, [c.avatar || '🧒']));
      const info = el('div', { style: { flex: 1 } });
      info.appendChild(el('div', { style: { fontWeight: 700, color: '#0f172a' } }, [c.name]));
      info.appendChild(el('div', { style: { fontSize: '.76rem', color: '#64748b' } }, [calcAge(c.dob)]));
      row.appendChild(info);
      row.onclick = () => { RS.selectedChildId = c.id; re(); };
      sec.appendChild(row);
    });
    return sec;
  }

  // Step 2: Template picker
  if (!RS.selectedTemplate) {
    sec.appendChild(el('h2', { style: { fontWeight: 800, color: '#0f172a', margin: '16px 0 12px', fontSize: '1.1rem' } }, ['Choose Report Template']));
    const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '12px' } });
    TEMPLATES.forEach(t => {
      const card = el('div', { class: 'rpt-template-card' });
      card.appendChild(el('div', { style: { fontSize: '2rem', marginBottom: '8px' } }, [t.icon]));
      card.appendChild(el('div', { style: { fontWeight: 700, color: '#0f172a', marginBottom: '4px' } }, [t.name]));
      card.appendChild(el('div', { style: { fontSize: '.78rem', color: '#64748b', lineHeight: '1.5' } }, [t.description]));
      card.onclick = () => { RS.selectedTemplate = t.id; RS.formState = {}; re(); };
      grid.appendChild(card);
    });
    sec.appendChild(grid);
    return sec;
  }

  // Step 3: Form
  const template = getTemplate(RS.selectedTemplate);
  if (!template) { sec.appendChild(el('div', {}, ['Template not found.'])); return sec; }

  const children = DB.children.concat(window.HUD.LS?.get?.('children', []) || []);
  const child = children.find(c => c.id === RS.selectedChildId);
  const childInfo = { name: child?.name || '—', dob: child?.dob || '—', age: calcAge(child?.dob) };
  const specialistInfo = { name: session?.displayName || session?.name || '—', specialty: session?.profession || '—', credentials: session?.credentials_title || '' };

  sec.appendChild(el('h2', { style: { fontWeight: 800, color: '#0f172a', margin: '16px 0 4px', fontSize: '1.1rem' } }, [template.icon + ' ' + template.name]));
  sec.appendChild(el('div', { style: { fontSize: '.78rem', color: '#64748b', marginBottom: '16px' } }, ['For ' + childInfo.name + ' · ' + childInfo.age]));

  const formContainer = el('div');
  buildForm(template, formContainer, RS.formState, childInfo, specialistInfo);
  sec.appendChild(formContainer);

  // Action buttons
  const actions = el('div', { style: { display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' } });

  // Save draft
  actions.appendChild(mkBtn('💾 Save Draft', 'btn-md btn-secondary', async () => {
    const formData = collectFormData(RS.formState);
    try {
      if (RS.currentReportId) {
        await _supa.from('reports').update({ form_data: formData, updated_at: new Date().toISOString() }).eq('id', RS.currentReportId);
      } else {
        const { data, error } = await _supa.from('reports').insert({
          specialist_id: session.id, child_id: RS.selectedChildId,
          report_type: template.name, specialty_template: RS.selectedTemplate,
          status: 'draft', form_data: formData
        }).select('id').single();
        if (error) throw error;
        RS.currentReportId = data.id;
      }
      RS.reportsLoaded = false;
      toast('💾 Draft saved!');
    } catch (e) { console.error(e); toast('Could not save draft.', 'error'); }
  }));

  // Generate with AI
  actions.appendChild(mkBtn('✨ Generate Report', 'btn-md btn-primary', async () => {
    const formData = collectFormData(RS.formState);
    const btn = actions.querySelector('.btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating...'; }
    try {
      const text = await generateReport(template.name, specialistInfo.specialty, formData, childInfo, specialistInfo);
      RS.generatedText = text;

      // Save to DB
      if (RS.currentReportId) {
        await _supa.from('reports').update({ form_data: formData, generated_text: text, status: 'generated', updated_at: new Date().toISOString() }).eq('id', RS.currentReportId);
      } else {
        const { data, error } = await _supa.from('reports').insert({
          specialist_id: session.id, child_id: RS.selectedChildId,
          report_type: template.name, specialty_template: RS.selectedTemplate,
          status: 'generated', form_data: formData, generated_text: text
        }).select('id').single();
        if (error) throw error;
        RS.currentReportId = data.id;
      }
      RS.reportsLoaded = false;
      S.activeTab = 'report-preview';
      re();
    } catch (e) {
      console.error(e);
      toast('Could not generate report: ' + e.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = '✨ Generate Report'; }
    }
  }));

  sec.appendChild(actions);
  return sec;
}

// ─── Report Preview ───
export function renderReportPreview() {
  injectStyles();
  const { el, mkBtn, toast, session, _supa, DB, S, re } = getHUD();
  const sec = document.createElement('div');
  sec.className = 'section';

  const back = el('span', { style: { color: '#0d9488', cursor: 'pointer', fontWeight: 600, fontSize: '.84rem' } }, ['← Back to Reports']);
  back.onclick = () => { S.activeTab = 'reports'; re(); };
  sec.appendChild(back);

  if (!RS.generatedText) {
    sec.appendChild(el('div', { style: { color: '#64748b', padding: '24px', textAlign: 'center' } }, ['No report generated yet.']));
    return sec;
  }

  const children = DB.children.concat(window.HUD.LS?.get?.('children', []) || []);
  const child = children.find(c => c.id === RS.selectedChildId);
  const childInfo = { name: child?.name || '—', dob: child?.dob || '—', age: calcAge(child?.dob) };
  const specialistInfo = { name: session?.displayName || session?.name || '—', specialty: session?.profession || '—', credentials: session?.credentials_title || '' };

  // Report header
  const report = RS.reports.find(r => r.id === RS.currentReportId) || {};
  sec.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 10px' } }, [
    el('h2', { style: { fontWeight: 800, color: '#0f172a', fontSize: '1.05rem', margin: 0 } }, ['📄 ' + (report.report_type || 'Report')]),
    statusBadge(report.status || 'generated')
  ]));
  sec.appendChild(el('div', { style: { fontSize: '.78rem', color: '#64748b', marginBottom: '14px' } }, [
    childInfo.name + ' · ' + childInfo.age + ' · ' + new Date().toLocaleDateString()
  ]));

  // Editable text area
  const textArea = el('textarea', { style: { width: '100%', minHeight: '400px', padding: '16px', borderRadius: '14px', border: '1.5px solid #e8f4f2', fontSize: '.84rem', lineHeight: '1.7', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' } });
  textArea.value = RS.generatedText;
  textArea.oninput = () => { RS.generatedText = textArea.value; };
  if (report.status === 'finalized') { textArea.readOnly = true; textArea.style.background = '#f8fafc'; }
  sec.appendChild(textArea);

  // Actions
  const actions = el('div', { style: { display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' } });

  if (report.status !== 'finalized') {
    // Save edits
    actions.appendChild(mkBtn('💾 Save', 'btn-md btn-secondary', async () => {
      try {
        await _supa.from('reports').update({ generated_text: RS.generatedText, updated_at: new Date().toISOString() }).eq('id', RS.currentReportId);
        RS.reportsLoaded = false;
        toast('💾 Saved!');
      } catch (e) { toast('Could not save.', 'error'); }
    }));

    // Regenerate
    actions.appendChild(mkBtn('🔄 Regenerate', 'btn-md btn-ghost', async () => {
      S.activeTab = 'report-form';
      re();
    }));

    // Finalize
    actions.appendChild(mkBtn('✅ Finalize', 'btn-md btn-primary', async () => {
      try {
        await _supa.from('reports').update({
          generated_text: RS.generatedText,
          status: 'finalized',
          finalized_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq('id', RS.currentReportId);
        RS.reportsLoaded = false;
        toast('✅ Report finalized!');
        re();
      } catch (e) { toast('Could not finalize.', 'error'); }
    }));
  }

  // Download PDF (always available)
  actions.appendChild(mkBtn('📥 Download PDF', 'btn-md btn-secondary', async () => {
    toast('Generating PDF...', 'info', 2000);
    try {
      await downloadReportPDF(report, RS.generatedText, childInfo, specialistInfo);
      toast('📥 PDF downloaded!');
    } catch (e) { console.error(e); toast('PDF generation failed.', 'error'); }
  }));

  sec.appendChild(actions);
  return sec;
}

// ─── Init ───
export function initReports() {
  injectStyles();
  console.log('[Huddledin] Reports module initialized');
}

// Register on window for index.html glue code
window.HUD_REPORTS = {
  renderReports,
  renderReportForm,
  renderReportPreview,
  initReports,
  RS, // expose state for debugging
};
