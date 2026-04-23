import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';

const PHRASE_KEY = new PluginKey('phraseSuggestion');

export function createPhraseSuggestionExtension({ getChild, loadPhrases, onPhraseSelected, openCreatePhraseDialog, substitutePlaceholders }) {
  let cachedPhrases = null;

  return Extension.create({
    name: 'phraseSuggestion',

    addProseMirrorPlugins() {
      return [
        Suggestion({
          pluginKey: PHRASE_KEY,
          editor: this.editor,
          char: '@',
          allowSpaces: false,
          allowedPrefixes: [' ', '\n', null],
          startOfLine: false,

          command: ({ editor, range, props }) => {
            if (props._createNew) {
              openCreatePhraseDialog?.(props._query || '');
              editor.chain().focus().deleteRange(range).run();
              return;
            }
            const child = getChild?.();
            const text = child ? substitutePlaceholders(props.content, child) : props.content;
            editor.chain().focus().deleteRange(range).insertContent(text).run();
            onPhraseSelected?.(props);
          },

          items: async ({ query }) => {
            try { cachedPhrases = await loadPhrases(); } catch (_) {}
            const list = cachedPhrases || [];
            const q = (query || '').toLowerCase();
            const filtered = q ? list.filter(p => (p.name || '').toLowerCase().includes(q)) : list;
            filtered.sort((a, b) => {
              const aT = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
              const bT = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
              if (bT !== aT) return bT - aT;
              return (a.name || '').localeCompare(b.name || '');
            });
            const results = filtered.slice(0, 8);
            if (!results.length) results.push({ _createNew: true, _query: query, name: '\u2728 Create new phrase' + (query ? ': "' + query + '"' : ''), content: '' });
            return results;
          },

          render: () => {
            let el = null;
            let items = [];
            let selectedIdx = 0;
            let commandFn = null;

            function build() {
              if (!el) return;
              el.innerHTML = '';
              items.forEach((item, i) => {
                const row = document.createElement('div');
                row.className = 'hud-phrase-item' + (i === selectedIdx ? ' selected' : '') + (item._createNew ? ' create-new' : '');
                const nameDiv = document.createElement('div');
                nameDiv.className = 'name';
                nameDiv.textContent = item.name || '';
                row.appendChild(nameDiv);
                if (!item._createNew && item.content) {
                  const prev = document.createElement('div');
                  prev.className = 'preview';
                  prev.textContent = item.content.length > 60 ? item.content.slice(0, 60) + '\u2026' : item.content;
                  row.appendChild(prev);
                }
                row.onmouseenter = () => { selectedIdx = i; build(); };
                row.onmousedown = (ev) => { ev.preventDefault(); commandFn?.({ id: item.id, ...item }); };
                el.appendChild(row);
              });
            }

            function position(clientRect) {
              if (!el || !clientRect) return;
              const rect = typeof clientRect === 'function' ? clientRect() : clientRect;
              if (!rect) return;
              const dropH = el.offsetHeight || 200;
              const spaceBelow = window.innerHeight - rect.bottom - 8;
              const top = spaceBelow > dropH ? rect.bottom + 4 : rect.top - dropH - 4;
              el.style.top = Math.max(4, top) + 'px';
              el.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - 420)) + 'px';
            }

            return {
              onStart(props) {
                el = document.createElement('div');
                el.className = 'hud-phrase-dropdown';
                document.body.appendChild(el);
                items = props.items || [];
                selectedIdx = 0;
                commandFn = (item) => props.command(item);
                build();
                position(props.clientRect);
              },
              onUpdate(props) {
                items = props.items || [];
                selectedIdx = 0;
                commandFn = (item) => props.command(item);
                build();
                position(props.clientRect);
              },
              onKeyDown({ event }) {
                if (event.key === 'ArrowDown') { selectedIdx = Math.min(selectedIdx + 1, items.length - 1); build(); return true; }
                if (event.key === 'ArrowUp') { selectedIdx = Math.max(selectedIdx - 1, 0); build(); return true; }
                if (event.key === 'Enter') { commandFn?.(items[selectedIdx]); return true; }
                if (event.key === 'Escape') { el?.remove(); el = null; return true; }
                return false;
              },
              onExit() { el?.remove(); el = null; },
            };
          },
        }),
      ];
    },
  });
}
