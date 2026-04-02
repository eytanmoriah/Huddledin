let _injected = false;
export function injectStyles() {
  if (_injected) return;
  _injected = true;
  const s = document.createElement('style');
  s.textContent = `
.rpt-card{background:#fff;border-radius:14px;border:1.5px solid #e8f4f2;padding:16px;margin-bottom:10px;cursor:pointer;transition:border-color .15s,box-shadow .15s}
.rpt-card:hover{border-color:#0d9488;box-shadow:0 4px 16px rgba(13,148,136,.1)}
.rpt-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:.65rem;font-weight:700}
.rpt-badge-draft{background:#fef3c7;color:#92400e}
.rpt-badge-generated{background:#dbeafe;color:#1e40af}
.rpt-badge-finalized{background:#d1fae5;color:#065f46}
.rpt-tpl-card{background:#fff;border-radius:14px;border:1.5px solid #e8f4f2;padding:20px;cursor:pointer;transition:border-color .15s,transform .15s;position:relative}
.rpt-tpl-card:hover{border-color:#0d9488;transform:translateY(-2px)}
.rpt-sec-check{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:10px;margin-bottom:6px;transition:background .12s}
.rpt-sec-check:hover{background:#f0fdf9}
.rpt-sec-check input[type=checkbox]{margin-top:3px;accent-color:#0d9488;width:16px;height:16px;flex-shrink:0}
.rpt-sec-group{margin-bottom:16px}
.rpt-sec-group-title{font-size:.72rem;font-weight:800;color:#0d9488;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.rpt-form-section{margin-bottom:20px;padding:16px;background:#fff;border-radius:14px;border:1px solid #e8f4f2}
.rpt-form-section-title{font-weight:800;color:#0f172a;font-size:.9rem;margin-bottom:4px}
.rpt-form-section-desc{font-size:.74rem;color:#64748b;margin-bottom:12px}
.rpt-form-label{display:block;font-size:.74rem;font-weight:600;color:#475569;margin-bottom:4px}
.rpt-form-input{width:100%;padding:9px 12px;border-radius:10px;border:1.5px solid #d1fae5;font-size:.84rem;font-family:inherit;box-sizing:border-box;transition:border-color .15s}
.rpt-form-input:focus{border-color:#0d9488;outline:none;box-shadow:0 0 0 3px rgba(13,148,136,.12)}
.rpt-form-textarea{min-height:80px;resize:vertical}
.rpt-counter{font-size:.72rem;color:#64748b;font-weight:600}
  `;
  document.head.appendChild(s);
}
