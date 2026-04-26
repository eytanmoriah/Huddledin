// Homework creation/edit modal — Phase 2a scaffold

export function mountHomeworkCreateModal(opts = {}) {
  const { childId, existingHomeworkId } = opts;
  const H = window.HUD || {};
  const child = H.DB?.children?.find(c => c.id === childId);
  const childName = child?.name || 'Patient';
  const isEdit = !!existingHomeworkId;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:450;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;';

  const card = document.createElement('div');
  card.style.cssText = 'background:#f5fafa;border-radius:14px;width:100%;max-width:380px;max-height:calc(100vh - 32px);overflow-y:auto;padding:24px;position:relative;box-shadow:0 8px 32px rgba(0,0,0,.2);text-align:center;';

  const close = document.createElement('button');
  close.textContent = '\u2715';
  close.style.cssText = 'position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:50%;border:none;background:#e8f4f2;cursor:pointer;font-size:18px;color:#64748b;display:flex;align-items:center;justify-content:center;';
  close.onclick = () => overlay.remove();
  card.appendChild(close);

  const title = document.createElement('h2');
  title.textContent = (isEdit ? 'Edit homework' : 'New homework') + ' \u00b7 ' + childName;
  title.style.cssText = 'margin:0 0 20px;font-size:17px;font-weight:700;color:#0f1a18;';
  card.appendChild(title);

  const placeholder = document.createElement('div');
  placeholder.style.cssText = 'padding:32px 0;color:#64748b;font-size:14px;';
  placeholder.textContent = 'Phase 2a: scaffold ready \u2714';
  card.appendChild(placeholder);

  overlay.appendChild(card);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}
