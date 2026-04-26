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

  // Compute available slots for multi-slot picker
  const allSlots = slot ? [slot] : (() => {
    const { exerciseSlotsOn: _esOn } = window.HUD_HOMEWORK_INTERNALS || {};
    if (_esOn) {
      const d = typeof scheduledDate === 'string' ? new Date(scheduledDate + 'T12:00:00') : scheduledDate;
      return _esOn(homework, exercise, d);
    }
    return (homework.time_of_day || 'morning').split(',').filter(Boolean);
  })();

  function _renderForm(s) {
    formHost.innerHTML = '';
    const placeholders = { done: T('hw4_note_done'), skipped: T('hw4_note_skipped'), cant_do: T('hw4_note_cant_do') };

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
        const chip = document.createElement('button');
        chip.style.cssText = 'padding:6px 14px;border-radius:99px;border:1.5px solid #e2e8f0;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;transition:all .12s;';
        chip.textContent = sl.charAt(0).toUpperCase() + sl.slice(1);
        chip.onclick = () => { selectedSlots = [sl]; updateChips(); };
        chipRow.appendChild(chip);
        chipEls.push({ el: chip, val: sl });
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
      formHost.appendChild(slotWrap);
      updateChips();
    } else {
      selectedSlots = allSlots.length === 1 ? [...allSlots] : [...allSlots];
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
      formHost.appendChild(fieldWrap);
    }

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
      // Validate slot selection for multi-slot
      if (s.key === 'done' && !slot && allSlots.length > 1 && selectedSlots.length === 0) {
        H.toast?.(T('hw4_pick_slot'), 'error');
        return;
      }
      saveBtn.disabled = true; saveBtn.textContent = T('btn_loading');
      try {
        // Compute actual_value: NULL if unchanged from prescribed, number if changed
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
    formHost.appendChild(saveBtn);

    // Cancel
    const cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = 'width:100%;padding:10px;border:none;background:none;color:#64748b;font-size:13px;cursor:pointer;font-family:inherit;margin-top:8px;';
    cancelBtn.textContent = T('hw3_cancel');
    cancelBtn.onclick = close;
    formHost.appendChild(cancelBtn);
  }

  function _prescribedValue(ex) {
    if (ex.duration_seconds) return Math.round(ex.duration_seconds / 60);
    if (ex.sets && ex.reps) return ex.sets * ex.reps;
    if (ex.reps) return ex.reps;
    return 0;
  }

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}
