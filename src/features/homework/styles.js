// Scoped CSS for homework creation UI

let _injected = false;

export function injectHomeworkStyles() {
  if (_injected) return;
  _injected = true;
  const s = document.createElement('style');
  s.id = 'homework-v2-css';
  s.textContent = `
    .hw2-modal { background:#f5fafa; border-radius:14px; width:100%; max-width:420px; max-height:calc(100vh - 32px); overflow-y:auto; position:relative; box-shadow:0 8px 32px rgba(0,0,0,.2); }
    .hw2-header { position:sticky; top:0; z-index:10; background:#f5fafa; padding:14px 16px; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; gap:8px; }
    .hw2-body { padding:16px 16px 24px; }
    .hw2-section-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#64748b; margin:16px 0 8px; }
    .hw2-input { width:100%; padding:10px 12px; border:1.5px solid #d1e0dd; border-radius:8px; font-size:15px; font-family:inherit; box-sizing:border-box; outline:none; background:#fff; }
    .hw2-input:focus { border-color:#0d9488; }
    .hw2-input::placeholder { color:#94a3b8; }
    .hw2-textarea { resize:vertical; min-height:60px; }
    .hw2-pill { padding:7px 14px; border:1.5px solid #d1e0dd; border-radius:99px; background:#fff; font-size:13px; cursor:pointer; font-family:inherit; font-weight:500; color:#334155; transition:all .12s; }
    .hw2-pill:hover { border-color:#0d9488; color:#0d9488; }
    .hw2-pill.active { background:#0d9488; color:#fff; border-color:#0d9488; }
    .hw2-ghost-btn { padding:8px 14px; border:1.5px solid #d1e0dd; border-radius:8px; background:#fff; font-size:13px; cursor:pointer; font-family:inherit; color:#64748b; transition:background .12s; }
    .hw2-ghost-btn:hover { background:#f0fdf9; }
    .hw2-chk { width:20px; height:20px; border-radius:6px; border:2px solid #d1e0dd; display:flex; align-items:center; justify-content:center; font-size:12px; color:#fff; flex-shrink:0; cursor:pointer; transition:all .12s; }
    .hw2-chk.checked { background:#0d9488; border-color:#0d9488; }
    .hw-bubble-daybox-row::-webkit-scrollbar { display:none; }
    .hw-spec-card-header { transition: background-color .12s; border-radius: 8px; margin: -4px -6px; padding: 4px 6px; }
    .hw-spec-daybox { transition: transform .12s, border-color .12s; }
    @media (hover: hover) {
      .hw-spec-card-header:hover { background-color: #f5fafa; }
      .hw-spec-daybox:hover { transform: scale(1.08); }
    }
  `;
  document.head.appendChild(s);
}
