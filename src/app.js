// Huddledin Module Entry Point
import { initReports } from './features/reports/index.js';

console.log('[Huddledin] Module system loaded');

if (window.HUD) {
  initReports();
} else {
  window.addEventListener('hud-ready', () => initReports());
}
