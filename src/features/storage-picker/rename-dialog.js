// Rename dialog — single-screen modal to confirm/edit a filename before save.
// Extension is locked as a non-editable suffix to prevent users from accidentally
// stripping it (Windows/macOS can't open extensionless files).

export function showRenameDialog({ originalName, sourceExt, onConfirm, onCancel }) {
  const H = window.HUD || {};
  const { openModal, mkBtn, el, toast } = H;
  if (!openModal || !mkBtn || !el) {
    onConfirm?.(originalName);
    return;
  }

  // Parse base + extension from originalName, fall back to sourceExt for the lock
  const _parsed = (() => {
    const name = originalName || '';
    const dot = name.lastIndexOf('.');
    if (dot > 0) return { base: name.slice(0, dot), ext: name.slice(dot + 1).toLowerCase() };
    return { base: name, ext: (sourceExt || '').toLowerCase() };
  })();
  const lockedExt = _parsed.ext;
  const dotExt = lockedExt ? '.' + lockedExt : '';

  openModal('Save as…', (mb, close) => {
    let isSaving = false;

    mb.appendChild(el('div', { class: 'inp-label' }, ['Filename']));

    const inputRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' } });
    const inp = el('input', { class: 'inp', style: { flex: '1' } });
    inp.value = _parsed.base;
    inputRow.appendChild(inp);
    if (lockedExt) {
      const extLabel = el('span', {
        style: {
          fontSize: '0.92rem',
          color: 'var(--slate)',
          fontWeight: '600',
          padding: '0 8px',
          background: 'var(--mint-ll)',
          border: '1px solid var(--mint-l)',
          borderRadius: '6px',
          flexShrink: '0',
          userSelect: 'none',
          lineHeight: '2.2',
        }
      }, [dotExt]);
      inputRow.appendChild(extLabel);
    } else {
      // No extension on source — show pencil so the user knows the field is editable
      inputRow.appendChild(el('span', { style: { fontSize: '1rem', color: 'var(--slate-l)' } }, ['✏️']));
    }
    mb.appendChild(inputRow);

    const row = el('div', { style: { display: 'flex', gap: '10px' } });
    row.appendChild(mkBtn('Cancel', 'btn-md btn-ghost', () => { close(); onCancel?.(); }));
    const okBtn = mkBtn('Save', 'btn-md btn-primary btn-full', () => {
      if (isSaving) return;
      const base = (inp.value || '').trim();
      if (!base) { toast?.('Filename cannot be empty.', 'error'); return; }
      const finalName = base + dotExt;
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
