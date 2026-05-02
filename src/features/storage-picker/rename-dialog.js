// Rename dialog — single-screen modal to confirm/edit a filename before save.

export function showRenameDialog({ originalName, onConfirm, onCancel }) {
  const H = window.HUD || {};
  const { openModal, mkBtn, el, toast } = H;
  if (!openModal || !mkBtn || !el) {
    onConfirm?.(originalName);
    return;
  }

  openModal('Save as…', (mb, close) => {
    let isSaving = false;

    mb.appendChild(el('div', { class: 'inp-label' }, ['Filename']));

    const inputRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' } });
    const inp = el('input', { class: 'inp', style: { flex: '1' } });
    inp.value = originalName || '';
    inputRow.appendChild(inp);
    inputRow.appendChild(el('span', { style: { fontSize: '1rem', color: 'var(--slate-l)' } }, ['✏️']));
    mb.appendChild(inputRow);

    const row = el('div', { style: { display: 'flex', gap: '10px' } });
    row.appendChild(mkBtn('Cancel', 'btn-md btn-ghost', () => { close(); onCancel?.(); }));
    const okBtn = mkBtn('Save', 'btn-md btn-primary btn-full', () => {
      if (isSaving) return;
      const finalName = (inp.value || '').trim();
      if (!finalName) { toast?.('Filename cannot be empty.', 'error'); return; }
      isSaving = true;
      okBtn.disabled = true;
      okBtn.textContent = 'Saving…';
      close();
      onConfirm?.(finalName);
    });
    row.appendChild(okBtn);
    mb.appendChild(row);

    setTimeout(() => { try { inp.focus(); inp.select(); } catch (_) {} }, 50);
  }, 380);
}
