// ============================================================
// 外部素材管线
// - assets/ 目录存放 PNG，启动时统一预加载并汇报进度
// - 任何素材缺失 → 自动回退代码绘制版本，游戏永不因缺图报错
// - 像素素材：关闭 imageSmoothing，按整数倍缩放
// ============================================================
import { PLAYER_FILES, ENEMY_FILES } from './appearance.js';

// 依次探测的基准路径：
//  assets/…                 → python http.server / GitHub Pages / vite dev（根目录直出）
//  …                        → vite build（publicDir='assets' 拷贝到产物根）
//  xiuxian-survivors/assets/… → 仓库根目录的单文件 game.html
const BASES = ['assets/', '', 'xiuxian-survivors/assets/'];

// 单文件构建注入的内嵌素材（key → dataURI）；优先于文件探测
const EMBED = (typeof window !== 'undefined' && window.__EMBEDDED_ASSETS) || {};

const images = new Map();      // key → HTMLImageElement（加载成功的）
const tintCache = new Map();   // key@hue → 离屏 canvas
export const assetState = { total: 0, done: 0, found: 0, loaded: false };

function tryLoad(url) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = url;
  });
}

async function loadOne(key) {
  // 内嵌素材最优先（单文件 game.html 自带）
  if (EMBED[key]) {
    const im = await tryLoad(EMBED[key]);
    if (im && im.naturalWidth > 0) {
      images.set(key, im);
      assetState.found++;
      return;
    }
  }
  for (const base of BASES) {
    const im = await tryLoad(base + key);
    if (im && im.naturalWidth > 0) {
      images.set(key, im);
      assetState.found++;
      return;
    }
  }
  // 全部路径落空：静默回退（代码绘制版本兜底）
}

// 预加载清单里的全部素材；onProgress(done, total) 驱动加载进度条
export async function loadAssets(onProgress) {
  const manifest = [...new Set([...PLAYER_FILES, ...ENEMY_FILES])];
  assetState.total = manifest.length;
  assetState.done = 0;
  // 并发加载，逐个汇报
  await Promise.all(manifest.map(async (key) => {
    await loadOne(key);
    assetState.done++;
    onProgress && onProgress(assetState.done, assetState.total);
  }));
  assetState.loaded = true;
}

export const img = (key) => images.get(key) || null;
export const has = (key) => images.has(key);

// 色调偏移（法袍按境界换色）：hue-rotate 预处理进离屏 canvas 并缓存
export function tinted(key, hueDeg) {
  if (!hueDeg) return img(key);
  const ck = key + '@' + hueDeg;
  let c = tintCache.get(ck);
  if (c) return c;
  const im = img(key);
  if (!im) return null;
  c = document.createElement('canvas');
  c.width = im.width; c.height = im.height;
  const x = c.getContext('2d');
  if ('filter' in x) {
    x.filter = `hue-rotate(${hueDeg}deg)`;
    x.drawImage(im, 0, 0);
  } else {
    x.drawImage(im, 0, 0); // 老浏览器：不变色也不报错
  }
  tintCache.set(ck, c);
  return c;
}

// 绘制精灵帧：整数倍缩放 + 关闭平滑
// image 可为整行帧序列（frames>1）或单帧图（frames=1）
// 锚点：水平居中，底边对齐 (x, y)
export function drawSprite(ctx, image, frame, frames, x, y, targetH, flip = 1, alpha = 1, scaleMul = 1) {
  if (!image) return;
  const fw = Math.floor(image.width / frames);
  const fh = image.height;
  const k = Math.max(1, Math.round((targetH * scaleMul) / fh)); // 整数倍
  const dw = fw * k, dh = fh * k;
  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip, 1);
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, frame * fw, 0, fw, fh, -dw / 2, -dh, dw, dh);
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = prevSmooth;
}
