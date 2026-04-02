// Report Styles — injected once into the document

let _injected = false;

export function injectStyles() {
  if (_injected) return;
  _injected = true;
  const style = document.createElement('style');
  style.textContent = `
    .rpt-hub-card{background:#fff;border-radius:14px;border:1.5px solid #e8f4f2;padding:16px;margin-bottom:10px;cursor:pointer;transition:border-color .15s,box-shadow .15s}
    .rpt-hub-card:hover{border-color:#0d9488;box-shadow:0 4px 16px rgba(13,148,136,.1)}
    .rpt-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:99px;font-size:.65rem;font-weight:700}
    .rpt-badge-draft{background:#fef3c7;color:#92400e}
    .rpt-badge-generated{background:#dbeafe;color:#1e40af}
    .rpt-badge-finalized{background:#d1fae5;color:#065f46}
    .rpt-template-card{background:#fff;border-radius:14px;border:1.5px solid #e8f4f2;padding:20px;cursor:pointer;transition:border-color .15s,transform .15s}
    .rpt-template-card:hover{border-color:#0d9488;transform:translateY(-2px)}
    .rpt-preview-text{white-space:pre-wrap;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:.84rem;line-height:1.7;color:#1e293b;padding:20px;background:#fff;border-radius:14px;border:1px solid #e8f4f2}
    .rpt-counter{font-size:.72rem;color:#64748b;font-weight:600}
  `;
  document.head.appendChild(style);
}
