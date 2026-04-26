// Huddledin Module Entry Point
import { initReports } from './features/reports/index.js';
import { initHomework, mountHomeworkCreateModal, openTemplatePicker, renderHomeworkSpecList } from './features/homework/index.js';

console.log('[Huddledin] Module system loaded');

if (window.HUD) {
  initReports();
  initHomework();
} else {
  window.addEventListener('hud-ready', () => { initReports(); initHomework(); });
}

// Homework module public API
window.HUD_HOMEWORK = { mountHomeworkCreateModal, openTemplatePicker, renderHomeworkSpecList };

// ── Lazy loader for file-parser bundle ──
async function loadFileParserBundle() {
  if (window.HUD_PARSE_FILE && window.HUD_EXTRACT_TEMPLATE) return;
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="/file-parser.bundle.js"]');
    if (existing) {
      if (window.HUD_PARSE_FILE) return resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Parser load failed')), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = '/file-parser.bundle.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Parser load failed'));
    document.head.appendChild(s);
  });
}
window.HUD_LOAD_FILE_PARSER = loadFileParserBundle;

// ── Tiptap editor gate modal ──
async function openTiptapGateModal(opts = {}) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:450;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;';
  const card = document.createElement('div');
  card.style.cssText = 'background:#f5fafa;border-radius:14px;width:100%;max-width:900px;max-height:calc(100vh - 32px);overflow-y:auto;padding:24px;position:relative;box-shadow:0 8px 32px rgba(0,0,0,.2);';

  let gateEditor = null;

  async function closeModal() {
    if (gateEditor) {
      if (gateEditor._gateIsDirty?.()) {
        try {
          await gateEditor._gateSave?.();
        } catch (_) {
          const proceed = await new Promise(resolve => {
            const c = window.HUD?.openConfirm;
            if (c) {
              let resolved = false;
              c('Unsaved Changes', 'Your draft has unsaved changes. Close anyway?', true, () => { resolved = true; resolve(true); });
              const ov = document.body.lastElementChild;
              if (ov?.classList.contains('overlay')) {
                const obs = new MutationObserver(() => {
                  if (!ov.isConnected && !resolved) { obs.disconnect(); resolve(false); }
                });
                obs.observe(document.body, { childList: true });
              }
            } else {
              resolve(confirm('Your draft has unsaved changes. Close anyway?'));
            }
          });
          if (!proceed) return;
        }
      }
      gateEditor._gateCleanup?.();
    }
    overlay.remove();
    window.HUD_REPORTS?.invalidateReportsCache?.();
    try { window.HUD?.re?.(); } catch (_) {}
  }

  const editorHost = document.createElement('div');
  card.appendChild(editorHost);
  overlay.appendChild(card);
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  document.body.appendChild(overlay);
  const { mountGateEditor } = await import('./features/reports/tiptap-gate.js');
  gateEditor = await mountGateEditor(editorHost, { ...opts, _closeModal: () => closeModal() });
}
window.HUD_openTiptapGate = openTiptapGateModal;

// ── Upload template flow ──
const LS_TEMPLATE_KEY = 'huddledin.template_draft';

function _pickFile(accept) {
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept || '.pdf,.docx';
    inp.style.display = 'none';
    inp.onchange = () => { resolve(inp.files?.[0] || null); inp.remove(); };
    document.body.appendChild(inp);
    inp.click();
    setTimeout(() => { if (!inp.files?.length) inp.remove(); }, 120000);
  });
}

function _friendlyError(err) {
  const m = err?.message || '';
  if (/too large|Maximum 10MB/i.test(m)) return 'That file is too large. Maximum 10MB.';
  if (/unsupported file type/i.test(m)) return 'Please upload a PDF or Word (.docx) file.';
  if (/password.protected/i.test(m)) return m;
  if (/no extractable text/i.test(m)) return m;
  if (/could not initialize/i.test(m)) return "Couldn't read that PDF. Try saving it again or uploading a Word version.";
  if (/too short/i.test(m)) return 'This document is too short to extract as a template. Please upload a longer report.';
  if (/too long/i.test(m)) return 'This document is too long. Please try a shorter report or split into sections.';
  if (/429|rate limit|limit.*hour/i.test(m)) return "You've reached this hour's template extraction limit. Please try again later.";
  if (/401|not authenticated|session.*expired/i.test(m)) return 'Your session has expired. Please refresh the page.';
  if (/did not return expected/i.test(m)) return 'Extraction produced unexpected results. Please try again.';
  return 'Something went wrong. Please try again or contact support if it persists.';
}

function _openLoadingModal() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;';
  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;border-radius:14px;width:100%;max-width:420px;padding:28px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.2);';
  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-size:16px;font-weight:700;color:#0f1a18;margin-bottom:16px;';
  titleEl.textContent = 'Creating template from your document';
  card.appendChild(titleEl);
  const barOuter = document.createElement('div');
  barOuter.style.cssText = 'height:8px;border-radius:4px;background:#e8f4f2;overflow:hidden;margin-bottom:12px;';
  const barInner = document.createElement('div');
  barInner.style.cssText = 'height:100%;border-radius:4px;background:#0d9488;width:0%;transition:width .3s ease;';
  barOuter.appendChild(barInner);
  card.appendChild(barOuter);
  const msgEl = document.createElement('div');
  msgEl.style.cssText = 'font-size:13px;color:#64748b;margin-bottom:6px;';
  msgEl.textContent = 'Preparing...';
  card.appendChild(msgEl);
  const timerEl = document.createElement('div');
  timerEl.style.cssText = 'font-size:12px;color:#94a3b8;';
  card.appendChild(timerEl);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const start = Date.now();
  let pct = 0;
  let done = false;
  const tick = setInterval(() => {
    if (done) return;
    const elapsed = (Date.now() - start) / 1000;
    timerEl.textContent = '(' + Math.floor(elapsed) + 's)';
    if (pct < 95) {
      pct = Math.min(95, pct + (95 - pct) * 0.08);
      barInner.style.width = pct.toFixed(1) + '%';
    }
    if (elapsed > 20 && pct >= 90) titleEl.textContent = 'Still working\u2026 larger documents take longer.';
    if (elapsed > 45) msgEl.textContent = 'This is taking longer than expected. Please wait or refresh to cancel.';
  }, 300);

  return {
    update({ message }) { msgEl.textContent = message; },
    complete() {
      done = true; clearInterval(tick);
      barInner.style.width = '100%';
      setTimeout(() => overlay.remove(), 500);
    },
    error(message) {
      done = true; clearInterval(tick);
      card.textContent = '';
      const icon = document.createElement('div');
      icon.style.cssText = 'font-size:36px;margin-bottom:12px;';
      icon.textContent = '\u26a0\ufe0f';
      card.appendChild(icon);
      const errMsg = document.createElement('div');
      errMsg.style.cssText = 'font-size:14px;color:#ef4444;margin-bottom:16px;line-height:1.5;';
      errMsg.textContent = message;
      card.appendChild(errMsg);
      const btns = document.createElement('div');
      btns.style.cssText = 'display:flex;gap:10px;justify-content:center;';
      const retry = document.createElement('button');
      retry.textContent = 'Try again';
      retry.style.cssText = 'padding:8px 18px;border:none;border-radius:8px;background:#0d9488;color:#fff;font-size:14px;cursor:pointer;font-family:inherit;';
      retry.onclick = () => { overlay.remove(); handleUploadTemplate(); };
      btns.appendChild(retry);
      const closeBtn = document.createElement('button');
      closeBtn.textContent = 'Close';
      closeBtn.style.cssText = 'padding:8px 18px;border:1px solid #d1e0dd;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;font-family:inherit;color:#64748b;';
      closeBtn.onclick = () => overlay.remove();
      btns.appendChild(closeBtn);
      card.appendChild(btns);
    },
  };
}

function _relTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diffM = Math.floor((now - d) / 60000);
  if (diffM < 1) return 'just now';
  if (diffM < 60) return diffM + ' minutes ago';
  const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return 'today at ' + t;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'yesterday at ' + t;
  return d.toLocaleDateString();
}

async function handleUploadTemplate() {
  // Check for localStorage backup
  try {
    const raw = localStorage.getItem(LS_TEMPLATE_KEY);
    if (raw) {
      const backup = JSON.parse(raw);
      if (backup.content && backup.updatedAt && (Date.now() - new Date(backup.updatedAt).getTime()) < 24 * 60 * 60 * 1000) {
        const choice = await new Promise(resolve => {
          const c = window.HUD?.openModal;
          if (!c) return resolve('new');
          c('Resume template?', (mb, close) => {
            const msg = document.createElement('div');
            msg.style.cssText = 'margin-bottom:20px;color:#334155;font-size:14px;line-height:1.5;';
            msg.textContent = 'You have an unsaved template from ' + _relTime(backup.updatedAt) + '. Resume editing it?';
            mb.appendChild(msg);
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;';
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn-md btn-ghost';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.onclick = () => { close(); resolve('cancel'); };
            row.appendChild(cancelBtn);
            const newBtn = document.createElement('button');
            newBtn.className = 'btn-md btn-secondary';
            newBtn.textContent = 'Start new';
            newBtn.onclick = () => { close(); localStorage.removeItem(LS_TEMPLATE_KEY); resolve('new'); };
            row.appendChild(newBtn);
            const resumeBtn = document.createElement('button');
            resumeBtn.className = 'btn-md btn-primary';
            resumeBtn.textContent = 'Resume';
            resumeBtn.onclick = () => { close(); resolve('resume'); };
            row.appendChild(resumeBtn);
            mb.appendChild(row);
          }, 420);
        });
        if (choice === 'cancel') return;
        if (choice === 'resume') {
          openTiptapGateModal({ templateMode: true, templateContent: backup.content, sourceFileName: backup.sourceFileName });
          return;
        }
      } else {
        localStorage.removeItem(LS_TEMPLATE_KEY);
      }
    }
  } catch (_) {}

  const file = await _pickFile('.pdf,.docx');
  if (!file) return;

  const loading = _openLoadingModal();
  try {
    loading.update({ message: 'Loading parser\u2026' });
    await loadFileParserBundle();
    loading.update({ message: 'Reading your document\u2026' });
    const parsed = await window.HUD_PARSE_FILE(file);
    loading.update({ message: 'Analyzing structure\u2026' });
    const specialty = window.HUD?.session?.profession || null;
    const result = await window.HUD_EXTRACT_TEMPLATE({ text: parsed.text, specialty, fileName: parsed.fileName });
    loading.complete();
    openTiptapGateModal({ templateMode: true, templateSections: result.sections, sourceFileName: parsed.fileName });
  } catch (err) {
    console.error('[upload-template]', err);
    loading.error(_friendlyError(err));
  }
}
window.HUD_UPLOAD_TEMPLATE = handleUploadTemplate;

// URL-param triggers
const _draftParam = new URLSearchParams(window.location.search).get('draft');
if (_draftParam) {
  const launch = () => openTiptapGateModal({ draftId: _draftParam });
  if (document.readyState === 'complete') launch();
  else window.addEventListener('load', launch);
}
