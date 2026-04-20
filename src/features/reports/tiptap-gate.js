// Tiptap Editor Gate — hidden prototype for Report Builder V2 evaluation.
// Triggered ONLY by ?tiptap_gate=1 URL param. Zero user-facing impact otherwise.
// All Tiptap imports are inside mountGateEditor() so the code is lazy-executed.

export async function mountGateEditor(containerEl) {
  containerEl.textContent = 'Loading editor...';

  const { Editor, Node, mergeAttributes } = await import('@tiptap/core');
  const { default: StarterKit } = await import('@tiptap/starter-kit');
  const { default: Placeholder } = await import('@tiptap/extension-placeholder');

  // Custom reportSection node — matches standalone prototype schema
  const ReportSection = Node.create({
    name: 'reportSection',
    group: 'block',
    content: 'block+',
    defining: true,
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
        ['div', { class: 'rpt-section-title', contenteditable: 'false' }, node.attrs.title],
        ['div', { class: 'rpt-section-content' }, 0],
      ];
    },
  });

  // Clear loading text + build UI
  containerEl.textContent = '';

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'tiptap-gate-toolbar';
  const actions = [
    { label: 'B', cmd: e => e.chain().focus().toggleBold().run() },
    { label: 'I', cmd: e => e.chain().focus().toggleItalic().run() },
    { label: 'H1', cmd: e => e.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: '• List', cmd: e => e.chain().focus().toggleBulletList().run() },
    { label: '1. List', cmd: e => e.chain().focus().toggleOrderedList().run() },
    { label: '+ Section', cmd: e => e.chain().focus().insertContent({
        type: 'reportSection',
        attrs: { title: 'New Section' },
        content: [{ type: 'paragraph' }],
      }).run()
    },
    { label: 'RTL ⇄', cmd: (_e, editorEl) => {
        const pm = editorEl.querySelector('.ProseMirror');
        if (pm) pm.setAttribute('dir', pm.getAttribute('dir') === 'rtl' ? 'ltr' : 'rtl');
      }
    },
  ];
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.textContent = a.label;
    btn.onpointerdown = (ev) => ev.preventDefault(); // iOS: preserve editor selection
    btn.onclick = () => a.cmd(editor, editorWrap);
    toolbar.appendChild(btn);
  });
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
      .tiptap-gate-editor .ProseMirror ul, .tiptap-gate-editor .ProseMirror ol { padding-left:24px; }
      .rpt-section { border-top:3px solid #0d9488; margin:16px 0; }
      .rpt-section-title { font-size:12px; font-weight:700; color:#0d9488; text-transform:uppercase; letter-spacing:.05em; padding:8px 0 4px; pointer-events:none; user-select:none; }
      .rpt-section-content { padding:4px 0; }
    `;
    document.head.appendChild(style);
  }

  // Status line
  const status = document.createElement('div');
  status.style.cssText = 'margin-top:12px;font-size:13px;color:#64748b;';
  status.textContent = 'Editor ready. Type, format, toggle RTL, add sections.';
  containerEl.appendChild(status);

  return editor;
}
