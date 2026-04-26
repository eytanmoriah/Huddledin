// Homework Module — Phase 2 entry point
// Manages homework creation/editing with multi-exercise support.

import { mountHomeworkCreateModal } from './create-modal.js';

export function initHomework() {
  console.log('[Huddledin] Homework v2 module initialized');
}

// Public API — exposed on window.HUD via app.js
export { mountHomeworkCreateModal };
