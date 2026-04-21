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

  const { Editor, Node, mergeAttributes, InputRule } = await import('@tiptap/core');
  const { default: StarterKit } = await import('@tiptap/starter-kit');
  const { default: Placeholder } = await import('@tiptap/extension-placeholder');
  const { TextSelection } = await import('@tiptap/pm/state');
  const { Plugin, PluginKey } = await import('@tiptap/pm/state');

  const _confirm = window.HUD?.openConfirm;

  // ── sectionTitle node — plain text only, no marks ──
  const SectionTitle = Node.create({
    name: 'sectionTitle',
    content: 'text*',
    marks: '',
    defining: true,
    selectable: false,
    parseHTML() { return [{ tag: 'div[data-type="section-title"]' }]; },
    renderHTML({ HTMLAttributes }) {
      return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'section-title', class: 'rpt-section-title' }), 0];
    },
  });

  // ── sectionBody node — block+ content ──
  const SectionBody = Node.create({
    name: 'sectionBody',
    content: 'block+',
    defining: true,
    parseHTML() { return [{ tag: 'div[data-type="section-body"]' }]; },
    renderHTML({ HTMLAttributes }) {
      return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'section-body', class: 'rpt-section-body' }), 0];
    },
  });

  // ── reportSection node — contains exactly one sectionTitle + one sectionBody ──
  const ReportSection = Node.create({
    name: 'reportSection',
    group: 'block',
    content: 'sectionTitle sectionBody',
    defining: true,

    parseHTML() { return [{ tag: 'div[data-type="report-section"]' }]; },

    renderHTML({ HTMLAttributes }) {
      return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'report-section', class: 'rpt-section' }), 0];
    },

    addNodeView() {
      return ({ node, getPos, editor: ed }) => {
        const dom = document.createElement('div');
        dom.classList.add('rpt-section');
        dom.setAttribute('data-type', 'report-section');

        // Header with action buttons (positioned over the section via CSS)
        const header = document.createElement('div');
        header.classList.add('rpt-section-header');
        header.contentEditable = 'false';

        // Move-up button
        const moveUp = document.createElement('button');
        moveUp.classList.add('rpt-section-move');
        moveUp.textContent = '\u2191';
        moveUp.onpointerdown = (ev) => ev.preventDefault();
        moveUp.onclick = () => {
          const pos = getPos();
          if (pos === undefined || pos === null) return;
          ed.chain().focus().command(({ tr, state }) => {
            const doc = state.doc;
            let thisIdx = -1, thisPos = -1;
            doc.forEach((child, offset, idx) => { if (offset === pos && child.type.name === 'reportSection') { thisIdx = idx; thisPos = offset; } });
            if (thisIdx <= 0) return false;
            const thisNode = doc.child(thisIdx);
            const prevNode = doc.child(thisIdx - 1);
            if (prevNode.type.name !== 'reportSection') return false;
            const prevPos = thisPos - prevNode.nodeSize;
            tr.replaceWith(prevPos, thisPos + thisNode.nodeSize, [thisNode, prevNode]);
            const titleNode = thisNode.child(0);
            const bodyStart = prevPos + 1 + titleNode.nodeSize + 1 + 1;
            try { tr.setSelection(TextSelection.near(tr.doc.resolve(bodyStart))); } catch (_) {}
            return true;
          }).run();
        };
        header.appendChild(moveUp);

        // Move-down button
        const moveDown = document.createElement('button');
        moveDown.classList.add('rpt-section-move');
        moveDown.textContent = '\u2193';
        moveDown.onpointerdown = (ev) => ev.preventDefault();
        moveDown.onclick = () => {
          const pos = getPos();
          if (pos === undefined || pos === null) return;
          ed.chain().focus().command(({ tr, state }) => {
            const doc = state.doc;
            let thisIdx = -1, thisPos = -1;
            doc.forEach((child, offset, idx) => { if (offset === pos && child.type.name === 'reportSection') { thisIdx = idx; thisPos = offset; } });
            if (thisIdx < 0 || thisIdx >= doc.childCount - 1) return false;
            const thisNode = doc.child(thisIdx);
            const nextNode = doc.child(thisIdx + 1);
            if (nextNode.type.name !== 'reportSection') return false;
            const rangeEnd = thisPos + thisNode.nodeSize + nextNode.nodeSize;
            tr.replaceWith(thisPos, rangeEnd, [nextNode, thisNode]);
            const newPos = thisPos + nextNode.nodeSize;
            const titleNode = thisNode.child(0);
            const bodyStart = newPos + 1 + titleNode.nodeSize + 1 + 1;
            try { tr.setSelection(TextSelection.near(tr.doc.resolve(bodyStart))); } catch (_) {}
            return true;
          }).run();
        };
        header.appendChild(moveDown);

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.classList.add('rpt-section-remove');
        removeBtn.textContent = '\u2715';
        removeBtn.onpointerdown = (ev) => ev.preventDefault();
        removeBtn.onclick = () => {
          // TEMP_DIAGNOSE: log on click
          console.log('[REMOVE]', 'click fired');
          const posAtClick = getPos?.();
          console.log('[REMOVE]', 'posAtClick=', posAtClick,
            'currentDocSize=', ed?.state?.doc?.nodeSize,
            'currentDocChildCount=', ed?.state?.doc?.childCount);
          const doRemove = () => {
            // TEMP_DIAGNOSE: log on confirm
            console.log('[REMOVE]', 'doRemove fired');
            const pos = getPos();
            if (pos === undefined || pos === null) return;
            ed.chain().focus().command(({ tr }) => {
              const liveNode = tr.doc.nodeAt(pos);
              // TEMP_DIAGNOSE: log before delete
              console.log('[REMOVE-CMD]',
                'pos=', pos,
                'liveNode exists=', !!liveNode,
                'liveNode type=', liveNode?.type?.name,
                'liveNode nodeSize=', liveNode?.nodeSize,
                'deleteFrom=', pos,
                'deleteTo=', pos + (liveNode?.nodeSize ?? 0),
                'docSize=', tr.doc.nodeSize,
                'docChildCount=', tr.doc.childCount);
              if (!liveNode || liveNode.type.name !== 'reportSection') return false;
              tr.delete(pos, pos + liveNode.nodeSize);
              // TEMP_DIAGNOSE: log after delete
              console.log('[REMOVE-CMD]',
                'after delete docChildCount=', tr.doc.childCount,
                'after delete docSize=', tr.doc.nodeSize);
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

        // Content area — ProseMirror renders sectionTitle + sectionBody here
        const contentDOM = document.createElement('div');
        contentDOM.classList.add('rpt-section-content');
        dom.appendChild(contentDOM);

        return { dom, contentDOM };
      };
    },

    // Keyboard rules scoped to sectionTitle / sectionBody boundaries
    addKeyboardShortcuts() {
      return {
        'Enter': ({ editor: ed }) => {
          const { $from } = ed.state.selection;
          if ($from.parent.type.name === 'sectionTitle') {
            // Move cursor to start of adjacent sectionBody
            const titleEnd = $from.end();
            try {
              const bodyPos = titleEnd + 1; // skip past sectionTitle close tag into sectionBody
              ed.chain().setTextSelection(bodyPos + 1).run(); // +1 to enter the first paragraph
            } catch (_) {}
            return true;
          }
          return false;
        },
        'Shift-Enter': ({ editor: ed }) => {
          const { $from } = ed.state.selection;
          if ($from.parent.type.name === 'sectionTitle') {
            const titleEnd = $from.end();
            try { ed.chain().setTextSelection(titleEnd + 2).run(); } catch (_) {}
            return true;
          }
          return false;
        },
        'Backspace': ({ editor: ed }) => {
          const { $from, empty } = ed.state.selection;
          if (!empty) return false;
          // Prevent backspace at start of sectionBody from merging into title
          if ($from.parent.type.name === 'paragraph') {
            const grandparent = $from.node($from.depth - 1);
            if (grandparent?.type.name === 'sectionBody' && $from.parentOffset === 0) {
              const bodyStart = $from.before($from.depth - 1);
              const sectionBodyNode = $from.node($from.depth - 1);
              if ($from.pos === bodyStart + 1) return true; // consume, no-op
            }
          }
          // Prevent backspace at start of sectionTitle from deleting
          if ($from.parent.type.name === 'sectionTitle' && $from.parentOffset === 0) {
            return true;
          }
          return false;
        },
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
          content: [
            { type: 'sectionTitle', content: [{ type: 'text', text: title }] },
            { type: 'sectionBody', content: [{ type: 'paragraph' }] },
          ],
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
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'sectionTitle') return 'Untitled section';
          return 'Type something...';
        },
      }),
      SectionTitle,
      SectionBody,
      ReportSection,
    ],
    content: {
      type: 'doc',
      content: [{
        type: 'reportSection',
        content: [
          { type: 'sectionTitle', content: [{ type: 'text', text: 'Reason for Referral' }] },
          { type: 'sectionBody', content: [{ type: 'paragraph', content: [] }] },
        ],
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
      .rpt-section-header { position:absolute; top:4px; inset-inline-end:0; display:flex; align-items:center; gap:4px; z-index:1; }
      .rpt-section-move { display:inline-flex; align-items:center; justify-content:center; background:none; border:1px solid #d1e0dd; border-radius:6px; cursor:pointer; font-size:14px; color:#64748b; padding:2px 6px; min-width:28px; min-height:28px; flex-shrink:0; }
      .rpt-section-move:hover { background:#f0fdf9; color:#0d9488; }
      .rpt-section-move:disabled { opacity:.3; cursor:default; }
      .rpt-section-remove { background:none; border:none; cursor:pointer; color:#94a3b8; font-size:16px; padding:2px 6px; border-radius:4px; flex-shrink:0; transition:color .12s,background .12s; min-width:28px; min-height:28px; display:flex; align-items:center; justify-content:center; }
      .rpt-section-remove:hover { color:#dc2626; background:#fef2f2; }
      .rpt-section-content { padding:0; }

      /* sectionTitle — rendered by ProseMirror, styled via CSS */
      .rpt-section-title { font-size:14px; font-weight:700; color:#0d9488; text-transform:uppercase; letter-spacing:.05em; padding:8px 80px 4px 4px; border-radius:4px; cursor:text; outline:none; min-height:24px; }
      .rpt-section-title:focus { background:#f0fdf9; }
      .rpt-section-title.is-empty::before { content:attr(data-placeholder); color:#94a3b8; pointer-events:none; float:left; height:0; }

      /* sectionBody */
      .rpt-section-body { padding:4px 0; }

      /* Section picker dropdown */
      .rpt-section-picker { position:absolute; top:100%; inset-inline-start:0; margin-top:6px; background:#fff; border:1px solid #d1e0dd; border-radius:10px; box-shadow:0 4px 16px rgba(0,0,0,.1); max-height:260px; overflow-y:auto; z-index:10; min-width:220px; padding:4px 0; }
      .rpt-section-picker-item { padding:10px 14px; font-size:14px; color:#0f1a18; cursor:pointer; transition:background .1s; }
      .rpt-section-picker-item:hover { background:#f0fdf9; }

      .ProseMirror .rpt-section.ProseMirror-selectednode { outline:2px solid #0d9488; outline-offset:2px; border-radius:6px; }
    `;
    document.head.appendChild(style);
  }

  // Status line
  const status = document.createElement('div');
  status.style.cssText = 'margin-top:12px;font-size:13px;color:#64748b;';
  status.textContent = 'Editor ready. Type, format, use \u2191\u2193 to reorder, toggle RTL.';
  containerEl.appendChild(status);

  return editor;
}
