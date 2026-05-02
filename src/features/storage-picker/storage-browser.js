// Storage browser — modal that browses the specialist's spec_vault tree
// and picks a single file. Single-file pick. No file-type filter (shows everything).
// Folder navigation supports nesting via spec_vault_folders.parent_folder_id.

export function showStorageBrowser({ onPick }) {
  const H = window.HUD || {};
  const { openModal, el, toast, _supa, session, _formatBytes } = H;
  const specId = session?.id;
  if (!specId) { toast?.('Not signed in.', 'error'); return; }

  openModal('Pick from storage', (mb, close) => {
    let path = []; // [{id, name}, ...] folder breadcrumb
    let search = '';
    let isPicking = false;

    const searchInp = el('input', { class: 'inp', placeholder: 'Search by name…', style: { marginBottom: '10px' } });
    let _searchT = null;
    searchInp.oninput = (ev) => {
      clearTimeout(_searchT);
      _searchT = setTimeout(() => { search = ev.target.value.trim(); _renderList(); }, 200);
    };
    mb.appendChild(searchInp);

    const bc = el('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '10px', fontSize: '.78rem', flexWrap: 'wrap' } });
    mb.appendChild(bc);

    const list = el('div', { style: { maxHeight: '50vh', overflowY: 'auto', borderTop: '1px solid var(--mint-l)', paddingTop: '8px' } });
    mb.appendChild(list);

    function _renderBreadcrumb() {
      bc.innerHTML = '';
      const root = el('span', { style: { color: 'var(--teal)', cursor: 'pointer', fontWeight: '600' } }, ['🗂️ My storage']);
      root.onclick = () => { path = []; search = ''; searchInp.value = ''; _renderList(); };
      bc.appendChild(root);
      path.forEach((p, i) => {
        bc.appendChild(el('span', { style: { color: 'var(--slate-l)' } }, ['›']));
        if (i < path.length - 1) {
          const link = el('span', { style: { color: 'var(--teal)', cursor: 'pointer' } }, [p.name]);
          link.onclick = () => { path = path.slice(0, i + 1); _renderList(); };
          bc.appendChild(link);
        } else {
          bc.appendChild(el('span', { style: { color: 'var(--navy)', fontWeight: '600' } }, [p.name]));
        }
      });
    }

    async function _renderList() {
      _renderBreadcrumb();
      list.innerHTML = '';
      list.appendChild(el('div', { style: { padding: '24px', textAlign: 'center', color: 'var(--slate)' } }, ['Loading…']));

      const currentFolderId = path.length ? path[path.length - 1].id : null;
      const q = (search || '').toLowerCase();
      try {
        let fQ = _supa.from('spec_vault_folders').select('*').eq('specialist_id', specId).order('name');
        if (!q) {
          if (currentFolderId) fQ = fQ.eq('parent_folder_id', currentFolderId);
          else fQ = fQ.is('parent_folder_id', null);
        }
        let fiQ = _supa.from('spec_vault_files').select('*').eq('specialist_id', specId).order('created_at', { ascending: false });
        if (!q) {
          if (currentFolderId) fiQ = fiQ.eq('folder_id', currentFolderId);
          else fiQ = fiQ.is('folder_id', null);
        }
        const [{ data: folders }, { data: files }] = await Promise.all([fQ, fiQ]);

        list.innerHTML = '';
        const filteredFolders = q ? (folders || []).filter(f => (f.name || '').toLowerCase().includes(q)) : (folders || []);
        const filteredFiles = q ? (files || []).filter(f => (f.name || '').toLowerCase().includes(q)) : (files || []);

        if (!filteredFolders.length && !filteredFiles.length) {
          list.appendChild(el('div', { style: { padding: '24px', textAlign: 'center', color: 'var(--slate)' } }, [q ? 'No matches.' : 'This folder is empty.']));
          return;
        }

        filteredFolders.forEach(folder => {
          const row = el('div', { class: 'card hov', style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', marginBottom: '6px', cursor: 'pointer' } });
          row.appendChild(el('span', { style: { fontSize: '1.2rem' } }, ['📁']));
          row.appendChild(el('div', { style: { flex: '1', fontWeight: '600', fontSize: '.85rem', color: 'var(--navy)' } }, [folder.name]));
          row.appendChild(el('span', { style: { color: 'var(--slate-l)' } }, ['›']));
          row.onclick = () => {
            path = [...path, { id: folder.id, name: folder.name }];
            search = ''; searchInp.value = '';
            _renderList();
          };
          list.appendChild(row);
        });

        filteredFiles.forEach(file => {
          const row = el('div', { class: 'card hov', style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', marginBottom: '6px', cursor: 'pointer' } });
          row.appendChild(el('span', { style: { fontSize: '1.2rem' } }, ['📄']));
          const info = el('div', { style: { flex: '1', minWidth: '0' } });
          info.appendChild(el('div', { style: { fontWeight: '600', fontSize: '.85rem', color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, [file.name]));
          const sizeStr = _formatBytes ? _formatBytes(file.size_bytes || 0) : (file.size_bytes || 0) + ' B';
          info.appendChild(el('div', { style: { fontSize: '.7rem', color: 'var(--slate-l)' } }, [(file.file_type || '').toUpperCase() + ' · ' + sizeStr]));
          row.appendChild(info);
          row.onclick = () => {
            if (isPicking) return; // tap-debounce
            isPicking = true;
            row.style.opacity = '0.6';
            close();
            onPick?.({
              id: file.id,
              name: file.name,
              storage_path: file.storage_path,
              file_type: file.file_type,
              size_bytes: file.size_bytes
            });
          };
          list.appendChild(row);
        });
      } catch (e) {
        console.error('❌ storage browser load:', e);
        list.innerHTML = '';
        list.appendChild(el('div', { style: { padding: '24px', textAlign: 'center', color: 'var(--coral)' } }, ['Could not load storage.']));
      }
    }

    _renderList();
  }, 480);
}
