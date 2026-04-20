// Huddledin Module Entry Point
import { initReports } from './features/reports/index.js';

console.log('[Huddledin] Module system loaded');

if (window.HUD) {
  initReports();
} else {
  window.addEventListener('hud-ready', () => initReports());
}

// Hidden Tiptap editor gate — ?tiptap_gate=1 opens a full-screen test modal
if (new URLSearchParams(window.location.search).get('tiptap_gate') === '1') {
  const _openGate = async () => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;';
    const card = document.createElement('div');
    card.style.cssText = 'background:#f5fafa;border-radius:14px;width:100%;max-width:900px;max-height:calc(100vh - 32px);overflow-y:auto;padding:24px;position:relative;box-shadow:0 8px 32px rgba(0,0,0,.2);';
    const close = document.createElement('button');
    close.textContent = '\u2715';
    close.style.cssText = 'position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:50%;border:none;background:#e8f4f2;cursor:pointer;font-size:18px;color:#64748b;display:flex;align-items:center;justify-content:center;z-index:1;';
    close.onclick = () => { overlay.remove(); };
    card.appendChild(close);
    const title = document.createElement('h2');
    title.textContent = 'Tiptap Editor Gate Test';
    title.style.cssText = 'margin:0 0 16px;font-size:18px;font-weight:700;color:#0f1a18;';
    card.appendChild(title);
    const editorHost = document.createElement('div');
    card.appendChild(editorHost);
    overlay.appendChild(card);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
    const { mountGateEditor } = await import('./features/reports/tiptap-gate.js');
    await mountGateEditor(editorHost);
  };
  if (document.readyState === 'complete') _openGate();
  else window.addEventListener('load', _openGate);
}
