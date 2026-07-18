import { initGame } from './game.js';
import { loadAssets, assetState } from './assets.js';

// 入口：先预加载外部素材（缺失自动回退，永不阻塞报错），再启动游戏
async function boot() {
  const loader = document.getElementById('loader');
  const fill = document.getElementById('loaderFill');
  const text = document.getElementById('loaderText');
  try {
    await loadAssets((done, total) => {
      fill.style.width = Math.round((done / total) * 100) + '%';
      text.textContent = `感应灵材 ${done} / ${total}`;
    });
    text.textContent = assetState.found
      ? `灵材入库 ${assetState.found} 件`
      : '未觅灵材 · 以墨代形';
  } catch (e) {
    // 素材加载绝不阻断游戏
    console.warn('asset load skipped:', e);
  } finally {
    initGame(document.getElementById('stage'));
    setTimeout(() => loader.classList.add('off'), 250);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
