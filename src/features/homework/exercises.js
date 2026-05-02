// Exercise rows component — list of exercises with add/remove, drag-reorder, per-exercise overrides

import { renderMiniSchedule } from './schedule.js';
import { showUploadChooser } from '../storage-picker/upload-chooser.js';
import { showStorageBrowser } from '../storage-picker/storage-browser.js';
import { showRenameDialog } from '../storage-picker/rename-dialog.js';

export function renderExerciseRows(exercises, onChange, homeworkState, ctx) {
  const el = (tag, attrs = {}, kids = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else e.setAttribute(k, v);
    }
    for (const c of kids) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return e;
  };

  const wrap = el('div');
  let dragIdx = null;

  function _rebuildRepWrap(rw, ex, idx) {
    rw.innerHTML = '';
    if (ex.sets || ex.reps) {
      const setsInp = el('input', { type: 'number', class: 'hw2-input', style: { width: '42px', textAlign: 'center', padding: '6px 4px' }, placeholder: '#' });
      setsInp.value = ex.sets || '';
      setsInp.oninput = () => { exercises[idx].sets = parseInt(setsInp.value) || null; onChange(exercises); };
      rw.appendChild(setsInp);
      rw.appendChild(el('span', { style: { color: '#94a3b8', fontSize: '13px' } }, ['\u00d7']));
      const repsInp = el('input', { type: 'number', class: 'hw2-input', style: { width: '42px', textAlign: 'center', padding: '6px 4px' }, placeholder: '#' });
      repsInp.value = ex.reps || '';
      repsInp.oninput = () => { exercises[idx].reps = parseInt(repsInp.value) || null; onChange(exercises); };
      rw.appendChild(repsInp);
    } else if (ex.durationSeconds) {
      const durInp = el('input', { type: 'number', class: 'hw2-input', style: { width: '50px', textAlign: 'center', padding: '6px 4px' }, placeholder: '#' });
      durInp.value = Math.round(ex.durationSeconds / 60) || '';
      durInp.oninput = () => { exercises[idx].durationSeconds = (parseInt(durInp.value) || 0) * 60; onChange(exercises); };
      rw.appendChild(durInp);
      rw.appendChild(el('span', { style: { color: '#94a3b8', fontSize: '12px' } }, ['min']));
    }
  }

  function _render() {
    wrap.innerHTML = '';

    exercises.forEach((ex, idx) => {
      const hasOverride = ex.overrideRecurrence || ex.overrideSpecificDays || ex.overrideTimeOfDay;
      const row = el('div', { style: { background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '12px', marginBottom: '8px', transition: 'opacity .15s' } });
      row.draggable = true;
      row.ondragstart = (e) => { dragIdx = idx; row.style.opacity = '0.5'; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx)); };
      row.ondragend = () => { row.style.opacity = '1'; dragIdx = null; };
      row.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
      row.ondrop = (e) => {
        e.preventDefault();
        if (dragIdx === null || dragIdx === idx) return;
        const moved = exercises.splice(dragIdx, 1)[0];
        exercises.splice(idx, 0, moved);
        dragIdx = null;
        onChange(exercises); _render();
      };

      // Top row: drag handle + title + override pill + remove
      const top = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } });
      const handle = el('span', { style: { color: '#cbd5e1', fontSize: '14px', cursor: 'grab', userSelect: 'none', flexShrink: '0' } }, ['\u22ee\u22ee']);
      top.appendChild(handle);

      const titleInp = el('input', { type: 'text', class: 'hw2-input', placeholder: 'Exercise title', style: { flex: '1', fontWeight: '600' } });
      titleInp.value = ex.title || '';
      titleInp.maxLength = 200;
      titleInp.oninput = () => { exercises[idx].title = titleInp.value; onChange(exercises); };
      top.appendChild(titleInp);

      // Override pill indicator
      if (hasOverride) {
        const pill = el('span', { style: { fontSize: '10px', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: '99px', whiteSpace: 'nowrap', flexShrink: '0' } }, ['Custom']);
        top.appendChild(pill);
      }

      // Reps/duration inline
      const repWrap = el('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', flexShrink: '0' } });
      _rebuildRepWrap(repWrap, ex, idx);
      top.appendChild(repWrap);

      // Remove button
      const removeBtn = el('button', { style: { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '18px', padding: '2px 6px', flexShrink: '0', transition: 'color .12s' } }, ['\u2715']);
      removeBtn.onmouseenter = () => { removeBtn.style.color = '#dc2626'; };
      removeBtn.onmouseleave = () => { removeBtn.style.color = '#94a3b8'; };
      if (exercises.length <= 1) { removeBtn.disabled = true; removeBtn.style.opacity = '0.3'; removeBtn.style.cursor = 'default'; }
      removeBtn.onclick = () => { if (exercises.length <= 1) return; exercises.splice(idx, 1); onChange(exercises); _render(); };
      top.appendChild(removeBtn);

      row.appendChild(top);

      // More toggle
      const moreBtn = el('button', { style: { background: 'none', border: 'none', cursor: 'pointer', color: '#0d9488', fontSize: '12px', fontWeight: '600', padding: '6px 0 0', fontFamily: 'inherit' } }, [ex._ui?.expanded ? '\u25b2 Less' : '\u25bc More']);
      const morePanel = el('div', { style: { display: ex._ui?.expanded ? 'block' : 'none', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' } });

      moreBtn.onclick = () => {
        exercises[idx]._ui = exercises[idx]._ui || {};
        exercises[idx]._ui.expanded = !exercises[idx]._ui.expanded;
        morePanel.style.display = exercises[idx]._ui.expanded ? 'block' : 'none';
        moreBtn.textContent = exercises[idx]._ui.expanded ? '\u25b2 Less' : '\u25bc More';
      };
      row.appendChild(moreBtn);

      // Expanded: instructions
      const instrInp = el('textarea', { class: 'hw2-input hw2-textarea', placeholder: 'Optional details for this exercise...', style: { marginBottom: '8px' } });
      instrInp.value = ex.instructions || '';
      instrInp.oninput = () => { exercises[idx].instructions = instrInp.value; onChange(exercises); };
      morePanel.appendChild(instrInp);

      // Measure mode selector
      const measureRow = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' } });
      const curMode = (ex.sets || ex.reps) ? 'reps' : ex.durationSeconds ? 'duration' : 'none';
      const measureBtns = {};
      [['none', 'No measure'], ['reps', 'Sets \u00d7 Reps'], ['duration', 'Minutes']].forEach(([val, label]) => {
        const b = el('button', { class: 'hw2-pill' + (curMode === val ? ' active' : '') }, [label]);
        b.onclick = () => {
          Object.values(measureBtns).forEach(mb => mb.classList.remove('active'));
          b.classList.add('active');
          if (val === 'none') { exercises[idx].sets = null; exercises[idx].reps = null; exercises[idx].durationSeconds = null; }
          else if (val === 'reps') { exercises[idx].sets = exercises[idx].sets || 1; exercises[idx].reps = exercises[idx].reps || 10; exercises[idx].durationSeconds = null; }
          else { exercises[idx].durationSeconds = exercises[idx].durationSeconds || 300; exercises[idx].sets = null; exercises[idx].reps = null; }
          exercises[idx].measureUnit = val === 'duration' ? 'minutes' : null;
          _rebuildRepWrap(repWrap, exercises[idx], idx);
          onChange(exercises);
        };
        measureBtns[val] = b;
        measureRow.appendChild(b);
      });
      morePanel.appendChild(measureRow);

      // Per-exercise schedule override
      const overrideToggle = el('button', { style: { background: 'none', border: 'none', cursor: 'pointer', color: hasOverride ? '#92400e' : '#0d9488', fontSize: '12px', fontWeight: '600', padding: '0', fontFamily: 'inherit', marginBottom: hasOverride ? '0' : '0' } }, [hasOverride ? 'Edit custom schedule' : 'Customize schedule']);
      let overridePanel = null;
      let overrideVisible = false;
      overrideToggle.onclick = () => {
        overrideVisible = !overrideVisible;
        if (overrideVisible && !overridePanel) {
          overridePanel = renderMiniSchedule(
            { overrideRecurrence: ex.overrideRecurrence, overrideSpecificDays: ex.overrideSpecificDays, overrideTimeOfDay: ex.overrideTimeOfDay },
            homeworkState || {},
            (patch) => {
              exercises[idx].overrideRecurrence = patch.overrideRecurrence || null;
              exercises[idx].overrideSpecificDays = patch.overrideSpecificDays || null;
              exercises[idx].overrideTimeOfDay = patch.overrideTimeOfDay || null;
              onChange(exercises);
            }
          );
          morePanel.appendChild(overridePanel);
        }
        if (overridePanel) overridePanel.style.display = overrideVisible ? 'block' : 'none';
        overrideToggle.textContent = overrideVisible ? 'Hide schedule' : (hasOverride ? 'Edit custom schedule' : 'Customize schedule');
      };
      morePanel.appendChild(overrideToggle);

      // Per-exercise attachments
      const attachLabel = el('div', { style: { fontSize: '12px', fontWeight: '600', color: '#475569', marginTop: '10px', marginBottom: '6px' } }, ['Attachments']);
      morePanel.appendChild(attachLabel);
      const exFilePreview = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' } });
      morePanel.appendChild(exFilePreview);
      const exAttachBtn = el('button', { class: 'hw2-ghost-btn', style: { marginBottom: '8px' } }, ['📎 Attach file']);
      morePanel.appendChild(exAttachBtn);

      function _renderExFiles() {
        exFilePreview.innerHTML = '';
        const paths = exercises[idx].attachedFilePaths || [];
        const urls = exercises[idx].attachedFileUrls || [];
        const names = exercises[idx].attachedFileNames || [];
        const count = Math.max(paths.length, urls.length, names.length);
        const chips = [];
        for (let i = 0; i < count; i++) {
          const path = paths[i] || null;
          const legacyUrl = urls[i] || null;
          const name = names[i] || 'File';
          const isImg = /\.(png|jpe?g|gif|webp)$/i.test(name);
          const chip = el('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', background: '#f0fdf9', border: '1px solid #d1e0dd', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', color: '#0f1a18' } });
          let imgEl = null;
          if (isImg) {
            imgEl = document.createElement('img');
            imgEl.style.cssText = 'width:20px;height:20px;object-fit:cover;border-radius:3px;';
            chip.appendChild(imgEl);
          } else {
            chip.appendChild(document.createTextNode('📄'));
          }
          chip.appendChild(document.createTextNode(name));
          const rm = document.createElement('button');
          rm.textContent = '✕';
          rm.style.cssText = 'background:none;border:none;cursor:pointer;color:#94a3b8;font-size:12px;padding:0 2px;';
          const fileIdx = i;
          rm.onclick = () => {
            exercises[idx].attachedFilePaths.splice(fileIdx, 1);
            exercises[idx].attachedFileUrls.splice(fileIdx, 1);
            exercises[idx].attachedFileNames.splice(fileIdx, 1);
            onChange(exercises);
            _renderExFiles();
          };
          chip.appendChild(rm);
          exFilePreview.appendChild(chip);
          chips.push({ imgEl, path, legacyUrl });
        }
        chips.forEach(async ({ imgEl, path, legacyUrl }) => {
          if (!imgEl) return;
          if (path) {
            try {
              const supa = ctx && ctx.H && ctx.H._supa;
              if (supa) {
                const { data } = await supa.storage.from('huddledin-files').createSignedUrl(path, 900);
                if (data?.signedUrl) { imgEl.src = data.signedUrl; return; }
              }
            } catch (_) {}
          }
          if (legacyUrl) imgEl.src = legacyUrl;
        });
      }
      _renderExFiles();

      const _pickFromDevice = () => {
        const fi = document.createElement('input');
        fi.type = 'file'; fi.multiple = true; fi.accept = 'image/*,video/*,.pdf,.doc,.docx';
        fi.onchange = async (ev) => {
          exAttachBtn.disabled = true; exAttachBtn.textContent = 'Uploading…';
          try {
            for (const f of Array.from(ev.target.files)) {
              const { path, url } = await ctx.H.SB.uploadFile('homework/' + ctx.childId, f);
              exercises[idx].attachedFilePaths.push(path);
              exercises[idx].attachedFileUrls.push(url);
              exercises[idx].attachedFileNames.push(f.name);
            }
            onChange(exercises);
            _renderExFiles();
          } catch (e) { console.error('exercise file upload:', e); ctx.H.toast?.('Could not upload file.', 'error'); }
          exAttachBtn.disabled = false; exAttachBtn.textContent = '📎 Attach file';
        };
        fi.click();
      };

      const _pickFromStorage = () => {
        showStorageBrowser({
          onPick: (picked) => {
            showRenameDialog({
              originalName: picked.name,
              sourceExt: picked.file_type || _extractExt(picked.name),
              onConfirm: async (finalName) => {
                await _copyAndLinkFromStorage(picked, finalName, ctx, exercises, idx, exAttachBtn, onChange, _renderExFiles);
              }
            });
          }
        });
      };

      exAttachBtn.onclick = () => {
        if (exAttachBtn.disabled) return; // tap-debounce
        showUploadChooser({
          onPickDevice: _pickFromDevice,
          onPickStorage: _pickFromStorage,
        });
      };

      row.appendChild(morePanel);
      wrap.appendChild(row);
    });

    // Add exercise button
    const addBtn = el('button', { style: { width: '100%', padding: '10px', background: '#f0fdf9', border: '1.5px dashed #d1e0dd', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', color: '#0d9488', fontWeight: '600', fontFamily: 'inherit' } }, ['+ Add exercise']);
    addBtn.onclick = () => {
      exercises.push({ title: '', instructions: '', reps: null, sets: null, durationSeconds: null, measureUnit: null, overrideRecurrence: null, overrideSpecificDays: null, overrideTimeOfDay: null, attachedFileUrls: [], attachedFilePaths: [], attachedFileNames: [], _ui: { expanded: false } });
      onChange(exercises); _render();
    };
    wrap.appendChild(addBtn);
  }

  _render();
  return wrap;
}

function _extractExt(filename) {
  const dot = (filename || '').lastIndexOf('.');
  if (dot <= 0) return '';
  return filename.slice(dot + 1).toLowerCase();
}

async function _copyAndLinkFromStorage(picked, finalName, ctx, exercises, idx, exAttachBtn, onChange, _renderExFiles) {
  const H = ctx.H;
  const { _supa, SB, session, DB, toast } = H;

  // Look up the patient's spec_<specialistId> folder for vault_files.category
  const specFolder = (DB.folders || []).find(f =>
    f.childId === ctx.childId && f.key === 'spec_' + session.id
  );
  if (!specFolder) {
    toast?.('Specialist folder missing for this patient.', 'error');
    console.error('❌ no spec folder for child:', ctx.childId, 'spec:', session.id);
    return;
  }

  exAttachBtn.disabled = true;
  exAttachBtn.textContent = 'Copying…';
  try {
    // Server-side cross-bucket copy via fetch+blob+upload (proven pattern from _showCopyToPatientModal)
    const { data: signedSrc, error: signErr } = await _supa.storage
      .from('specialist-storage')
      .createSignedUrl(picked.storage_path, 300);
    if (signErr || !signedSrc?.signedUrl) throw signErr || new Error('signed url failed');

    const resp = await fetch(signedSrc.signedUrl);
    if (!resp.ok) throw new Error('source fetch failed: ' + resp.status);
    const blob = await resp.blob();

    const destPath = 'homework/' + ctx.childId + '/' + Date.now() + '_' + finalName;
    const { error: upErr } = await _supa.storage
      .from('huddledin-files')
      .upload(destPath, blob, { contentType: blob.type, upsert: false });
    if (upErr) throw upErr;

    // Insert vault_files row in patient's spec folder so it appears in the parent's vault under the spec's auto-folder
    const saved = await SB.addFile({
      childId: ctx.childId,
      uploadedBy: session.id,
      name: finalName,
      storagePath: destPath,
      mimeType: blob.type || 'application/octet-stream',
      sizeBytes: picked.size_bytes || blob.size || 0,
      category: specFolder.key,
    });

    // Update local DB.folders cache so the file appears immediately in the parent's vault
    const fls = DB.folders;
    const fo = fls.find(f => f.id === specFolder.id);
    if (fo) {
      fo.files = fo.files || [];
      fo.files.push({
        id: saved?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'f_' + Date.now()),
        name: finalName,
        date: new Date().toISOString().split('T')[0],
        locked: false,
        sharedWith: [],
        uploadedBy: session.id,
        url: null,
      });
      DB.folders = fls;
    }

    // Push to exercise state — same shape as device-upload path
    exercises[idx].attachedFilePaths.push(destPath);
    exercises[idx].attachedFileUrls.push(null); // signed URL is rendered on demand from path
    exercises[idx].attachedFileNames.push(finalName);
    onChange(exercises);
    _renderExFiles();
    toast?.('✅ Attached "' + finalName + '"');
  } catch (e) {
    console.error('❌ copy from storage:', e);
    toast?.('Could not copy from storage.', 'error');
  }
  exAttachBtn.disabled = false;
  exAttachBtn.textContent = '📎 Attach file';
}
