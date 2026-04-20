// Tiptap Editor Gate — hidden prototype for Report Builder V2 evaluation.
// Triggered by ?tiptap_gate=1 URL param OR "Try new editor" beta button.
// All Tiptap imports are inside mountGateEditor() so the code is lazy-executed.

// TODO: Phase 1 replaces this with the full 64-section library loaded from the section-library module.
const SECTION_PICKER_LIST = [
  'Reason for Referral',
  'Clinical Summary',
  'Observations',
  'Assessment Results',
  'Goals',
  'Recommendations',
  'Home Program',
  'Strengths',
  'Areas of Concern',
  'Plan / Next Steps',
];

export async function mountGateEditor(containerEl) {
  containerEl.textContent = 'Loading editor...';

  const { Editor, Node, mergeAttributes } = await import('@tiptap/core');
  const { default: StarterKit } = await import('@tiptap/starter-kit');
  const { default: Placeholder } = await import('@tiptap/extension-placeholder');

  const _confirm = window.HUD?.openConfirm;

  // Custom reportSection node with full node view
  const ReportSection = Node.create({
    name: 'reportSection',
    group: 'block',
    content: 'block+',
    defining: true,
    draggable: true,

    addAttributes() {
      return { title: { default: 'Untitled Section' } };
    },

    parseHTML() {
      return [{ tag: 'div[data-type="report-section"]' }];
    },

    renderHTML({ node, HTMLAttributes }) {
      return [
        'div',
        mergeAttributes(HTMLAttributes, { 'data-type': 'report-section', class: 'rpt-section' }),
        ['div', { class: 'rpt-section-header' },
          ['span', { class: 'rpt-section-drag', 'data-drag-handle': '' }, '\u2758\u2758'],
          ['span', { class: 'rpt-section-title-ro' }, node.attrs.title],
          ['button', { class: 'rpt-section-remove' }, '\u2715'],
        ],
        ['div', { class: 'rpt-section-content' }, 0],
      ];
    },

    addNodeView() {
      return ({ node, getPos, editor: ed }) => {
        // Outer wrapper
        const dom = document.createElement('div');
        dom.classList.add('rpt-section');
        dom.setAttribute('data-type', 'report-section');

        // Header row
        const header = document.createElement('div');
        header.classList.add('rpt-section-header');

        // Drag handle
        const dragHandle = document.createElement('span');
        dragHandle.classList.add('rpt-section-drag');
        dragHandle.setAttribute('data-drag-handle', '');
        dragHandle.textContent = '\u2758\u2758';
        dragHandle.draggable = true;
        dragHandle.contentEditable = 'false';
        header.appendChild(dragHandle);

        // Mobile move buttons
        const moveUp = document.createElement('button');
        moveUp.classList.add('rpt-section-move', 'rpt-section-move-up');
        moveUp.textContent = '\u2191';
        moveUp.contentEditable = 'false';
        moveUp.onpointerdown = (ev) => ev.preventDefault();
        moveUp.onclick = () => {
          const pos = getPos();
          if (pos === undefined || pos === null) return;
          const resolved = ed.state.doc.resolve(pos);
          if (resolved.index(resolved.depth - 1) === 0) return;
          const nodeSize = node.nodeSize;
          const $before = ed.state.doc.resolve(pos - 1);
          const prevStart = $before.before($before.depth);
          ed.chain().focus()
            .command(({ tr }) => {
              const slice = tr.doc.slice(pos, pos + nodeSize);
              tr.delete(pos, pos + nodeSize);
              tr.insert(prevStart, slice.content);
              return true;
            }).run();
        };
        header.appendChild(moveUp);

        const moveDown = document.createElement('button');
        moveDown.classList.add('rpt-section-move', 'rpt-section-move-down');
        moveDown.textContent = '\u2193';
        moveDown.contentEditable = 'false';
        moveDown.onpointerdown = (ev) => ev.preventDefault();
        moveDown.onclick = () => {
          const pos = getPos();
          if (pos === undefined || pos === null) return;
          const resolved = ed.state.doc.resolve(pos);
          const parent = resolved.node(resolved.depth - 1);
          const idx = resolved.index(resolved.depth - 1);
          if (idx >= parent.childCount - 1) return;
          const nodeSize = node.nodeSize;
          const nextNode = parent.child(idx + 1);
          const afterPos = pos + nodeSize + nextNode.nodeSize;
          ed.chain().focus()
            .command(({ tr }) => {
              const slice = tr.doc.slice(pos, pos + nodeSize);
              tr.delete(pos, pos + nodeSize);
              tr.insert(afterPos - nodeSize, slice.content);
              return true;
            }).run();
        };
        header.appendChild(moveDown);

        // Editable title
        const titleEl = document.createElement('span');
        titleEl.classList.add('rpt-section-title');
        titleEl.contentEditable = 'true';
        titleEl.draggable = false;
        titleEl.textContent = node.attrs.title || '';
        titleEl.setAttribute('data-placeholder', 'Untitled section');
        titleEl.addEventListener('input', () => {
          const pos = getPos();
          if (pos === undefined || pos === null) return;
          ed.view.dispatch(ed.state.tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            title: titleEl.textContent || '',
          }));
        });
        titleEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            contentDOM.focus();
          }
        });
        titleEl.addEventListener('paste', (e) => {
          e.preventDefault();
          const text = e.clipboardData?.getData('text/plain') || '';
          document.execCommand('insertText', false, text);
        });
        header.appendChild(titleEl);

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.classList.add('rpt-section-remove');
        removeBtn.textContent = '\u2715';
        removeBtn.contentEditable = 'false';
        removeBtn.onpointerdown = (ev) => ev.preventDefault();
        removeBtn.onclick = () => {
          const doRemove = () => {
            const pos = getPos();
            if (pos === undefined || pos === null) return;
            ed.chain().focus().command(({ tr }) => {
              tr.delete(pos, pos + node.nodeSize);
              return true;
            }).run();
          };
          if (_confirm) {
            _confirm('Remove Section', 'Remove this section? All content will be lost.', true, doRemove);
          } else {
            doRemove();
          }
        };
        header.appendChild(removeBtn);

        dom.appendChild(header);

        // Content area (Tiptap renders block+ content here)
        const contentDOM = document.createElement('div');
        contentDOM.classList.add('rpt-section-content');
        dom.appendChild(contentDOM);

        return { dom, contentDOM };
      };
    },
  });

  // Clear loading text + build UI
  containerEl.textContent = '';

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'tiptap-gate-toolbar';
  const fmtActions = [
    { label: 'B', cmd: e => e.chain().focus().toggleBold().run() },
    { label: 'I', cmd: e => e.chain().focus().toggleItalic().run() },
    { label: 'H1', cmd: e => e.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: '• List', cmd: e => e.chain().focus().toggleBulletList().run() },
    { label: '1. List', cmd: e => e.chain().focus().toggleOrderedList().run() },
    { label: 'RTL \u21C4', cmd: (_e, editorEl) => {
        const pm = editorEl.querySelector('.ProseMirror');
        if (pm) pm.setAttribute('dir', pm.getAttribute('dir') === 'rtl' ? 'ltr' : 'rtl');
      }
    },
  ];
  fmtActions.forEach(a => {
    const btn = document.createElement('button');
    btn.textContent = a.label;
    btn.onpointerdown = (ev) => ev.preventDefault();
    btn.onclick = () => a.cmd(editor, editorWrap);
    toolbar.appendChild(btn);
  });

  // Section picker button + dropdown
  const pickerWrap = document.createElement('div');
  pickerWrap.style.cssText = 'position:relative;display:inline-block;';
  const pickerBtn = document.createElement('button');
  pickerBtn.textContent = '+ Add Section';
  pickerBtn.onpointerdown = (ev) => ev.preventDefault();
  pickerBtn.onclick = () => {
    const existing = pickerWrap.querySelector('.rpt-section-picker');
    if (existing) { existing.remove(); return; }
    const dropdown = document.createElement('div');
    dropdown.className = 'rpt-section-picker';
    SECTION_PICKER_LIST.forEach(title => {
      const item = document.createElement('div');
      item.className = 'rpt-section-picker-item';
      item.textContent = title;
      item.onclick = () => {
        dropdown.remove();
        editor.chain().focus().insertContent({
          type: 'reportSection',
          attrs: { title },
          content: [{ type: 'paragraph' }],
        }).run();
      };
      dropdown.appendChild(item);
    });
    pickerWrap.appendChild(dropdown);
    const dismiss = (ev) => { if (!pickerWrap.contains(ev.target)) { dropdown.remove(); document.removeEventListener('pointerdown', dismiss); } };
    setTimeout(() => document.addEventListener('pointerdown', dismiss), 10);
  };
  pickerWrap.appendChild(pickerBtn);
  toolbar.appendChild(pickerWrap);

  containerEl.appendChild(toolbar);

  // Editor container
  const editorWrap = document.createElement('div');
  editorWrap.className = 'tiptap-gate-editor';
  containerEl.appendChild(editorWrap);

  // Mount Tiptap
  const editor = new Editor({
    element: editorWrap,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Type something...' }),
      ReportSection,
    ],
    content: {
      type: 'doc',
      content: [{
        type: 'reportSection',
        attrs: { title: 'Reason for Referral' },
        content: [{ type: 'paragraph', content: [] }],
      }],
    },
  });

  // Inject scoped CSS (once)
  if (!document.getElementById('tiptap-gate-css')) {
    const style = document.createElement('style');
    style.id = 'tiptap-gate-css';
    style.textContent = `
      .tiptap-gate-toolbar { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; }
      .tiptap-gate-toolbar button { padding:6px 12px; border:1px solid #d1e0dd; border-radius:8px; background:#fff; font-size:14px; cursor:pointer; min-height:36px; font-family:inherit; transition:background .12s; }
      .tiptap-gate-toolbar button:hover { background:#f0fdf9; }
      .tiptap-gate-editor { border:1.5px solid #d1e0dd; border-radius:10px; background:#fff; min-height:300px; }
      .tiptap-gate-editor .ProseMirror { padding:16px; outline:none; min-height:280px; font-size:16px; line-height:1.6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif; }
      .tiptap-gate-editor .ProseMirror p.is-editor-empty:first-child::before { content:attr(data-placeholder); color:#94a3b8; pointer-events:none; float:left; height:0; }
      .tiptap-gate-editor .ProseMirror h1 { font-size:24px; font-weight:700; }
      .tiptap-gate-editor .ProseMirror h2 { font-size:20px; font-weight:700; }
      .tiptap-gate-editor .ProseMirror ul, .tiptap-gate-editor .ProseMirror ol { padding-inline-start:24px; }

      /* reportSection node */
      .rpt-section { border-top:3px solid #0d9488; margin:16px 0; position:relative; }
      .rpt-section-header { display:flex; align-items:center; gap:6px; padding:8px 0 4px; }
      .rpt-section-drag { cursor:grab; color:#94a3b8; font-size:14px; flex-shrink:0; user-select:none; padding:2px 4px; border-radius:4px; transition:color .12s; letter-spacing:2px; }
      .rpt-section-drag:hover { color:#0d9488; background:#f0fdf9; }
      @media(max-width:767px) { .rpt-section-drag { display:none; } }
      .rpt-section-move { display:none; background:none; border:1px solid #d1e0dd; border-radius:6px; cursor:pointer; font-size:14px; color:#64748b; padding:2px 6px; min-width:28px; min-height:28px; flex-shrink:0; }
      .rpt-section-move:hover { background:#f0fdf9; color:#0d9488; }
      .rpt-section-move:disabled { opacity:.3; cursor:default; }
      @media(max-width:767px) { .rpt-section-move { display:inline-flex; align-items:center; justify-content:center; } }
      .rpt-section-title { flex:1; font-size:13px; font-weight:700; color:#0d9488; text-transform:uppercase; letter-spacing:.05em; outline:none; min-width:0; border:none; background:transparent; padding:2px 4px; border-radius:4px; cursor:text; }
      .rpt-section-title:focus { background:#f0fdf9; box-shadow:0 0 0 2px rgba(13,148,136,.2); }
      .rpt-section-title:empty::before { content:attr(data-placeholder); color:#94a3b8; pointer-events:none; }
      .rpt-section-title[draggable="false"] { draggable:false; }
      .rpt-section-remove { background:none; border:none; cursor:pointer; color:#94a3b8; font-size:16px; padding:2px 6px; border-radius:4px; flex-shrink:0; transition:color .12s,background .12s; min-width:28px; min-height:28px; display:flex; align-items:center; justify-content:center; }
      .rpt-section-remove:hover { color:#dc2626; background:#fef2f2; }
      .rpt-section-content { padding:4px 0; }

      /* Section picker dropdown */
      .rpt-section-picker { position:absolute; bottom:100%; inset-inline-start:0; margin-bottom:6px; background:#fff; border:1px solid #d1e0dd; border-radius:10px; box-shadow:0 4px 16px rgba(0,0,0,.1); max-height:260px; overflow-y:auto; z-index:10; min-width:220px; padding:4px 0; }
      .rpt-section-picker-item { padding:10px 14px; font-size:14px; color:#0f1a18; cursor:pointer; transition:background .1s; }
      .rpt-section-picker-item:hover { background:#f0fdf9; }

      /* Drag visuals */
      .ProseMirror .rpt-section.ProseMirror-selectednode { outline:2px solid #0d9488; outline-offset:2px; border-radius:6px; }
    `;
    document.head.appendChild(style);
  }

  // Status line
  const status = document.createElement('div');
  status.style.cssText = 'margin-top:12px;font-size:13px;color:#64748b;';
  status.textContent = 'Editor ready. Type, format, drag sections (desktop) or use \u2191\u2193 (mobile), toggle RTL.';
  containerEl.appendChild(status);

  return editor;
}
