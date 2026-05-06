// Homework Module — Phase 2+3+4 entry point

import { mountHomeworkCreateModal } from './create-modal.js';
import { openTemplatePicker, loadExerciseTemplates, saveExerciseTemplate, updateExerciseTemplate, deleteExerciseTemplate, incrementExerciseTemplateUseCount } from './templates.js';
import { renderHomeworkSpecList } from './list-view.js';
import { renderHomeworkDetail } from './detail-view.js';
import { renderHomeworkParent } from './parent-view.js';
import { exerciseSlotsOn } from './data.js';

export function initHomework() {
  console.log('[Huddledin] Homework v2 module initialized');
  window.HUD_HOMEWORK_INTERNALS = { exerciseSlotsOn };
}

export { mountHomeworkCreateModal, openTemplatePicker, renderHomeworkSpecList, renderHomeworkDetail, renderHomeworkParent, loadExerciseTemplates, saveExerciseTemplate, updateExerciseTemplate, deleteExerciseTemplate, incrementExerciseTemplateUseCount };
