// Huddledin Module Entry Point
import { initReports } from './features/reports/index.js';

console.log('[Huddledin] Module system loaded');

// Initialize modules when HUD bridge is ready
if (window.HUD) {
  initReports();
} else {
  window.addEventListener('hud-ready', () => {
    initReports();
  });
}
