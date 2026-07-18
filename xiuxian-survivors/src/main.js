import { initGame } from './game.js';

// 入口：等 DOM 就绪后启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initGame(document.getElementById('stage')));
} else {
  initGame(document.getElementById('stage'));
}
