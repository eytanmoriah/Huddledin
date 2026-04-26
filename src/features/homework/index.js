// Homework Module — Phase 2+3+4 entry point

import { mountHomeworkCreateModal } from './create-modal.js';
import { openTemplatePicker } from './templates.js';
import { renderHomeworkSpecList } from './list-view.js';
import { renderHomeworkDetail } from './detail-view.js';
import { renderHomeworkParent } from './parent-view.js';
import { mountCompleteModal } from './complete-modal.js';

export function initHomework() {
  console.log('[Huddledin] Homework v2 module initialized');
}

export { mountHomeworkCreateModal, openTemplatePicker, renderHomeworkSpecList, renderHomeworkDetail, renderHomeworkParent, mountCompleteModal };
