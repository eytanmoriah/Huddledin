// Huddledin Module Entry Point
import { initReports } from './features/reports/index.js';

console.log('[Huddledin] Module system loaded');

if (window.HUD) {
  initReports();
} else {
  window.addEventListener('hud-ready', () => initReports());
}

// Tiptap editor gate — opens full-screen editor modal. Shared by URL-param gate and beta button.
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
  }

  const close = document.createElement('button');
  close.textContent = '\u2715';
  close.style.cssText = 'position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:50%;border:none;background:#e8f4f2;cursor:pointer;font-size:18px;color:#64748b;display:flex;align-items:center;justify-content:center;z-index:1;';
  close.onclick = () => closeModal();
  card.appendChild(close);
  const title = document.createElement('h2');
  let titleText = 'New Editor (Beta)';
  if (opts.childId) {
    const db = window.HUD?.DB?.children || [];
    const ls = window.HUD?.LS?.get?.('children', []) || [];
    const child = [...db, ...ls].find(c => c.id === opts.childId);
    if (child?.name) titleText += ' \u2014 ' + child.name;
  }
  title.textContent = titleText;
  title.style.cssText = 'margin:0 0 16px;font-size:18px;font-weight:700;color:#0f1a18;';
  card.appendChild(title);
  const editorHost = document.createElement('div');
  card.appendChild(editorHost);
  overlay.appendChild(card);
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  document.body.appendChild(overlay);
  const { mountGateEditor } = await import('./features/reports/tiptap-gate.js');
  gateEditor = await mountGateEditor(editorHost, opts);
}
// Expose for the beta button in reports module
window.HUD_openTiptapGate = openTiptapGateModal;

// URL-param triggers
const _urlParams = new URLSearchParams(window.location.search);
const _draftParam = _urlParams.get('draft');
const _gateParam = _urlParams.get('tiptap_gate');

if (_draftParam || _gateParam === '1') {
  const gateOpts = {};
  if (_draftParam) gateOpts.draftId = _draftParam;
  const launch = () => openTiptapGateModal(gateOpts);
  if (document.readyState === 'complete') launch();
  else window.addEventListener('load', launch);
}
