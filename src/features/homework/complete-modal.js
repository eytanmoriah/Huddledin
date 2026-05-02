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
  header.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;gap:8px;';
  const titleWrap = document.createElement('div');
  titleWrap.style.cssText = 'flex:1;min-width:0;';
  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-weight:700;font-size:16px;color:#0f1a18;';
  titleEl.textContent = exercise.title || 'Exercise';
  titleWrap.appendChild(titleEl);
  const subEl = document.createElement('div');
  subEl.style.cssText = 'font-size:12px;color:#64748b;margin-top:2px;';
  const dateObj = typeof scheduledDate === 'string' ? new Date(scheduledDate + 'T12:00:00') : scheduledDate;
  const today = new Date(); today.setHours(0,0,0,0);
  const dateLabel = dateObj.toDateString() === today.toDateString() ? 'Today' : dateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  subEl.textContent = (slot ? slot.charAt(0).toUpperCase() + slot.slice(1) + ' · ' : '') + dateLabel;
  titleWrap.appendChild(subEl);
  if (exercise.instructions) {
    const instrEl = document.createElement('div');
    instrEl.style.cssText = 'font-size:12px;color:#64748b;line-height:1.4;white-space:pre-wrap;margin-top:6px;';
    instrEl.textContent = exercise.instructions;
    titleWrap.appendChild(instrEl);
  }
  // Attachment chips (per-exercise)
  {
    const attachPaths = exercise.attached_file_paths || [];
    const attachUrls = exercise.attached_file_urls || [];
    const attachNames = exercise.attached_file_names || [];
    const attachCount = Math.max(attachPaths.length, attachUrls.length, attachNames.length);
    if (attachCount > 0) {
      const attachWrap = document.createElement('div');
      attachWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;';
      for (let i = 0; i < attachCount; i++) {
        const path = attachPaths[i] || null;
        const legacyUrl = attachUrls[i] || null;
        const name = attachNames[i] || 'File';
        const isImg = /\.(png|jpe?g|gif|webp)$/i.test(name);
        const chip = document.createElement('div');
        chip.style.cssText = 'display:flex;align-items:center;gap:4px;background:#f0fdf9;border:1px solid #d1e0dd;border-radius:6px;padding:4px 8px;font-size:12px;color:#0f1a18;max-width:100%;';

        // Body — icon/thumb + filename — tap to open in viewer
        const bodyArea = document.createElement('span');
        bodyArea.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;flex:1;min-width:0;';
        let imgEl = null;
        if (isImg) {
          imgEl = document.createElement('img');
          imgEl.style.cssText = 'width:20px;height:20px;object-fit:cover;border-radius:3px;flex-shrink:0;';
          bodyArea.appendChild(imgEl);
        } else {
          bodyArea.appendChild(document.createTextNode('📄'));
        }
        const nameEl = document.createElement('span');
        nameEl.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        nameEl.textContent = name;
        bodyArea.appendChild(nameEl);
        bodyArea.onclick = () => {
          // iOS Safari: open about:blank synchronously to preserve user-gesture context
          const tab = window.open('about:blank', '_blank');
          (async () => {
            let openUrl = null;
            if (path) {
              try {
                const supa = H._supa;
                if (supa) {
                  const { data } = await supa.storage.from('huddledin-files').createSignedUrl(path, 900);
                  if (data?.signedUrl) openUrl = data.signedUrl;
                }
              } catch (_) {}
            }
            if (!openUrl && legacyUrl) openUrl = legacyUrl;
            if (openUrl && tab) tab.location = openUrl;
            else if (tab) tab.close();
          })();
        };
        chip.appendChild(bodyArea);

        // Download button
        let isDownloading = false;
        const dlBtn = document.createElement('button');
        dlBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:#64748b;padding:2px 4px;font-size:14px;line-height:1;flex-shrink:0;font-family:inherit;';
        dlBtn.title = 'Download';
        dlBtn.textContent = '⬇';
        dlBtn.onclick = (e) => {
          e.stopPropagation();
          if (isDownloading) return;
          isDownloading = true;
          dlBtn.disabled = true;
          dlBtn.style.opacity = '0.4';
          const restore = () => {
            setTimeout(() => { isDownloading = false; dlBtn.disabled = false; dlBtn.style.opacity = '1'; }, 1000);
          };
          const resolveDownloadUrl = async () => {
            if (path) {
              try {
                const supa = H._supa;
                if (supa) {
                  const { data } = await supa.storage
                    .from('huddledin-files')
                    .createSignedUrl(path, 900, { download: name });
                  if (data?.signedUrl) return data.signedUrl;
                }
              } catch (_) {}
            }
            return legacyUrl || null; // legacy URL: best-effort, server may not set Content-Disposition
          };
          // iOS Safari: open about:blank synchronously to preserve user-gesture context
          const tab = window.open('about:blank', '_blank');
          if (!tab) {
            // Popup blocked — fall back to anchor click with download attribute
            (async () => {
              const url = await resolveDownloadUrl();
              if (url) {
                const a = document.createElement('a');
                a.href = url;
                a.download = name;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => a.remove(), 0);
              }
              restore();
            })();
            return;
          }
          (async () => {
            const url = await resolveDownloadUrl();
            if (url) tab.location = url;
            else tab.close();
            // Auto-close the blank tab after download starts
            setTimeout(() => { try { tab?.close(); } catch (_) {} }, 1500);
            restore();
          })();
        };
        chip.appendChild(dlBtn);

        attachWrap.appendChild(chip);
        if (imgEl) {
          (async () => {
            if (path) {
              try {
                const supa = H._supa;
                if (supa) {
                  const { data } = await supa.storage.from('huddledin-files').createSignedUrl(path, 900);
                  if (data?.signedUrl) { imgEl.src = data.signedUrl; return; }
                }
              } catch (_) {}
            }
            if (legacyUrl) imgEl.src = legacyUrl;
          })();
        }
      }
      titleWrap.appendChild(attachWrap);
    }
  }
  header.appendChild(titleWrap);
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'width:32px;height:32px;border-radius:50%;border:none;background:#f1f5f9;cursor:pointer;font-size:16px;color:#64748b;display:flex;align-items:center;justify-content:center;flex-shrink:0;';
  closeBtn.onclick = close;
  header.appendChild(closeBtn);
  card.appendChild(header);

  // Status / form swap host
  let selectedStatus = null;
  const actionHost = document.createElement('div');
  card.appendChild(actionHost);

  const statuses = [
    { key: 'done', icon: '✓', label: T('hw4_done'), color: '#0d9488', bg: '#f0fdf9', border: '#d1e0dd' },
    { key: 'skipped', icon: '→', label: T('hw4_skipped'), color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
    { key: 'cant_do', icon: '○', label: T('hw4_cant_do'), color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
  ];

  // Compute available slots once (used by every form render)
  const allSlots = slot ? [slot] : (() => {
    const { exerciseSlotsOn: _esOn } = window.HUD_HOMEWORK_INTERNALS || {};
    if (_esOn) {
      const d = typeof scheduledDate === 'string' ? new Date(scheduledDate + 'T12:00:00') : scheduledDate;
      return _esOn(homework, exercise, d);
    }
    return (homework.time_of_day || 'morning').split(',').filter(Boolean);
  })();

  function renderStatusPicker() {
    selectedStatus = null;
    actionHost.innerHTML = '';
    const cardsWrap = document.createElement('div');
    cardsWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    statuses.forEach(s => {
      const btn = document.createElement('button');
      btn.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;border-radius:10px;border:1.5px solid ' + s.border + ';background:' + s.bg + ';cursor:pointer;font-family:inherit;text-align:left;transition:border-color .12s;';
      btn.innerHTML = '<span style="font-size:20px;flex-shrink:0;width:28px;text-align:center;color:' + s.color + '">' + s.icon + '</span><span style="font-weight:600;font-size:14px;color:' + s.color + '">' + s.label + '</span>';
      btn.onclick = () => renderForm(s);
      cardsWrap.appendChild(btn);
    });
    actionHost.appendChild(cardsWrap);
  }

  function renderForm(s) {
    selectedStatus = s.key;
    actionHost.innerHTML = '';
    const placeholders = { done: T('hw4_note_done'), skipped: T('hw4_note_skipped'), cant_do: T('hw4_note_cant_do') };

    // Back row + status pill
    const backRow = document.createElement('div');
    backRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:14px;';
    const backBtn = document.createElement('button');
    backBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:#0d9488;font-weight:600;font-size:13px;padding:4px 0;font-family:inherit;display:flex;align-items:center;gap:4px;';
    backBtn.innerHTML = '<span style="font-size:14px">←</span> Back';
    backBtn.onclick = () => renderStatusPicker();
    backRow.appendChild(backBtn);
    const pill = document.createElement('span');
    pill.style.cssText = 'font-size:12px;font-weight:700;color:' + s.color + ';display:flex;align-items:center;gap:6px;margin-inline-start:auto;';
    pill.innerHTML = '<span style="font-size:14px">' + s.icon + '</span><span>' + s.label + '</span>';
    backRow.appendChild(pill);
    actionHost.appendChild(backRow);

    // Slot picker for multi-slot exercises (only when slot was null = ambiguous)
    let selectedSlots = allSlots.length === 1 ? [...allSlots] : [];
    if (s.key === 'done' && !slot && allSlots.length > 1) {
      const slotWrap = document.createElement('div');
      slotWrap.style.cssText = 'margin-bottom:12px;';
      slotWrap.appendChild(Object.assign(document.createElement('div'), { textContent: T('hw4_which_session'), style: 'font-size:13px;font-weight:600;color:#334155;margin-bottom:6px;' }));
      const chipRow = document.createElement('div');
      chipRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
      const chipEls = [];
      const updateChips = () => {
        chipEls.forEach(({ el: ce, val }) => {
          const active = selectedSlots.includes(val) || (val === '_both' && selectedSlots.length === allSlots.length);
          ce.style.background = active ? '#0d9488' : '#f1f5f9';
          ce.style.color = active ? '#fff' : '#334155';
          ce.style.borderColor = active ? '#0d9488' : '#e2e8f0';
        });
      };
      allSlots.forEach(sl => {
        const ch = document.createElement('button');
        ch.style.cssText = 'padding:6px 14px;border-radius:99px;border:1.5px solid #e2e8f0;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;transition:all .12s;';
        ch.textContent = sl.charAt(0).toUpperCase() + sl.slice(1);
        ch.onclick = () => { selectedSlots = [sl]; updateChips(); };
        chipRow.appendChild(ch);
        chipEls.push({ el: ch, val: sl });
      });
      if (allSlots.length > 1) {
        const bothChip = document.createElement('button');
        bothChip.style.cssText = 'padding:6px 14px;border-radius:99px;border:1.5px solid #e2e8f0;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;transition:all .12s;';
        bothChip.textContent = T('hw4_both');
        bothChip.onclick = () => { selectedSlots = [...allSlots]; updateChips(); };
        chipRow.appendChild(bothChip);
        chipEls.push({ el: bothChip, val: '_both' });
      }
      slotWrap.appendChild(chipRow);
      actionHost.appendChild(slotWrap);
      updateChips();
    } else {
      selectedSlots = [...allSlots];
    }

    // "How many?" field for done status when exercise has a measure
    let actualValueInput = null;
    const prescribed = _prescribedValue(exercise);
    if (s.key === 'done' && prescribed > 0) {
      const fieldWrap = document.createElement('div');
      fieldWrap.style.cssText = 'margin-bottom:12px;';
      const label = document.createElement('div');
      label.style.cssText = 'font-size:13px;font-weight:600;color:#334155;margin-bottom:4px;';
      label.textContent = exercise.duration_seconds ? T('hw4_how_many_min') : T('hw4_how_many_reps');
      fieldWrap.appendChild(label);
      actualValueInput = document.createElement('input');
      actualValueInput.type = 'number';
      actualValueInput.className = 'hw2-input';
      actualValueInput.value = String(prescribed);
      actualValueInput.min = '0';
      actualValueInput.max = String(prescribed * 2);
      actualValueInput.style.cssText = 'width:100px;text-align:center;font-size:16px;font-weight:600;';
      fieldWrap.appendChild(actualValueInput);
      actionHost.appendChild(fieldWrap);
    }

    const noteInp = document.createElement('textarea');
    noteInp.className = 'hw2-input hw2-textarea';
    noteInp.placeholder = placeholders[s.key] || '';
    noteInp.style.marginBottom = '10px';
    actionHost.appendChild(noteInp);

    // Photo upload
    let photoUrl = null;
    const photoRow = document.createElement('div');
    photoRow.style.cssText = 'display:flex;gap:8px;margin-bottom:14px;align-items:center;';
    const photoBtn = document.createElement('button');
    photoBtn.className = 'hw2-ghost-btn';
    photoBtn.textContent = '📷 ' + T('hw4_add_photo');
    photoBtn.onclick = async () => {
      const fi = document.createElement('input');
      fi.type = 'file'; fi.accept = 'image/*'; fi.capture = 'environment';
      fi.onchange = async (ev) => {
        const f = ev.target.files?.[0]; if (!f) return;
        photoBtn.disabled = true; photoBtn.textContent = 'Uploading…';
        try {
          const { url } = await H.SB.uploadFile('homework/' + childId + '/' + exercise.id, f);
          photoUrl = url;
          photoBtn.textContent = '✓ Photo added';
        } catch (e) { H.toast?.('Upload failed.', 'error'); photoBtn.textContent = '📷 ' + T('hw4_add_photo'); }
        photoBtn.disabled = false;
      };
      fi.click();
    };
    photoRow.appendChild(photoBtn);
    actionHost.appendChild(photoRow);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.style.cssText = 'width:100%;padding:14px;border:none;border-radius:10px;background:#0d9488;color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;';
    saveBtn.textContent = T('hw4_save');
    saveBtn.onclick = async () => {
      if (s.key === 'done' && !slot && allSlots.length > 1 && selectedSlots.length === 0) {
        H.toast?.(T('hw4_pick_slot'), 'error');
        return;
      }
      saveBtn.disabled = true; saveBtn.textContent = T('btn_loading');
      try {
        let actualValue = null;
        if (actualValueInput && s.key === 'done') {
          const val = parseInt(actualValueInput.value, 10);
          if (!isNaN(val) && val !== prescribed) actualValue = val;
        }

        const slotsToSave = selectedSlots.length ? selectedSlots : allSlots;
        let anyAlready = false;
        for (const sl of slotsToSave) {
          const result = await logExerciseCompletion({
            homework, exercise, scheduledDate: typeof scheduledDate === 'string' ? scheduledDate : undefined,
            slot: sl, status: selectedStatus, note: noteInp.value.trim() || null, photoUrl, actualValue, childId,
          });
          if (result.alreadyMarked) anyAlready = true;
        }
        if (anyAlready && slotsToSave.length === 1) {
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
    actionHost.appendChild(saveBtn);
  }

  function _prescribedValue(ex) {
    if (ex.duration_seconds) return Math.round(ex.duration_seconds / 60);
    if (ex.sets && ex.reps) return ex.sets * ex.reps;
    if (ex.reps) return ex.reps;
    return 0;
  }

  renderStatusPicker();

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}
