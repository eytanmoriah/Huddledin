// Completion modal — slide-up for marking exercise done/skipped/cant_do

import { logExerciseCompletion } from './data.js';
import { injectHomeworkStyles } from './styles.js';

const T = (k, p) => window.HUD?.T?.(k, p) || k;

export function mountCompleteModal({ homework, exercise, slot, scheduledDate, childId, onSaved }) {
  injectHomeworkStyles();
  const H = window.HUD || {};

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:460;background:rgba(0,0,0,.4);display:flex;align-items:flex-end;justify-content:center;';

  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:420px;max-height:80vh;overflow-y:auto;padding:20px 16px 24px;box-shadow:0 -4px 24px rgba(0,0,0,.1);';

  function close() { overlay.remove(); }
  overlay.onclick = (e) => { if (e.target === overlay) close(); };

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';
  const titleWrap = document.createElement('div');
  titleWrap.innerHTML = '';
  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-weight:700;font-size:16px;color:#0f1a18;';
  titleEl.textContent = exercise.title || 'Exercise';
  titleWrap.appendChild(titleEl);
  const subEl = document.createElement('div');
  subEl.style.cssText = 'font-size:12px;color:#64748b;margin-top:2px;';
  const dateObj = typeof scheduledDate === 'string' ? new Date(scheduledDate + 'T12:00:00') : scheduledDate;
  const today = new Date(); today.setHours(0,0,0,0);
  const dateLabel = dateObj.toDateString() === today.toDateString() ? 'Today' : dateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  subEl.textContent = (slot ? slot.charAt(0).toUpperCase() + slot.slice(1) + ' \u00b7 ' : '') + dateLabel;
  titleWrap.appendChild(subEl);
  header.appendChild(titleWrap);
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '\u2715';
  closeBtn.style.cssText = 'width:32px;height:32px;border-radius:50%;border:none;background:#f1f5f9;cursor:pointer;font-size:16px;color:#64748b;display:flex;align-items:center;justify-content:center;';
  closeBtn.onclick = close;
  header.appendChild(closeBtn);
  card.appendChild(header);

  // Status cards
  let selectedStatus = null;
  const formHost = document.createElement('div');

  const statuses = [
    { key: 'done', icon: '\u2713', label: T('hw4_done'), color: '#0d9488', bg: '#f0fdf9', border: '#d1e0dd' },
    { key: 'skipped', icon: '\u2192', label: T('hw4_skipped'), color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
    { key: 'cant_do', icon: '\u26a0', label: T('hw4_cant_do'), color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  ];

  const cardsWrap = document.createElement('div');
  cardsWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:16px;';

  statuses.forEach(s => {
    const btn = document.createElement('button');
    btn.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;border-radius:10px;border:1.5px solid ' + s.border + ';background:' + s.bg + ';cursor:pointer;font-family:inherit;text-align:left;transition:border-color .12s;';
    btn.innerHTML = '<span style="font-size:20px;flex-shrink:0;width:28px;text-align:center;color:' + s.color + '">' + s.icon + '</span><span style="font-weight:600;font-size:14px;color:' + s.color + '">' + s.label + '</span>';
    btn.onclick = () => {
      selectedStatus = s.key;
      cardsWrap.querySelectorAll('button').forEach(b => { b.style.borderColor = '#e2e8f0'; b.style.boxShadow = ''; });
      btn.style.borderColor = s.color;
      btn.style.boxShadow = '0 0 0 2px ' + s.color + '33';
      _renderForm(s);
    };
    cardsWrap.appendChild(btn);
  });
  card.appendChild(cardsWrap);
  card.appendChild(formHost);

  function _renderForm(s) {
    formHost.innerHTML = '';
    const placeholders = { done: T('hw4_note_done'), skipped: T('hw4_note_skipped'), cant_do: T('hw4_note_cant_do') };

    const noteInp = document.createElement('textarea');
    noteInp.className = 'hw2-input hw2-textarea';
    noteInp.placeholder = placeholders[s.key] || '';
    noteInp.style.marginBottom = '10px';
    formHost.appendChild(noteInp);

    // Photo upload
    let photoUrl = null;
    const photoRow = document.createElement('div');
    photoRow.style.cssText = 'display:flex;gap:8px;margin-bottom:14px;align-items:center;';
    const photoBtn = document.createElement('button');
    photoBtn.className = 'hw2-ghost-btn';
    photoBtn.textContent = '\ud83d\udcf7 ' + T('hw4_add_photo');
    photoBtn.onclick = async () => {
      const fi = document.createElement('input');
      fi.type = 'file'; fi.accept = 'image/*'; fi.capture = 'environment';
      fi.onchange = async (ev) => {
        const f = ev.target.files?.[0]; if (!f) return;
        photoBtn.disabled = true; photoBtn.textContent = 'Uploading\u2026';
        try {
          const { url } = await H.SB.uploadFile('homework/' + childId + '/' + exercise.id, f);
          photoUrl = url;
          photoBtn.textContent = '\u2713 Photo added';
        } catch (e) { H.toast?.('Upload failed.', 'error'); photoBtn.textContent = '\ud83d\udcf7 ' + T('hw4_add_photo'); }
        photoBtn.disabled = false;
      };
      fi.click();
    };
    photoRow.appendChild(photoBtn);
    formHost.appendChild(photoRow);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.style.cssText = 'width:100%;padding:14px;border:none;border-radius:10px;background:#0d9488;color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;';
    saveBtn.textContent = T('hw4_save');
    saveBtn.onclick = async () => {
      saveBtn.disabled = true; saveBtn.textContent = T('btn_loading');
      try {
        const result = await logExerciseCompletion({
          homework, exercise, scheduledDate: typeof scheduledDate === 'string' ? scheduledDate : undefined,
          slot, status: selectedStatus, note: noteInp.value.trim() || null, photoUrl, childId,
        });
        if (result.alreadyMarked) {
          H.toast?.(T('hw4_already_marked'), 'info');
          saveBtn.disabled = false; saveBtn.textContent = T('hw4_save');
          return;
        }
        close();
        const toasts = { done: T('hw4_marked_done'), skipped: T('hw4_marked_skipped'), cant_do: T('hw4_marked_cant_do') };
        H.toast?.(toasts[selectedStatus] || 'Saved');
        onSaved?.();
      } catch (e) {
        H.toast?.('Could not save.', 'error');
        saveBtn.disabled = false; saveBtn.textContent = T('hw4_save');
      }
    };
    formHost.appendChild(saveBtn);

    // Cancel
    const cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = 'width:100%;padding:10px;border:none;background:none;color:#64748b;font-size:13px;cursor:pointer;font-family:inherit;margin-top:8px;';
    cancelBtn.textContent = T('hw3_cancel');
    cancelBtn.onclick = close;
    formHost.appendChild(cancelBtn);
  }

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}
