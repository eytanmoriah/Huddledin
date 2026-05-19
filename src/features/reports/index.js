// Reports Module v2 — Tiptap editor + Templates + Phrases
import { loadTemplates, saveTemplate, deleteTemplate } from './templates.js';
import { injectStyles } from './styles.js';
import { generatePDFBlob } from './pdf-util.js';
import { loadPhrases, savePhrase, deletePhrase } from './phrases.js';

const RS = {
  templates: [], templatesLoaded: false,
  reports: [], reportsLoaded: false,
  phrases: [], phrasesLoaded: false,
  monthlyCount: 0,
  view: 'hub',
  currentTemplate: null,
  currentReport: null,
  selectedChildId: null,
  returnToPatient: null,
  branding: null,
  brandingLoaded: false,
  brandingBannerDismissed: false,
};

const MONTHLY_LIMIT = 5;
const DEFAULT_BRANDING = { header_color: '#0d9488', font_style: 'sans-serif', header_style: 'compact', footer_text: 'Confidential \u2014 For Clinical Use Only' };

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

function _templateSectionCount(t) {
  if (t.content?.content?.length) return t.content.content.length;
  return _getSectionCount(t.sections);
}

export function _buildCredentials(session) {
  const parts = [];
  if (session?.credentials_title) parts.push(session.credentials_title);
  if (session?.credentials_certs) parts.push(session.credentials_certs);
  if (session?.credentials_license) parts.push('Lic. ' + session.credentials_license);
  return parts.join(', ');
}

export function _downloadBlob(blob, reportType, childName, reportName) {
  const rawName = reportName || reportType || 'Report';
  const name = rawName.replace(/[^a-zA-Z0-9 \u0590-\u05FF]/g, '').replace(/\s+/g, '_').slice(0, 50);
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

export function calcAge(dob) {
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

async function loadData() {
  const { _supa, session } = H();
  if (!_supa || !session) return;
  if (!RS.templatesLoaded) { RS.templates = await loadTemplates(); RS.templatesLoaded = true; }
  if (!RS.phrasesLoaded) { RS.phrases = await loadPhrases(); RS.phrasesLoaded = true; }
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

export async function ensureBranding() {
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

export function getBranding() {
  const result = { ...DEFAULT_BRANDING, ...(RS.branding || {}) };
  return result;
}

// Minimal share — flips shared_with_parents + shared_at on the reports row.
// The real share-to-files flow (PDF export + upload to specialist's shared
// folder + parent notification with deeplink) is queued as Sub-commit 10.
export async function _shareReportWithParents(reportRow, generatedText, supa, sess) {
  if (!reportRow?.id) throw new Error('No report id');
  const nowIso = new Date().toISOString();
  const { error } = await supa.from('reports')
    .update({ shared_with_parents: true, shared_at: nowIso, updated_at: nowIso })
    .eq('id', reportRow.id);
  if (error) throw error;
  return { ok: true, sharedAt: nowIso };
}

function _newReportFromHub() {
  const { toast, openModal, el, mkBtn } = H();
  if (RS.monthlyCount >= MONTHLY_LIMIT) { toast('Monthly limit reached (' + MONTHLY_LIMIT + '/' + MONTHLY_LIMIT + ').', 'error'); return; }
  if (typeof window.HUD_openTiptapGate !== 'function') { toast('Editor not loaded yet \u2014 try again.', 'info'); return; }
  const children = getChildren();
  if (!children.length) { toast('No patients connected yet.', 'info'); return; }
  if (children.length === 1) { window.HUD_openTiptapGate({ childId: children[0].id, startNew: true }); return; }
  const sorted = [...children].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  openModal('Select Patient', (mb, close) => {
    const searchInp = el('input', {
      class: 'inp',
      placeholder: 'Search patients\u2026',
      dir: 'auto',
      style: { marginBottom: '10px' },
    });
    const listEl = el('div', {});

    function _renderList() {
      listEl.innerHTML = '';
      const q = (searchInp.value || '').trim().toLowerCase();
      const filtered = q ? sorted.filter(c => (c.name || '').toLowerCase().includes(q)) : sorted;
      if (!filtered.length) {
        listEl.appendChild(el('div', {
          style: { padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '.84rem' },
        }, ['No patients match.']));
        return;
      }
      filtered.forEach(c => {
        const row = el('div', { class: 'rpt-card', style: { cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' } });
        row.appendChild(el('span', { style: { fontSize: '1.3rem' } }, [c.avatar || '\ud83e\uddd2']));
        row.appendChild(el('div', { style: { fontWeight: 700, color: '#0f172a' } }, [c.name]));
        row.onclick = () => { close(); window.HUD_openTiptapGate({ childId: c.id, startNew: true }); };
        listEl.appendChild(row);
      });
    }

    searchInp.oninput = _renderList;
    mb.appendChild(searchInp);
    mb.appendChild(listEl);
    _renderList();
  }, 380);
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

  // First time — no reports yet
  if (!RS.templates.length && !RS.reports.length) {
    sec.appendChild(el('h2', { class: 'page-title' }, ['\ud83d\udccb Reports']));
    sec.appendChild(el('div', { class: 'empty-state', style: { marginTop: '8px' } }, [
      el('span', { class: 'empty-state-icon' }, ['\ud83d\udccb']),
      el('div', { class: 'empty-state-title' }, ['Welcome to the Report Builder!']),
      el('div', { class: 'empty-state-body' }, ['Create a report or upload a template to get started.']),
      el('div', { class: 'empty-state-actions', style: { display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' } }, [
        mkBtn('+ New Report', 'btn-md btn-primary', () => _newReportFromHub()),
        mkBtn('\ud83d\udce5 Upload template', 'btn-md btn-secondary', () => { if (typeof window.HUD_UPLOAD_TEMPLATE === 'function') window.HUD_UPLOAD_TEMPLATE(); }),
      ])
    ]));
    return sec;
  }

  // Hub with reports
  const hdr = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' } });
  hdr.appendChild(el('h2', { class: 'page-title', style: { margin: 0 } }, ['\ud83d\udccb Reports']));
  const hdrR = el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } });
  hdrR.appendChild(el('span', { class: 'rpt-counter' }, [RS.monthlyCount + ' / ' + MONTHLY_LIMIT + ' this month']));
  hdrR.appendChild(mkBtn('\u2699\ufe0f', 'btn-sm btn-ghost', () => { const { S } = H(); S.activeTab = 'settings'; H().re(); }));
  hdrR.appendChild(mkBtn('\ud83d\udcdd My Templates', 'btn-sm btn-ghost', () => nav('templates')));
  hdrR.appendChild(mkBtn('\ud83d\udcac My Phrases', 'btn-sm btn-ghost', () => nav('phrases')));
  hdrR.appendChild(mkBtn('+ New Report', 'btn-sm btn-primary', () => _newReportFromHub()));
  hdr.appendChild(hdrR); sec.appendChild(hdr);

  // Drafts section
  const draftsHost = el('div', {});
  sec.appendChild(draftsHost);
  _renderDraftsSection(draftsHost);

  if (!RS.reports.length) {
    sec.appendChild(el('div', { style: { textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '.88rem' } }, ['No reports yet. Create your first one!']));
    return sec;
  }

  const children = getChildren();
  RS.reports.filter(r => r.status !== 'draft').forEach(r => {
    const child = children.find(c => c.id === r.child_id);
    const card = el('div', { class: 'rpt-card' });
    const top = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' } });
    top.appendChild(el('div', { style: { fontWeight: 700, color: '#0f172a', fontSize: '.88rem' } }, [(child?.avatar || '\ud83e\uddd2') + ' ' + (child?.name || 'Patient') + ' \u2014 ' + (r.name || 'Untitled')]));
    const badges = el('div', { style: { display: 'flex', gap: '4px' } });
    badges.appendChild(statusBadge(r.status));
    if (r.shared_with_parents) badges.appendChild(el('span', { class: 'rpt-badge', style: { background: '#dbeafe', color: '#1e40af' } }, ['📤 Shared']));
    top.appendChild(badges);
    card.appendChild(top);
    card.appendChild(el('div', { style: { fontSize: '.76rem', color: '#64748b' } }, [(r.created_at ? new Date(r.created_at).toLocaleDateString() : '')]));
    card.onclick = () => {
      if (r.content && typeof window.HUD_openTiptapGate === 'function') {
        window.HUD_openTiptapGate({
          childId: r.child_id,
          draftId: r.status === 'draft' ? r.id : undefined,
          reportId: r.status !== 'draft' ? r.id : undefined,
          readOnly: r.status === 'finalized',
        });
      } else {
        toast('This legacy report is no longer available.', 'info');
      }
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
  hdrBtns.appendChild(mkBtn('\ud83d\udce5 Upload template', 'btn-sm btn-ghost', () => {
    if (typeof window.HUD_UPLOAD_TEMPLATE === 'function') window.HUD_UPLOAD_TEMPLATE();
  }));
  hdrBtns.appendChild(mkBtn('+ New Template', 'btn-sm btn-primary', () => {
    if (typeof window.HUD_openTiptapGate === 'function') window.HUD_openTiptapGate({ templateMode: true });
  }));
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
    const secCount = _templateSectionCount(t);
    meta.textContent = secCount + ' section' + (secCount !== 1 ? 's' : '') + ' \u00b7 Used ' + (t.use_count || 0) + ' time' + ((t.use_count || 0) !== 1 ? 's' : '');
    card.appendChild(meta);
    const acts = el('div', { style: { display: 'flex', gap: '8px', marginTop: '10px' } });
    const _copyTpl = () => ({ ...t, sections: JSON.parse(JSON.stringify(t.sections || [])), content: t.content ? JSON.parse(JSON.stringify(t.content)) : null });
    acts.appendChild(mkBtn('Edit', 'btn-sm btn-ghost', (e) => {
      e.stopPropagation();
      if (t.content && typeof window.HUD_openTiptapGate === 'function') {
        window.HUD_openTiptapGate({ templateMode: true, templateId: t.id, templateContent: t.content, templateName: t.name, templateDescription: t.description, sourceFileName: t.name });
      } else {
        toast('This legacy template is no longer editable.', 'info');
      }
    }));
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
        toast('\ud83d\udccb Template duplicated!');
        if (clone.content && typeof window.HUD_openTiptapGate === 'function') {
          await loadData();
          H().re();
          window.HUD_openTiptapGate({ templateMode: true, templateId: newId, templateContent: clone.content, templateName: clone.name, templateDescription: clone.description, sourceFileName: clone.name });
        } else {
          RS.templatesLoaded = false; await loadData(); H().re();
        }
      } catch (ex) { console.error(ex); toast('Could not duplicate.', 'error'); }
    }));
    acts.appendChild(mkBtn('Delete', 'btn-sm btn-ghost', (e) => {
      e.stopPropagation();
      openConfirm('Delete Template?', 'This cannot be undone.', true, async () => {
        await deleteTemplate(t.id); RS.templatesLoaded = false; await loadData(); H().re();
      });
    }));
    card.appendChild(acts);
    card.onclick = () => {
      if (t.content && typeof window.HUD_openTiptapGate === 'function') {
        window.HUD_openTiptapGate({ templateMode: true, templateId: t.id, templateContent: t.content, templateName: t.name, templateDescription: t.description, sourceFileName: t.name });
      } else {
        toast('This legacy template is no longer editable.', 'info');
      }
    };
    grid.appendChild(card);
  });
  sec.appendChild(grid);
  return sec;
}

// ════════════════════════════════════════
// INIT + ROUTING
// ════════════════════════════════════════
export function initReports() {
  injectStyles();
  console.log('[Huddledin] Reports v2 module initialized');
}

// ════════════════════════════════════════
// BETA: Drafts section on Reports hub
// ════════════════════════════════════════
function _relativeTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffS = Math.floor((now - d) / 1000);
  if (diffS < 60) return 'Edited just now';
  if (diffS < 3600) return 'Edited ' + Math.floor(diffS / 60) + ' minutes ago';
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return 'Edited today at ' + time;
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'Edited yesterday at ' + time;
  const diffD = Math.floor(diffS / 86400);
  if (diffD <= 7) return 'Edited ' + diffD + ' days ago';
  return 'Edited on ' + d.toLocaleDateString();
}

function _draftPreview(content) {
  try {
    const sections = content?.content;
    if (!sections?.length) return 'Empty draft';
    const sec = sections[0];
    const titleNode = sec.content?.[0];
    const bodyNode = sec.content?.[1];
    const titleText = titleNode?.content?.map(n => n.text || '').join('').trim() || '';
    let bodyText = '';
    if (bodyNode?.content) {
      for (const block of bodyNode.content) {
        if (block.content) bodyText += block.content.map(n => n.text || '').join('');
        if (bodyText.length > 60) break;
      }
    }
    bodyText = bodyText.trim();
    if (bodyText.length > 60) bodyText = bodyText.slice(0, 60) + '\u2026';
    if (titleText && bodyText) return titleText + ' \u2014 ' + bodyText;
    if (titleText) return titleText + ' \u2014 (no content)';
    if (bodyText) return bodyText;
    return 'Empty draft';
  } catch (_) { return 'Empty draft'; }
}

async function _renderDraftsSection(host) {
  const { el, mkBtn, toast, session, openConfirm } = H();
  const { listDrafts, deleteDraft } = await window.HUD_TIPTAP_API();
  const drafts = await listDrafts({ specialistId: session.id });
  if (!drafts.length) return;

  const children = getChildren();
  const wrap = el('div', { style: { marginBottom: '20px' } });
  wrap.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' } }, [
    el('span', { style: { fontWeight: 700, fontSize: '.92rem', color: '#0f172a' } }, ['Drafts']),
    el('span', { style: { fontSize: '.72rem', fontWeight: 600, color: '#64748b', background: '#f0fdf9', borderRadius: '99px', padding: '2px 8px' } }, [String(drafts.length)]),
  ]));

  drafts.forEach(draft => {
    const child = children.find(c => c.id === draft.child_id);
    const card = el('div', { class: 'rpt-card', style: { position: 'relative', paddingInlineEnd: '42px' } });
    card.appendChild(el('div', { style: { fontWeight: 600, color: '#0f172a', fontSize: '.88rem', marginBottom: '2px' } }, [(child?.avatar || '\ud83e\uddd2') + ' ' + (child?.name || 'Patient') + ' \u2014 ' + (draft.name || 'Untitled')]));
    card.appendChild(el('div', { style: { fontSize: '.72rem', color: '#94a3b8' } }, [_relativeTime(draft.updated_at)]));

    const trash = el('button', { style: { position: 'absolute', top: '50%', insetInlineEnd: '10px', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '6px', borderRadius: '6px', color: '#94a3b8', transition: 'color .12s, background .12s', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, ['🗑️']);
    trash.onmouseenter = () => { trash.style.color = '#dc2626'; trash.style.background = '#fef2f2'; };
    trash.onmouseleave = () => { trash.style.color = '#94a3b8'; trash.style.background = 'none'; };
    trash.onclick = (e) => {
      e.stopPropagation();
      openConfirm('Delete draft?', 'This cannot be undone.', true, async () => {
        const result = await deleteDraft({ reportId: draft.id });
        if (result.ok) { RS.reportsLoaded = false; H().re(); }
        else toast('Failed to delete draft.', 'error');
      });
    };
    card.appendChild(trash);

    card.onclick = () => {
      if (typeof window.HUD_openTiptapGate === 'function') window.HUD_openTiptapGate({ draftId: draft.id, childId: draft.child_id });
    };
    wrap.appendChild(card);
  });
  host.appendChild(wrap);
}

// ════════════════════════════════════════
// BETA: New Tiptap editor from patient context
// ════════════════════════════════════════
async function handleNewReport(childId) {
  const { session, openModal, el, mkBtn, toast } = H();
  if (!session?.id || !childId) return;
  if (typeof window.HUD_openTiptapGate !== 'function') { toast('Editor not loaded yet — try again in a moment.', 'info'); return; }

  const { findExistingDraft } = await window.HUD_TIPTAP_API();
  const existing = await findExistingDraft({ specialistId: session.id, childId });

  if (!existing) {
    window.HUD_openTiptapGate({ childId });
    return;
  }

  const d = new Date(existing.updated_at);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = isToday ? 'today at ' + time : isYesterday ? 'yesterday at ' + time : d.toLocaleDateString() + ' at ' + time;

  openModal('Continue draft?', (mb, close) => {
    mb.appendChild(el('div', { style: { marginBottom: '20px', color: '#334155', fontSize: '14px', lineHeight: '1.5' } },
      ['You have an in-progress draft for this patient from ' + dateStr + '. Would you like to resume it, or start new?']));
    const row = el('div', {}, []);
    row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;';
    row.appendChild(mkBtn('Cancel', 'btn-md btn-ghost', close));
    row.appendChild(mkBtn('Start new', 'btn-md btn-secondary', () => { close(); window.HUD_openTiptapGate({ childId, startNew: true }); }));
    row.appendChild(mkBtn('Resume draft', 'btn-md btn-primary', () => { close(); window.HUD_openTiptapGate({ draftId: existing.id, childId }); }));
    mb.appendChild(row);
  }, 420);
}

// ════════════════════════════════════════
// Template picker (shared by "From template" + "Use template" toolbar)
// ════════════════════════════════════════
async function _openTemplatePickerForChild({ childId, onPicked }) {
  const { session, openModal, el, mkBtn, toast, _supa, openConfirm } = H();
  if (!session?.id) return;
  const { substitutePlaceholders } = await window.HUD_TIPTAP_API();

  let templates;
  try {
    const { data, error } = await _supa.from('report_templates')
      .select('id,name,description,content,updated_at,use_count')
      .eq('specialist_id', session.id)
      .not('content', 'is', null)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    templates = data || [];
  } catch (e) {
    console.error('\u274c load templates:', e);
    toast('Failed to load templates', 'error');
    return;
  }

  if (!templates.length) {
    openConfirm('No templates yet', 'You haven\u2019t created any templates yet. Upload one from the Reports hub to use this feature.', false, () => {});
    return;
  }

  const child = childId ? getChildren().find(c => c.id === childId) : null;

  openModal('Pick a template', (mb, close) => {
    templates.forEach(t => {
      const row = el('div', { class: 'rpt-card', style: { cursor: 'pointer' } });
      row.appendChild(el('div', { style: { fontWeight: 700, color: '#0f172a', fontSize: '.88rem', marginBottom: '2px' } }, [t.name]));
      if (t.description) row.appendChild(el('div', { style: { fontSize: '.76rem', color: '#64748b', marginBottom: '4px' } }, [t.description]));
      const meta = [];
      const sc = t.content?.content?.length;
      if (sc) meta.push(sc + ' section' + (sc !== 1 ? 's' : ''));
      if (t.use_count) meta.push('Used ' + t.use_count + ' time' + (t.use_count !== 1 ? 's' : ''));
      if (meta.length) row.appendChild(el('div', { style: { fontSize: '.7rem', color: '#94a3b8' } }, [meta.join(' \u00b7 ')]));
      row.onclick = () => {
        close();
        const subbed = child ? substitutePlaceholders(t.content, child) : t.content;
        onPicked(subbed, t);
        _supa.from('report_templates').update({ use_count: (t.use_count || 0) + 1 }).eq('id', t.id).then(() => {}).catch(() => {});
      };
      mb.appendChild(row);
    });
  }, 480);
}

async function handleStartFromTemplate(childId) {
  const { session, openModal, el, mkBtn, toast } = H();
  if (!session?.id || !childId) return;
  if (typeof window.HUD_openTiptapGate !== 'function') { toast('Editor not loaded yet \u2014 try again in a moment.', 'info'); return; }

  const { findExistingDraft } = await window.HUD_TIPTAP_API();
  const existing = await findExistingDraft({ specialistId: session.id, childId });

  if (existing) {
    const proceed = await new Promise(resolve => {
      const d = new Date(existing.updated_at);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const yest = new Date(now); yest.setDate(yest.getDate() - 1);
      const isYest = d.toDateString() === yest.toDateString();
      const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = isToday ? 'today at ' + time : isYest ? 'yesterday at ' + time : d.toLocaleDateString() + ' at ' + time;
      openModal('Continue draft?', (mb, close) => {
        mb.appendChild(el('div', { style: { marginBottom: '20px', color: '#334155', fontSize: '14px', lineHeight: '1.5' } },
          ['You have an in-progress draft for this patient from ' + dateStr + '. Would you like to resume it, or start from a template?']));
        const row = el('div', {}); row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;';
        row.appendChild(mkBtn('Cancel', 'btn-md btn-ghost', () => { close(); resolve('cancel'); }));
        row.appendChild(mkBtn('From template', 'btn-md btn-secondary', () => { close(); resolve('new'); }));
        row.appendChild(mkBtn('Resume draft', 'btn-md btn-primary', () => { close(); resolve('resume'); }));
        mb.appendChild(row);
      }, 420);
    });
    if (proceed === 'cancel') return;
    if (proceed === 'resume') { window.HUD_openTiptapGate({ draftId: existing.id, childId }); return; }
  }

  await _openTemplatePickerForChild({
    childId,
    onPicked: (subbed, t) => {
      window.HUD_openTiptapGate({ childId, initialContent: subbed, fromTemplateId: t.id, startNew: true });
    },
  });
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
  const hdrBtns = el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } });
  hdrBtns.appendChild(mkBtn('\ud83d\udccb From template', 'btn-sm btn-ghost', () => handleStartFromTemplate(childId)));
  hdrBtns.appendChild(mkBtn('+ New Report', 'btn-sm btn-primary', () => {
    if (RS.monthlyCount >= MONTHLY_LIMIT) { toast('Monthly limit reached (' + MONTHLY_LIMIT + '/' + MONTHLY_LIMIT + ').', 'error'); return; }
    handleNewReport(childId);
  }));
  hdr.appendChild(hdrBtns);
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
    const card = el('div', { class: 'rpt-card', style: Object.assign({ position: 'relative' }, r.status === 'draft' ? { paddingInlineEnd: '42px' } : {}) });
    const top = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' } });
    top.appendChild(el('div', { style: { fontWeight: 700, color: '#0f172a', fontSize: '.88rem' } }, [r.name || 'Untitled']));
    const badges = el('div', { style: { display: 'flex', gap: '4px' } });
    badges.appendChild(statusBadge(r.status));
    if (r.shared_with_parents) badges.appendChild(el('span', { class: 'rpt-badge', style: { background: '#dbeafe', color: '#1e40af' } }, ['\ud83d\udce4 Shared']));
    top.appendChild(badges);
    card.appendChild(top);
    card.appendChild(el('div', { style: { fontSize: '.76rem', color: '#64748b' } }, [r.created_at ? new Date(r.created_at).toLocaleDateString() : '']));
    if (r.status === 'draft') {
      const trash = el('button', { style: { position: 'absolute', top: '50%', insetInlineEnd: '10px', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '6px', borderRadius: '6px', color: '#94a3b8', transition: 'color .12s, background .12s', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, ['\ud83d\uddd1\ufe0f']);
      trash.onmouseenter = () => { trash.style.color = '#dc2626'; trash.style.background = '#fef2f2'; };
      trash.onmouseleave = () => { trash.style.color = '#94a3b8'; trash.style.background = 'none'; };
      trash.onclick = (e) => {
        e.stopPropagation();
        const { openConfirm } = H();
        openConfirm('Delete this draft?', 'This cannot be undone.', true, async () => {
          const { deleteDraft } = await window.HUD_TIPTAP_API();
          const result = await deleteDraft({ reportId: r.id });
          if (result.ok) { RS.reportsLoaded = false; H().re(); }
          else toast('Failed to delete draft.', 'error');
        });
      };
      card.appendChild(trash);
    }
    card.onclick = () => {
      if (r.content && typeof window.HUD_openTiptapGate === 'function') {
        window.HUD_openTiptapGate({
          childId: r.child_id,
          draftId: r.status === 'draft' ? r.id : undefined,
          reportId: r.status !== 'draft' ? r.id : undefined,
          readOnly: r.status === 'finalized',
        });
      } else {
        toast('This legacy report is no longer available.', 'info');
      }
    };
    sec.appendChild(card);
  });

  return sec;
}

// ════════════════════════════════════════
// MY PHRASES
// ════════════════════════════════════════
function _relTimeShort(ts) {
  if (!ts) return '';
  const d = new Date(ts), now = new Date(), s = Math.floor((now - d) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString();
}

function _openPhraseDialog({ phraseId, initialName, initialContent, onSave, onDelete }) {
  const { openModal, el, mkBtn, toast, openConfirm } = H();
  const isEdit = !!phraseId;
  openModal(isEdit ? 'Edit Phrase' : 'New Phrase', (mb, close) => {
    const nameLabel = document.createElement('label');
    nameLabel.style.cssText = 'display:block;font-size:13px;font-weight:600;color:#334155;margin-bottom:4px;';
    nameLabel.textContent = 'Name *';
    mb.appendChild(nameLabel);
    const nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.maxLength = 100;
    nameInp.value = initialName || '';
    nameInp.placeholder = 'e.g. Age-appropriate development';
    nameInp.style.cssText = 'width:100%;padding:10px 12px;border:1.5px solid #d1e0dd;border-radius:8px;font-size:15px;font-family:inherit;box-sizing:border-box;margin-bottom:12px;outline:none;';
    nameInp.onfocus = () => { nameInp.style.borderColor = '#0d9488'; };
    nameInp.onblur = () => { nameInp.style.borderColor = '#d1e0dd'; };
    mb.appendChild(nameInp);

    const contentLabel = document.createElement('label');
    contentLabel.style.cssText = 'display:block;font-size:13px;font-weight:600;color:#334155;margin-bottom:4px;';
    contentLabel.textContent = 'Content *';
    mb.appendChild(contentLabel);
    const contentInp = document.createElement('textarea');
    contentInp.rows = 5;
    contentInp.maxLength = 5000;
    contentInp.value = initialContent || '';
    contentInp.placeholder = '[NAME] demonstrates age-appropriate development for [PRONOUN_POSSESSIVE] chronological age.';
    contentInp.style.cssText = 'width:100%;padding:10px 12px;border:1.5px solid #d1e0dd;border-radius:8px;font-size:15px;font-family:inherit;box-sizing:border-box;resize:vertical;margin-bottom:4px;outline:none;';
    mb.appendChild(contentInp);

    mb.appendChild(el('div', { style: { fontSize: '12px', color: '#94a3b8', marginBottom: '12px', lineHeight: '1.4' } },
      ['Use [NAME], [AGE], [DOB], [DATE], [PRONOUN_SUBJECT/OBJECT/POSSESSIVE] to reference the patient. These substitute automatically when you insert the phrase.']));

    const errEl = document.createElement('div');
    errEl.style.cssText = 'color:#ef4444;font-size:13px;margin-bottom:8px;display:none;';
    mb.appendChild(errEl);

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;';

    if (isEdit && onDelete) {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-md btn-ghost';
      delBtn.textContent = 'Delete';
      delBtn.style.cssText += 'color:#ef4444;margin-inline-end:auto;';
      delBtn.onclick = () => {
        openConfirm('Delete phrase?', 'This phrase will be removed permanently.', true, async () => {
          const r = await onDelete();
          if (r?.error) { toast(r.error, 'error'); return; }
          close();
        });
      };
      row.appendChild(delBtn);
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-md btn-ghost';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = close;
    row.appendChild(cancelBtn);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-md btn-primary';
    saveBtn.textContent = isEdit ? 'Save changes' : 'Create';
    saveBtn.onclick = async () => {
      const n = nameInp.value.trim();
      const c = contentInp.value.trim();
      if (!n) { errEl.textContent = 'Name is required'; errEl.style.display = 'block'; nameInp.focus(); return; }
      if (!c) { errEl.textContent = 'Content is required'; errEl.style.display = 'block'; contentInp.focus(); return; }
      if (n.length > 100) { errEl.textContent = 'Name must be 100 characters or less'; errEl.style.display = 'block'; return; }
      if (c.length > 5000) { errEl.textContent = 'Content must be 5000 characters or less'; errEl.style.display = 'block'; return; }
      saveBtn.disabled = true; saveBtn.textContent = 'Saving\u2026';
      const result = await onSave(n, c);
      if (result?.error) { errEl.textContent = result.error; errEl.style.display = 'block'; saveBtn.disabled = false; saveBtn.textContent = isEdit ? 'Save changes' : 'Create'; return; }
      close();
    };
    row.appendChild(saveBtn);
    mb.appendChild(row);
    setTimeout(() => nameInp.focus(), 50);
  }, 480);
}

function renderPhrases() {
  injectStyles();
  const { el, mkBtn, toast } = H();
  const sec = document.createElement('div'); sec.className = 'section';

  const back = el('span', { style: { color: '#0d9488', cursor: 'pointer', fontWeight: 600, fontSize: '.84rem' } }, ['\u2190 Back to Reports']);
  back.onclick = () => nav('hub'); sec.appendChild(back);

  const hdr = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 16px' } });
  hdr.appendChild(el('h2', { style: { fontWeight: 800, color: '#0f172a', fontSize: '1.1rem', margin: 0 } }, ['\ud83d\udcac My Phrases']));
  hdr.appendChild(mkBtn('+ New Phrase', 'btn-sm btn-primary', () => {
    _openPhraseDialog({
      onSave: async (name, content) => {
        const result = await savePhrase({ phraseId: null, name, content });
        if (result.error) return result;
        RS.phrasesLoaded = false; await loadData(); H().re();
        toast('\u2705 Phrase created!');
        return {};
      },
    });
  }));
  sec.appendChild(hdr);

  if (!RS.phrases.length) {
    sec.appendChild(el('div', { class: 'empty-state', style: { marginTop: '8px' } }, [
      el('span', { class: 'empty-state-icon' }, ['\ud83d\udcac']),
      el('div', { class: 'empty-state-title' }, ['You haven\u2019t created any phrases yet.']),
      el('div', { class: 'empty-state-body' }, ['Phrases are reusable snippets you can quickly insert into reports. They support placeholders like [NAME], [AGE], [DATE] that auto-fill based on the patient.']),
    ]));
    return sec;
  }

  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: '12px' } });
  RS.phrases.forEach(p => {
    const card = el('div', { class: 'rpt-tpl-card', style: { cursor: 'pointer' } });
    card.appendChild(el('div', { style: { fontWeight: 700, color: '#0f172a', marginBottom: '4px' } }, [p.name]));
    const preview = (p.content || '').length > 100 ? p.content.slice(0, 100) + '\u2026' : p.content || '';
    card.appendChild(el('div', { style: { fontSize: '.78rem', color: '#64748b', marginBottom: '8px', lineHeight: '1.4' } }, [preview]));
    const meta = [];
    meta.push('Used ' + (p.use_count || 0) + ' time' + ((p.use_count || 0) !== 1 ? 's' : ''));
    meta.push(_relTimeShort(p.last_used_at || p.updated_at || p.created_at));
    card.appendChild(el('div', { style: { fontSize: '.7rem', color: '#94a3b8' } }, [meta.filter(Boolean).join(' \u00b7 ')]));
    card.onclick = () => {
      _openPhraseDialog({
        phraseId: p.id,
        initialName: p.name,
        initialContent: p.content,
        onSave: async (name, content) => {
          const result = await savePhrase({ phraseId: p.id, name, content });
          if (result.error) return result;
          RS.phrasesLoaded = false; await loadData(); H().re();
          toast('\u2705 Phrase updated!');
          return {};
        },
        onDelete: async () => {
          const result = await deletePhrase(p.id);
          if (result.error) return result;
          RS.phrasesLoaded = false; await loadData(); H().re();
          toast('Phrase deleted.');
          return {};
        },
      });
    };
    grid.appendChild(card);
  });
  sec.appendChild(grid);
  return sec;
}

// Main render dispatcher (called from index.html glue)
function renderMain() {
  switch (RS.view) {
    case 'templates': return renderTemplates();
    case 'phrases': return renderPhrases();
    default: return renderReports();
  }
}

function invalidateReportsCache() { RS.reportsLoaded = false; }
function invalidateTemplatesCache() { RS.templatesLoaded = false; }
function invalidatePhrasesCache() { RS.phrasesLoaded = false; }
function navToTemplates() {
  const { S } = H();
  S.activeTab = 'reports';
  nav('templates');
}

function openNewPhraseDialog(initialName, initialContent) {
  _openPhraseDialog({
    initialName: initialName || '',
    initialContent: initialContent || '',
    onSave: async (name, content) => {
      const result = await savePhrase({ phraseId: null, name, content });
      if (result.error) return result;
      RS.phrasesLoaded = false;
      return {};
    },
  });
}

window.HUD_REPORTS = {
  renderReports: renderMain,
  renderPatientReports,
  renderTemplates,
  initReports,
  invalidateReportsCache,
  invalidateTemplatesCache,
  invalidatePhrasesCache,
  navToTemplates,
  openNewPhraseDialog,
  _openTemplatePickerForChild,
  loadPhrases,
  calcAge,
  RS,
};
