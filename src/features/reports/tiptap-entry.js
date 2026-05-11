// Tiptap report-builder bundle entry — fix-05 (audit Report 05 #1).
// Built as a separate bundle (public/tiptap.bundle.js), loaded on-demand via
// <script> injection from src/app.js. Exposes the report-builder surface on
// window.HUD_TIPTAP so callers can `await window.HUD_TIPTAP_API()` before use.

import {
  mountGateEditor,
  listDrafts,
  deleteDraft,
  findExistingDraft,
  substitutePlaceholders,
} from './tiptap-gate.js';

window.HUD_TIPTAP = {
  mountGateEditor,
  listDrafts,
  deleteDraft,
  findExistingDraft,
  substitutePlaceholders,
};
