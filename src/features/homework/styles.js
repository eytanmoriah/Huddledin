// Scoped CSS for homework creation UI

let _injected = false;

export function injectHomeworkStyles() {
  if (_injected) return;
  _injected = true;
  const s = document.createElement('style');
  s.id = 'homework-v2-css';
  s.textContent = `
    .hw2-modal { background:#f5fafa; border-radius:14px; width:100%; max-width:380px; max-height:calc(100vh - 32px); overflow-y:auto; padding:0; position:relative; box-shadow:0 8px 32px rgba(0,0,0,.2); }
    .hw2-header { position:sticky; top:0; z-index:10; background:#f5fafa; padding:16px 20px 12px; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between; }
    .hw2-body { padding:16px 20px 20px; }
    .hw2-section-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#64748b; margin:16px 0 8px; }
    .hw2-input { width:100%; padding:10px 12px; border:1.5px solid #d1e0dd; border-radius:8px; font-size:15px; font-family:inherit; box-sizing:border-box; outline:none; background:#fff; }
    .hw2-input:focus { border-color:#0d9488; }
    .hw2-input::placeholder { color:#94a3b8; }
    .hw2-textarea { resize:vertical; min-height:60px; }
  `;
  document.head.appendChild(s);
}
