// Tiptap Editor Gate — hidden prototype for Report Builder V2 evaluation.
// Triggered by "Try new editor" beta button, "From template" flow, or ?draft=<id> URL param.
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

const EMPTY_DOC = {
  type: 'doc',
  content: [{
    type: 'reportSection',
    content: [
      { type: 'sectionTitle', content: [] },
      { type: 'sectionBody', content: [{ type: 'paragraph', content: [] }] },
    ],
  }],
};

export function sectionsToTiptapDoc(sections) {
  if (!sections?.length) return EMPTY_DOC;
  return {
    type: 'doc',
    content: sections.map(s => ({
      type: 'reportSection',
      content: [
        { type: 'sectionTitle', content: s.title ? [{ type: 'text', text: s.title }] : [] },
        { type: 'sectionBody', content: _bodyToNodes(s.body) },
      ],
    })),
  };
}

function _bodyToNodes(body) {
  if (!body) return [{ type: 'paragraph', content: [] }];
  const paras = body.split(/\n\n+/);
  const nodes = [];
  for (const p of paras) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    const lines = trimmed.split('\n');
    if (lines.every(l => /^[-*]\s/.test(l.trim()))) {
      nodes.push({ type: 'bulletList', content: lines.map(l => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: l.replace(/^[-*]\s+/, '').trim() }] }] })) });
    } else if (lines.every(l => /^\d+[.)]\s/.test(l.trim()))) {
      nodes.push({ type: 'orderedList', content: lines.map(l => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: l.replace(/^\d+[.)]\s+/, '').trim() }] }] })) });
    } else {
      nodes.push({ type: 'paragraph', content: [{ type: 'text', text: trimmed }] });
    }
  }
  return nodes.length ? nodes : [{ type: 'paragraph', content: [] }];
}

// ── Module-level save state ──
let _saveAbort = null;
let _saveTimer = null;
let _tickTimer = null;
let _beforeUnloadHandler = null;

function _supa() { return window.HUD?._supa; }
function _session() { return window.HUD?.session; }

// ── Markdown serializer ──
export function tiptapToMarkdown(content) {
  try {
    if (!content?.content?.length) return '';
    return _serializeNodes(content.content).trim();
  } catch (_) { return '[Unable to render content]'; }
}

function _serializeNodes(nodes) {
  if (!nodes) return '';
  return nodes.map(_serializeNode).join('');
}

function _serializeNode(node) {
  if (!node) return '';
  const t = node.type;
  if (t === 'text') return _wrapMarks(node.text || '', node.marks);
  if (t === 'hardBreak') return '  \n';
  if (t === 'reportSection') {
    const title = node.content?.[0];
    const body = node.content?.[1];
    const titleText = _extractText(title);
    const bodyMd = body ? _serializeNodes(body.content) : '';
    return '## ' + (titleText || 'Untitled') + '\n\n' + bodyMd + '\n';
  }
  if (t === 'sectionTitle') return _extractText(node);
  if (t === 'sectionBody') return _serializeNodes(node.content);
  if (t === 'paragraph') return _serializeNodes(node.content) + '\n\n';
  if (t === 'heading') {
    const lvl = node.attrs?.level || 1;
    const prefix = lvl === 1 ? '# ' : lvl === 2 ? '### ' : '#### ';
    return prefix + _serializeNodes(node.content) + '\n\n';
  }
  if (t === 'bulletList') return (node.content || []).map(li => '- ' + _serializeNodes(li.content?.[0]?.content).trim() + '\n').join('') + '\n';
  if (t === 'orderedList') return (node.content || []).map(li => '1. ' + _serializeNodes(li.content?.[0]?.content).trim() + '\n').join('') + '\n';
  if (t === 'listItem') return _serializeNodes(node.content);
  if (node.content) return _serializeNodes(node.content);
  return '';
}

function _wrapMarks(text, marks) {
  if (!marks?.length) return text;
  let out = text;
  const isBold = marks.some(m => m.type === 'bold');
  const isItalic = marks.some(m => m.type === 'italic');
  if (isBold && isItalic) out = '***' + out + '***';
  else if (isBold) out = '**' + out + '**';
  else if (isItalic) out = '*' + out + '*';
  return out;
}

function _extractText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.content) return node.content.map(_extractText).join('');
  return '';
}

// ── Placeholder substitution ──

const PRONOUN_MAP = {
  he:  { subject: 'he', object: 'him', possessive: 'his' },
  she: { subject: 'she', object: 'her', possessive: 'her' },
  they: { subject: 'they', object: 'them', possessive: 'their' },
};

function _formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

export function substitutePlaceholders(content, child) {
  if (!content || !child) return content;
  const { calcAge } = window.HUD_REPORTS || {};
  const map = {};
  if (child.name) map['[NAME]'] = child.name;
  if (child.dob) map['[DOB]'] = _formatDate(child.dob);
  if (child.dob && calcAge) map['[AGE]'] = calcAge(child.dob);
  map['[DATE]'] = _formatDate(new Date().toISOString().split('T')[0]);
  const p = child.pronouns ? PRONOUN_MAP[child.pronouns] : null;
  if (p) {
    map['[PRONOUN_SUBJECT]'] = p.subject;
    map['[PRONOUN_OBJECT]'] = p.object;
    map['[PRONOUN_POSSESSIVE]'] = p.possessive;
  }
  return JSON.parse(JSON.stringify(content), (key, val) => {
    if (typeof val !== 'string') return val;
    let out = val;
    for (const [token, replacement] of Object.entries(map)) {
      if (out.includes(token)) out = out.split(token).join(replacement);
    }
    return out;
  });
}

// ── Data helpers ──

async function _findDefaultChild() {
  const db = window.HUD?.DB;
  const children = db?.children || [];
  if (children.length) return children[0].id;
  const ls = window.HUD?.LS?.get?.('children', []) || [];
  if (ls.length) {
    return ls[0].id;
  }
  return null;
}

function _resolveChild(childId) {
  const db = window.HUD?.DB?.children || [];
  const ls = window.HUD?.LS?.get?.('children', []) || [];
  return [...db, ...ls].find(c => c.id === childId);
}

async function saveDraft({ reportId, content, childId, templateId }) {
  if (_saveAbort) _saveAbort.abort();
  _saveAbort = new AbortController();

  const supa = _supa();
  const sess = _session();
  if (!supa || !sess) throw new Error('Not authenticated');
  if (!childId) throw new Error('No patient selected');

  if (reportId) {
    const { data, error } = await supa.from('reports')
      .update({ content, schema_version: 1, updated_at: new Date().toISOString() })
      .eq('id', reportId)
      .select('id, updated_at')
      .single();
    if (error) { console.error('\u274c draft update:', error); throw error; }
    return { id: data.id, updated_at: data.updated_at };
  }

  const insertPayload = {
    specialist_id: sess.id,
    child_id: childId,
    content,
    schema_version: 1,
    status: 'draft',
    report_type: 'general',
  };
  if (templateId) insertPayload.template_id = templateId;
  const { data, error } = await supa.from('reports')
    .insert(insertPayload)
    .select('id, updated_at')
    .single();
  if (error) { console.error('\u274c draft insert:', error); throw error; }
  return { id: data.id, updated_at: data.updated_at };
}

export async function listDrafts({ specialistId }) {
  const supa = _supa();
  if (!supa) return [];
  try {
    const { data, error } = await supa.from('reports')
      .select('id, child_id, content, updated_at')
      .eq('specialist_id', specialistId)
      .eq('status', 'draft')
      .not('content', 'is', null)
      .order('updated_at', { ascending: false });
    if (error) { console.error('\u274c listDrafts:', error); return []; }
    return data || [];
  } catch (e) {
    console.error('\u274c listDrafts:', e);
    return [];
  }
}

export async function deleteDraft({ reportId }) {
  const supa = _supa();
  if (!supa) return { ok: false, error: 'not_authenticated' };
  try {
    const { error } = await supa.from('reports')
      .delete()
      .eq('id', reportId)
      .eq('status', 'draft');
    if (error) { console.error('\u274c deleteDraft:', error); return { ok: false, error }; }
    return { ok: true };
  } catch (e) {
    console.error('\u274c deleteDraft:', e);
    return { ok: false, error: e };
  }
}

export async function saveTemplateV2({ templateId, content, name, description, specialty }) {
  const supa = _supa();
  const sess = _session();
  if (!supa || !sess) return { error: 'Not authenticated' };
  if (!name?.trim()) return { error: 'Template name is required' };
  if (!content?.content?.length) return { error: 'Template content is empty' };
  try {
    if (templateId) {
      const { error } = await supa.from('report_templates')
        .update({ name: name.trim(), description: description?.trim() || null, content, schema_version: 1, updated_at: new Date().toISOString() })
        .eq('id', templateId);
      if (error) { console.error('\u274c template update:', error); return { error: error.message }; }
      return { id: templateId };
    }
    const { data, error } = await supa.from('report_templates')
      .insert({ specialist_id: sess.id, name: name.trim(), description: description?.trim() || null, content, schema_version: 1, sections: [], source: 'ai-imported', use_count: 0 })
      .select('id').single();
    if (error) { console.error('\u274c template insert:', error); return { error: error.message }; }
    return { id: data.id };
  } catch (e) {
    console.error('\u274c saveTemplateV2:', e);
    return { error: e.message };
  }
}

export async function findExistingDraft({ specialistId, childId }) {
  const supa = _supa();
  if (!supa) return null;
  try {
    const { data, error } = await supa.from('reports')
      .select('id, updated_at, content')
      .eq('specialist_id', specialistId)
      .eq('child_id', childId)
      .eq('status', 'draft')
      .not('content', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (error) { console.error('\u274c findExistingDraft:', error); return null; }
    return data?.length ? data[0] : null;
  } catch (e) {
    console.error('\u274c findExistingDraft:', e);
    return null;
  }
}

async function loadReport(reportId) {
  const supa = _supa();
  if (!supa) return { error: 'not_authenticated' };
  const { data, error } = await supa.from('reports')
    .select('id, content, schema_version, child_id, updated_at, status, generated_text, report_type, shared_with_parents, shared_at, finalized_at')
    .eq('id', reportId)
    .single();
  if (error) { console.error('\u274c report load:', error); return { error: error.message }; }
  if (!data) return { error: 'not_found' };
  if (data.schema_version && data.schema_version !== 1) return { error: 'unsupported_schema' };
  return { data };
}

export async function mountGateEditor(containerEl, opts = {}) {
  containerEl.textContent = 'Loading editor...';

  const { Editor, Node, mergeAttributes } = await import('@tiptap/core');
  const { default: StarterKit } = await import('@tiptap/starter-kit');
  const { default: Placeholder } = await import('@tiptap/extension-placeholder');
  const { TextSelection } = await import('@tiptap/pm/state');
  const { createPhraseSuggestionExtension } = await import('./phrase-suggestion.js');

  const _confirm = window.HUD?.openConfirm;
  const _toast = window.HUD?.toast;
  const isReadOnly = !!opts.readOnly;
  const isTemplateMode = !!opts.templateMode;

  // ── Resolve report data ──
  let reportId = opts.draftId || opts.reportId || null;
  let childId = opts.childId || null;
  let initialContent = null;
  let loadMessage = null;
  let reportRow = null;

  if (reportId && !opts.startNew) {
    const result = await loadReport(reportId);
    if (result.error) {
      containerEl.textContent = '';
      const errMsg = result.error === 'unsupported_schema'
        ? 'This draft uses a newer editor format and cannot be opened in this version.'
        : 'Failed to load report: ' + result.error;
      const errEl = document.createElement('div');
      errEl.style.cssText = 'padding:24px;text-align:center;color:#ef4444;font-size:15px;';
      errEl.textContent = errMsg;
      containerEl.appendChild(errEl);
      return null;
    }
    reportRow = result.data;
    initialContent = reportRow.content;
    if (reportRow.child_id) childId = reportRow.child_id;
    if (reportRow.status === 'draft' && reportRow.updated_at) {
      const d = new Date(reportRow.updated_at);
      loadMessage = 'Continuing draft from ' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  if (opts.startNew) reportId = null;

  if (!initialContent && opts.initialContent) initialContent = opts.initialContent;

  if (isTemplateMode && !initialContent) {
    if (opts.templateContent) initialContent = opts.templateContent;
    else if (opts.templateSections) initialContent = sectionsToTiptapDoc(opts.templateSections);
  }

  if (!childId && !isTemplateMode) {
    childId = await _findDefaultChild();
  }

  const isFinalized = reportRow?.status === 'finalized' || isReadOnly;

  let _phraseExt = null;
  if (!isFinalized) {
    _phraseExt = createPhraseSuggestionExtension({
      getChild: () => childId ? _resolveChild(childId) : null,
      loadPhrases: async () => (await import('./phrases.js')).loadPhrases(),
      onPhraseSelected: (phrase) => {
        const supa = _supa();
        if (supa && phrase?.id) supa.from('specialist_phrases').update({ use_count: (phrase.use_count || 0) + 1, last_used_at: new Date().toISOString() }).eq('id', phrase.id).then(() => {}).catch(() => {});
      },
      openCreatePhraseDialog: (initialName) => { window.HUD_REPORTS?.openNewPhraseDialog?.(initialName); },
      substitutePlaceholders,
    });
  }

  const ReportDoc = Node.create({
    name: 'doc',
    topNode: true,
    content: 'reportBlock+',
  });

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

  const SectionBody = Node.create({
    name: 'sectionBody',
    content: 'block+',
    defining: true,
    parseHTML() { return [{ tag: 'div[data-type="section-body"]' }]; },
    renderHTML({ HTMLAttributes }) {
      return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'section-body', class: 'rpt-section-body' }), 0];
    },
  });

  const ReportSection = Node.create({
    name: 'reportSection',
    group: 'reportBlock',
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

        if (!isFinalized) {
          const header = document.createElement('div');
          header.classList.add('rpt-section-header');
          header.contentEditable = 'false';

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

          const removeBtn = document.createElement('button');
          removeBtn.classList.add('rpt-section-remove');
          removeBtn.textContent = '\u2715';
          removeBtn.onpointerdown = (ev) => ev.preventDefault();
          removeBtn.onclick = () => {
            const doRemove = () => {
              const pos = getPos();
              if (pos === undefined || pos === null) return;
              ed.chain().focus().command(({ tr }) => {
                const liveNode = tr.doc.nodeAt(pos);
                if (!liveNode || liveNode.type.name !== 'reportSection') return false;
                tr.delete(pos, pos + liveNode.nodeSize);
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
        }

        const contentDOM = document.createElement('div');
        contentDOM.classList.add('rpt-section-content');
        dom.appendChild(contentDOM);

        return { dom, contentDOM };
      };
    },

    addKeyboardShortcuts() {
      return {
        'Enter': ({ editor: ed }) => {
          const { $from } = ed.state.selection;
          if ($from.parent.type.name === 'sectionTitle') {
            const titleEnd = $from.end();
            try {
              const bodyPos = titleEnd + 1;
              ed.chain().setTextSelection(bodyPos + 1).run();
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
          if ($from.parent.type.name === 'paragraph') {
            const grandparent = $from.node($from.depth - 1);
            if (grandparent?.type.name === 'sectionBody' && $from.parentOffset === 0) {
              const bodyStart = $from.before($from.depth - 1);
              if ($from.pos === bodyStart + 1) return true;
            }
          }
          if ($from.parent.type.name === 'sectionTitle' && $from.parentOffset === 0) {
            return true;
          }
          return false;
        },
      };
    },
  });

  // ── Build UI ──
  containerEl.textContent = '';

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'tiptap-gate-toolbar';

  if (!isFinalized) {
    const fmtActions = [
      { label: 'B', cmd: e => e.chain().focus().toggleBold().run() },
      { label: 'I', cmd: e => e.chain().focus().toggleItalic().run() },
      { label: 'H1', cmd: e => e.chain().focus().toggleHeading({ level: 1 }).run() },
      { label: '\u2022 List', cmd: e => e.chain().focus().toggleBulletList().run() },
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

    // Section picker
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
          editor.chain().focus().command(({ tr, state }) => {
            const insertPos = state.doc.content.size;
            const s = state.schema.nodes;
            const newSection = s.reportSection.create({}, [
              s.sectionTitle.create({}, state.schema.text(title)),
              s.sectionBody.create({}, s.paragraph.create()),
            ]);
            tr.insert(insertPos, newSection);
            const titleNode = newSection.child(0);
            const bodyStart = insertPos + 1 + titleNode.nodeSize + 1 + 1;
            try { tr.setSelection(TextSelection.near(tr.doc.resolve(bodyStart))); } catch (_) {}
            return true;
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
  }

  // Save status indicator (draft edit mode only)
  const saveStatus = document.createElement('span');
  saveStatus.className = 'tiptap-gate-save-status';
  if (!isFinalized && !isTemplateMode) toolbar.appendChild(saveStatus);

  // Action buttons area (right side of toolbar)
  const actionsWrap = document.createElement('div');
  actionsWrap.style.cssText = 'display:flex;gap:6px;align-items:center;margin-inline-start:auto;';

  function _mkActionBtn(label, style, onclick) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = style;
    b.onpointerdown = (ev) => ev.preventDefault();
    b.onclick = onclick;
    return b;
  }

  async function _handleDownloadPDF() {
    try {
      const json = editor.getJSON();
      const md = tiptapToMarkdown(json);
      const { generatePDFBlob } = await import('./pdf-util.js');
      const { ensureBranding, getBranding, calcAge, _buildCredentials, _downloadBlob } = await import('./index.js');
      await ensureBranding();
      const child = _resolveChild(childId);
      const sess = _session();
      const ci = { name: child?.name || 'Patient', dob: child?.dob || '', age: calcAge(child?.dob) };
      const si = { name: sess?.displayName || sess?.name || '', specialty: sess?.profession || '', credentials: _buildCredentials?.(sess) || '' };
      const blob = await generatePDFBlob(md, reportRow?.report_type || 'general', ci, si, getBranding());
      _downloadBlob(blob, reportRow?.report_type || 'general', child?.name);
      _toast?.('\ud83d\udce5 PDF downloaded!');
    } catch (e) {
      console.error('\u274c PDF export:', e);
      _toast?.('PDF generation failed: ' + e.message, 'error');
    }
  }

  async function _handleShare() {
    try {
      const { _shareReportWithParents, ensureBranding } = await import('./index.js');
      const sess = _session();
      const supa = _supa();
      const md = reportRow?.generated_text || tiptapToMarkdown(editor.getJSON());
      await _shareReportWithParents({ ...reportRow, id: reportId }, md, supa, sess);
      reportRow.shared_with_parents = true;
      reportRow.shared_at = new Date().toISOString();
      if (shareBtn) shareBtn.remove();
      statusLine.textContent = '\u2705 Shared with parents on ' + new Date().toLocaleDateString();
      _toast?.('\ud83d\udce4 Report shared with parents!');
      try { window.HUD?.re?.(); } catch (_) {}
    } catch (e) {
      console.error('\u274c Share:', e);
      _toast?.('Could not share: ' + e.message, 'error');
    }
  }

  let shareBtn = null;

  if (isFinalized) {
    if (reportRow?.finalized_at) {
      const badge = document.createElement('span');
      badge.style.cssText = 'font-size:12px;color:#0d9488;font-weight:600;white-space:nowrap;';
      badge.textContent = '\ud83d\udd12 Finalized ' + new Date(reportRow.finalized_at).toLocaleDateString();
      actionsWrap.appendChild(badge);
    }
    actionsWrap.appendChild(_mkActionBtn('\ud83d\udce5 Download PDF', 'padding:6px 14px;border:1px solid #d1e0dd;border-radius:8px;background:#fff;font-size:13px;cursor:pointer;font-family:inherit;', _handleDownloadPDF));
    if (!reportRow?.shared_with_parents) {
      shareBtn = _mkActionBtn('\ud83d\udce4 Share with Parents', 'padding:6px 14px;border:none;border-radius:8px;background:#0d9488;color:#fff;font-size:13px;cursor:pointer;font-family:inherit;font-weight:500;', _handleShare);
      actionsWrap.appendChild(shareBtn);
    }
  } else {
    // Finalize button (edit mode)
    const finalizeBtn = _mkActionBtn('\u2705 Finalize', 'padding:6px 14px;border:none;border-radius:8px;background:#0d9488;color:#fff;font-size:13px;cursor:pointer;font-family:inherit;font-weight:500;', () => {
      if (!reportId || !childId) { _toast?.('Cannot finalize \u2014 save a draft first.', 'error'); return; }
      if (reportRow?.status === 'finalized') return;
      const doFinalize = async () => {
        try {
          const json = editor.getJSON();
          const md = tiptapToMarkdown(json);
          const supa = _supa();
          const { data, error } = await supa.from('reports')
            .update({
              content: json, generated_text: md, schema_version: 1,
              status: 'finalized', finalized_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            })
            .eq('id', reportId)
            .select('id, finalized_at, status')
            .single();
          if (error) { console.error('\u274c finalize:', error); _toast?.('Finalize failed.', 'error'); return; }
          reportRow = { ...(reportRow || {}), ...data, content: json, generated_text: md, child_id: childId, report_type: reportRow?.report_type || 'general' };
          editor.setEditable(false);
          // Swap toolbar to read-only actions
          toolbar.textContent = '';
          toolbar.className = 'tiptap-gate-toolbar';
          const roBadge = document.createElement('span');
          roBadge.style.cssText = 'font-size:12px;color:#0d9488;font-weight:600;white-space:nowrap;';
          roBadge.textContent = '\ud83d\udd12 Finalized ' + new Date(data.finalized_at).toLocaleDateString();
          toolbar.appendChild(roBadge);
          const roActions = document.createElement('div');
          roActions.style.cssText = 'display:flex;gap:6px;align-items:center;margin-inline-start:auto;';
          roActions.appendChild(_mkActionBtn('\ud83d\udce5 Download PDF', 'padding:6px 14px;border:1px solid #d1e0dd;border-radius:8px;background:#fff;font-size:13px;cursor:pointer;font-family:inherit;', _handleDownloadPDF));
          shareBtn = _mkActionBtn('\ud83d\udce4 Share with Parents', 'padding:6px 14px;border:none;border-radius:8px;background:#0d9488;color:#fff;font-size:13px;cursor:pointer;font-family:inherit;font-weight:500;', _handleShare);
          roActions.appendChild(shareBtn);
          toolbar.appendChild(roActions);
          // Hide section controls
          editorWrap.querySelectorAll('.rpt-section-header').forEach(h => h.style.display = 'none');
          // Update status + title
          statusLine.textContent = '\u2705 Report finalized.';
          if (opts._setTitle) {
            const child = _resolveChild(childId);
            opts._setTitle('Viewing finalized report' + (child?.name ? ' \u2014 ' + child.name : ''));
          }
          _toast?.('\u2705 Report finalized!');
          dirty = false;
          clearTimeout(_saveTimer); clearInterval(_tickTimer);
          window.HUD_REPORTS?.invalidateReportsCache?.();
          try { window.HUD?.re?.(); } catch (_) {}
        } catch (e) {
          console.error('\u274c finalize:', e);
          _toast?.('Finalize failed.', 'error');
        }
      };
      if (_confirm) {
        _confirm('Finalize report?', 'Once finalized, the report cannot be edited. This action is permanent.', false, doFinalize);
      } else {
        doFinalize();
      }
    });
    actionsWrap.appendChild(finalizeBtn);
  }

  if (isTemplateMode) {
    const _tplId = opts.templateId || null;
    const _lsKey = _tplId ? 'huddledin.template_draft.' + _tplId : 'huddledin.template_draft';

    function _openNameDialog({ mode, initialName, initialDesc, onSave }) {
      const _modal = window.HUD?.openModal;
      if (!_modal) return;
      const titles = { 'save-new': 'Save as Template', 'save-changes': 'Save changes', 'save-copy': 'Save copy' };
      const btnLabels = { 'save-new': 'Save as Template', 'save-changes': 'Save changes', 'save-copy': 'Save copy' };
      _modal(titles[mode] || 'Save', (mb, close) => {
        const nameLabel = document.createElement('label');
        nameLabel.style.cssText = 'display:block;font-size:13px;font-weight:600;color:#334155;margin-bottom:4px;';
        nameLabel.textContent = 'Template name *';
        mb.appendChild(nameLabel);
        const nameInp = document.createElement('input');
        nameInp.type = 'text';
        nameInp.value = initialName || '';
        nameInp.placeholder = 'e.g. Speech Evaluation';
        nameInp.style.cssText = 'width:100%;padding:10px 12px;border:1.5px solid #d1e0dd;border-radius:8px;font-size:15px;font-family:inherit;box-sizing:border-box;margin-bottom:12px;outline:none;';
        nameInp.onfocus = () => { nameInp.style.borderColor = '#0d9488'; };
        nameInp.onblur = () => { nameInp.style.borderColor = '#d1e0dd'; };
        mb.appendChild(nameInp);
        const descLabel = document.createElement('label');
        descLabel.style.cssText = 'display:block;font-size:13px;font-weight:600;color:#334155;margin-bottom:4px;';
        descLabel.textContent = 'Description (optional)';
        mb.appendChild(descLabel);
        const descInp = document.createElement('textarea');
        descInp.rows = 3;
        descInp.value = initialDesc || '';
        descInp.placeholder = 'Brief description of this template';
        descInp.style.cssText = 'width:100%;padding:10px 12px;border:1.5px solid #d1e0dd;border-radius:8px;font-size:15px;font-family:inherit;box-sizing:border-box;resize:vertical;margin-bottom:12px;outline:none;';
        mb.appendChild(descInp);
        const errEl = document.createElement('div');
        errEl.style.cssText = 'color:#ef4444;font-size:13px;margin-bottom:8px;display:none;';
        mb.appendChild(errEl);
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-md btn-ghost';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = close;
        row.appendChild(cancelBtn);
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn-md btn-primary';
        saveBtn.textContent = btnLabels[mode] || 'Save';
        saveBtn.onclick = async () => {
          const n = nameInp.value.trim();
          if (!n) { errEl.textContent = 'Name is required'; errEl.style.display = 'block'; nameInp.focus(); return; }
          saveBtn.disabled = true; saveBtn.textContent = 'Saving\u2026';
          await onSave(n, descInp.value.trim(), close);
          saveBtn.disabled = false; saveBtn.textContent = btnLabels[mode] || 'Save';
        };
        row.appendChild(saveBtn);
        mb.appendChild(row);
        setTimeout(() => nameInp.focus(), 50);
      }, 420);
    }

    async function _doSaveTemplate(name, desc, targetId, close) {
      const json = editor.getJSON();
      const result = await saveTemplateV2({ templateId: targetId, content: json, name, description: desc, specialty: window.HUD?.session?.profession || null });
      if (result.error) { _toast?.(result.error, 'error'); return; }
      try { localStorage.removeItem(_lsKey); } catch (_) {}
      close();
      _toast?.('\u2705 Template saved!');
      window.HUD_REPORTS?.invalidateTemplatesCache?.();
      window.HUD_REPORTS?.invalidateReportsCache?.();
      opts._closeModal?.();
      if (typeof window.HUD_REPORTS?.navToTemplates === 'function') {
        window.HUD_REPORTS.navToTemplates();
      } else {
        const S = window.HUD?.S;
        if (S) { S.activeTab = 'reports'; }
        try { window.HUD?.re?.(); } catch (_) {}
      }
    }

    actionsWrap.textContent = '';
    actionsWrap.appendChild(_mkActionBtn('Discard', 'padding:6px 14px;border:1px solid #d1e0dd;border-radius:8px;background:#fff;font-size:13px;cursor:pointer;font-family:inherit;color:#64748b;', () => {
      if (_confirm) {
        _confirm('Discard this template?', 'Your changes will be lost.', true, () => {
          try { localStorage.removeItem(_lsKey); } catch (_) {}
          opts._closeModal?.();
        });
      } else {
        try { localStorage.removeItem(_lsKey); } catch (_) {}
        opts._closeModal?.();
      }
    }));

    if (_tplId) {
      actionsWrap.appendChild(_mkActionBtn('Save', 'padding:6px 14px;border:none;border-radius:8px;background:#0d9488;color:#fff;font-size:13px;cursor:pointer;font-family:inherit;font-weight:500;', () => {
        const _modal = window.HUD?.openModal;
        if (!_modal) return;
        _modal('Save template', (mb, close) => {
          const msg = document.createElement('div');
          msg.style.cssText = 'margin-bottom:20px;color:#334155;font-size:14px;line-height:1.5;';
          msg.textContent = 'You\u2019ve edited \u201c' + (opts.templateName || 'this template') + '\u201d. What would you like to do?';
          mb.appendChild(msg);
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;';
          const c = document.createElement('button'); c.className = 'btn-md btn-ghost'; c.textContent = 'Cancel'; c.onclick = close; row.appendChild(c);
          const cp = document.createElement('button'); cp.className = 'btn-md btn-secondary'; cp.textContent = 'Save as new copy'; cp.onclick = () => {
            close();
            _openNameDialog({ mode: 'save-copy', initialName: (opts.templateName || 'Template') + ' (copy)', initialDesc: opts.templateDescription || '', onSave: (n, d, cl) => _doSaveTemplate(n, d, null, cl) });
          }; row.appendChild(cp);
          const sv = document.createElement('button'); sv.className = 'btn-md btn-primary'; sv.textContent = 'Save changes'; sv.onclick = () => {
            close();
            _openNameDialog({ mode: 'save-changes', initialName: opts.templateName || '', initialDesc: opts.templateDescription || '', onSave: (n, d, cl) => _doSaveTemplate(n, d, _tplId, cl) });
          }; row.appendChild(sv);
          mb.appendChild(row);
        }, 420);
      }));
    } else {
      const _stem = (opts.sourceFileName || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      actionsWrap.appendChild(_mkActionBtn('Save as Template', 'padding:6px 14px;border:none;border-radius:8px;background:#0d9488;color:#fff;font-size:13px;cursor:pointer;font-family:inherit;font-weight:500;', () => {
        _openNameDialog({ mode: 'save-new', initialName: _stem, initialDesc: '', onSave: (n, d, cl) => _doSaveTemplate(n, d, null, cl) });
      }));
    }
  }

  toolbar.appendChild(actionsWrap);
  containerEl.appendChild(toolbar);

  // Editor container
  const editorWrap = document.createElement('div');
  editorWrap.className = 'tiptap-gate-editor' + (isFinalized ? ' tiptap-gate-readonly' : '');
  containerEl.appendChild(editorWrap);

  // Mount Tiptap
  const editor = new Editor({
    element: editorWrap,
    editable: !isFinalized,
    extensions: [
      StarterKit.configure({ document: false }),
      ReportDoc,
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'sectionTitle') return 'Untitled section';
          return 'Type something...';
        },
      }),
      SectionTitle,
      SectionBody,
      ReportSection,
      ...(_phraseExt ? [_phraseExt] : []),
    ],
    content: initialContent || EMPTY_DOC,
  });

  // Inject scoped CSS (once)
  if (!document.getElementById('tiptap-gate-css')) {
    const style = document.createElement('style');
    style.id = 'tiptap-gate-css';
    style.textContent = `
      .tiptap-gate-toolbar { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; align-items:center; }
      .tiptap-gate-toolbar button { padding:6px 12px; border:1px solid #d1e0dd; border-radius:8px; background:#fff; font-size:14px; cursor:pointer; min-height:36px; font-family:inherit; transition:background .12s; }
      .tiptap-gate-toolbar button:hover { background:#f0fdf9; }
      .tiptap-gate-save-status { font-size:12px; padding:4px 10px; border-radius:6px; transition:opacity .3s; opacity:0; white-space:nowrap; }
      .tiptap-gate-save-status.saved { color:#0d9488; opacity:1; }
      .tiptap-gate-save-status.saving { color:#64748b; opacity:1; }
      .tiptap-gate-save-status.error { color:#ef4444; opacity:1; }
      .tiptap-gate-editor { border:1.5px solid #d1e0dd; border-radius:10px; background:#fff; min-height:300px; }
      .tiptap-gate-editor .ProseMirror { padding:16px; outline:none; min-height:280px; font-size:16px; line-height:1.6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif; }
      .tiptap-gate-editor .ProseMirror p.is-editor-empty:first-child::before { content:attr(data-placeholder); color:#94a3b8; pointer-events:none; float:left; height:0; }
      .tiptap-gate-editor .ProseMirror h1 { font-size:24px; font-weight:700; }
      .tiptap-gate-editor .ProseMirror h2 { font-size:20px; font-weight:700; }
      .tiptap-gate-editor .ProseMirror ul, .tiptap-gate-editor .ProseMirror ol { padding-inline-start:24px; }

      .rpt-section { border-top:3px solid #0d9488; margin:16px 0; position:relative; }
      .rpt-section-header { position:absolute; top:4px; inset-inline-end:0; display:flex; align-items:center; gap:4px; z-index:1; }
      .rpt-section-move { display:inline-flex; align-items:center; justify-content:center; background:none; border:1px solid #d1e0dd; border-radius:6px; cursor:pointer; font-size:14px; color:#64748b; padding:2px 6px; min-width:28px; min-height:28px; flex-shrink:0; }
      .rpt-section-move:hover { background:#f0fdf9; color:#0d9488; }
      .rpt-section-move:disabled { opacity:.3; cursor:default; }
      .rpt-section-remove { background:none; border:none; cursor:pointer; color:#94a3b8; font-size:16px; padding:2px 6px; border-radius:4px; flex-shrink:0; transition:color .12s,background .12s; min-width:28px; min-height:28px; display:flex; align-items:center; justify-content:center; }
      .rpt-section-remove:hover { color:#dc2626; background:#fef2f2; }
      .rpt-section-content { padding:0; }

      .rpt-section-title { font-size:14px; font-weight:700; color:#0d9488; text-transform:uppercase; letter-spacing:.05em; padding:8px 80px 4px 4px; border-radius:4px; cursor:text; outline:none; min-height:24px; }
      .rpt-section-title:focus { background:#f0fdf9; }
      .rpt-section-title.is-empty::before { content:attr(data-placeholder); color:#94a3b8; pointer-events:none; float:left; height:0; }

      .rpt-section-body { padding:4px 0; }

      .rpt-section-picker { position:absolute; top:100%; inset-inline-start:0; margin-top:6px; background:#fff; border:1px solid #d1e0dd; border-radius:10px; box-shadow:0 4px 16px rgba(0,0,0,.1); max-height:260px; overflow-y:auto; z-index:10; min-width:220px; padding:4px 0; }
      .rpt-section-picker-item { padding:10px 14px; font-size:14px; color:#0f1a18; cursor:pointer; transition:background .1s; }
      .rpt-section-picker-item:hover { background:#f0fdf9; }

      .ProseMirror .rpt-section.ProseMirror-selectednode { outline:2px solid #0d9488; outline-offset:2px; border-radius:6px; }

      .tiptap-gate-readonly .rpt-section-title { cursor:default; padding-inline-end:4px; }
      .tiptap-gate-readonly .rpt-section-title:focus { background:none; }
      .tiptap-gate-readonly .ProseMirror { cursor:default; }

      .hud-phrase-dropdown { position:fixed; z-index:1000; background:#fff; border:1px solid #e2e8f0; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,.1); min-width:280px; max-width:400px; max-height:280px; overflow-y:auto; padding:4px; }
      .hud-phrase-item { padding:8px 12px; cursor:pointer; border-radius:4px; }
      .hud-phrase-item:hover, .hud-phrase-item.selected { background:#f0fdf9; }
      .hud-phrase-item .name { font-weight:600; color:#0d9488; font-size:14px; }
      .hud-phrase-item .preview { font-size:12px; color:#64748b; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .hud-phrase-item.create-new .name { font-style:italic; }
    `;
    document.head.appendChild(style);
  }

  // Status line
  const statusLine = document.createElement('div');
  statusLine.style.cssText = 'margin-top:12px;font-size:13px;color:#64748b;';
  if (isFinalized) {
    const parts = [];
    if (reportRow?.finalized_at) parts.push('\ud83d\udd12 Finalized on ' + new Date(reportRow.finalized_at).toLocaleDateString());
    if (reportRow?.shared_with_parents) parts.push('\u2705 Shared with parents' + (reportRow.shared_at ? ' on ' + new Date(reportRow.shared_at).toLocaleDateString() : ''));
    statusLine.textContent = parts.join(' \u00b7 ') || 'Viewing finalized report.';
  } else if (isTemplateMode) {
    statusLine.textContent = 'Edit sections, then save as a reusable template.';
  } else {
    statusLine.textContent = loadMessage || (childId ? 'Editor ready. Drafts auto-save.' : 'Editor ready. No patient linked \u2014 drafts will not save.');
  }
  containerEl.appendChild(statusLine);

  // ── Autosave plumbing (edit mode only) ──
  let dirty = false;
  let saving = false;
  let _statusTimeout = null;

  if (isTemplateMode) {
    const _lsKeyAuto = opts.templateId ? 'huddledin.template_draft.' + opts.templateId : 'huddledin.template_draft';
    let _lsTimer = null;
    function _lsSave() {
      try {
        localStorage.setItem(_lsKeyAuto, JSON.stringify({
          content: editor.getJSON(),
          sourceFileName: opts.sourceFileName || null,
          templateId: opts.templateId || null,
          templateName: opts.templateName || null,
          updatedAt: new Date().toISOString(),
        }));
      } catch (_) {}
      dirty = false;
    }
    editor.on('update', () => {
      dirty = true;
      clearTimeout(_lsTimer);
      _lsTimer = setTimeout(_lsSave, 2000);
    });
    _beforeUnloadHandler = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', _beforeUnloadHandler);

    editor._gateCleanup = () => {
      clearTimeout(_lsTimer);
      if (_beforeUnloadHandler) { window.removeEventListener('beforeunload', _beforeUnloadHandler); _beforeUnloadHandler = null; }
      editor.destroy();
    };
    editor._gateSave = () => { if (dirty) _lsSave(); };
    editor._gateIsDirty = () => dirty;
  } else if (!isFinalized) {
    function showSaveStatus(text, cls) {
      saveStatus.textContent = text;
      saveStatus.className = 'tiptap-gate-save-status ' + cls;
      clearTimeout(_statusTimeout);
      if (cls === 'saved') {
        _statusTimeout = setTimeout(() => { saveStatus.className = 'tiptap-gate-save-status'; }, 1500);
      }
    }

    async function doSave() {
      if (!dirty || saving || !childId) return;
      saving = true;
      showSaveStatus('Saving\u2026', 'saving');
      try {
        const json = editor.getJSON();
        const result = await saveDraft({ reportId, content: json, childId, templateId: opts.fromTemplateId || null });
        if (!reportId) reportId = result.id;
        dirty = false;
        showSaveStatus('Saved', 'saved');
      } catch (e) {
        if (e.name === 'AbortError') { saving = false; return; }
        showSaveStatus('Save failed', 'error');
      } finally {
        saving = false;
      }
    }

    function scheduleSave() {
      clearTimeout(_saveTimer);
      _saveTimer = setTimeout(doSave, 2000);
    }

    editor.on('update', () => {
      dirty = true;
      scheduleSave();
    });

    if (opts.initialContent) { dirty = true; scheduleSave(); }

    const onBlur = () => { if (dirty && !saving) doSave(); };
    window.addEventListener('blur', onBlur);

    _tickTimer = setInterval(() => { if (dirty && !saving) doSave(); }, 30000);

    _beforeUnloadHandler = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', _beforeUnloadHandler);

    function cleanup() {
      clearTimeout(_saveTimer);
      clearInterval(_tickTimer);
      window.removeEventListener('blur', onBlur);
      if (_beforeUnloadHandler) {
        window.removeEventListener('beforeunload', _beforeUnloadHandler);
        _beforeUnloadHandler = null;
      }
      editor.destroy();
    }

    editor._gateCleanup = cleanup;
    editor._gateSave = doSave;
    editor._gateIsDirty = () => dirty;
  } else {
    editor._gateCleanup = () => editor.destroy();
    editor._gateSave = () => {};
    editor._gateIsDirty = () => false;
  }

  return editor;
}
