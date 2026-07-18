import { C, QUALITY } from './data.js';
import { rand, TAU, lerp, clamp } from './utils.js';
import { glowSprite, drawDecals } from './vfx.js';

// ============================================================
// 分层离屏渲染管线
//   L0 env    远景：视差水墨山峦 + 漂移雾带
//   L1 ground 地面：笔触网格 + 持久痕迹（vfx.decals）
//   L2 ent    实体：敌人/玩家/子弹（普通混合粒子也在此）
//   L3 glow   辉光：lighter 叠加，0.5x 分辨率渲染后放大 —— 仙气来源
//   L4 post   后期：暗层光照、色调分级、暗角、闪光、色差
// ============================================================

let main = null, mctx = null;
let envC, envX, groundC, groundX, entC, entX, glowC, glowX, darkC, darkX;
let W = 0, H = 0, dpr = 1;
let glowScale = QUALITY[0].glowScale;
let envLayers = QUALITY[0].envLayers;
let fogCount = QUALITY[0].fogCount;

let mountains = []; // 预烘焙山峦条带
let vignette = null;
let skyGrad = null; // 天际微光渐变（resize 时重建，避免每帧新建渐变）
let fogs = [];      // 雾带 {x,y,w,h,vx,alpha}
let brushSpr = null;

export function setQualityTier(tier) {
  const q = QUALITY[tier];
  glowScale = q.glowScale;
  envLayers = q.envLayers;
  fogCount = q.fogCount;
  sizeGlow();
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  return c;
}

// ———— 预烘焙：山峦剪影条带 ————
function bakeMountain(color, peakH, jag) {
  const w = 1400, h = 340;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  let y = h - peakH * rand(0.4, 0.8);
  ctx.lineTo(0, y);
  for (let x = 0; x <= w; x += 46) {
    y = clamp(y + rand(-jag, jag), h - peakH, h - 24);
    // 用二次曲线让山脊有笔锋起伏
    ctx.quadraticCurveTo(x - 23, y + rand(-14, 14), x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  // 山顶淡淡的一层"墨韵"
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(232,226,208,0.07)');
  g.addColorStop(0.5, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return c;
}
// 笔触点（地面网格用）
function bakeBrush() {
  const c = makeCanvas(28, 10);
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(232,226,208,1)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(3, 6); ctx.quadraticCurveTo(14, 3, 25, 5);
  ctx.stroke();
  return c;
}
function bakeVignette() {
  const c = makeCanvas(Math.ceil(W * dpr / 2), Math.ceil(H * dpr / 2));
  const ctx = c.getContext('2d');
  const cw = c.width, ch = c.height;
  const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.34, cw / 2, ch / 2, Math.max(cw, ch) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(2,4,6,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);
  return c;
}

function sizeGlow() {
  if (!glowC) return;
  glowC.width = Math.ceil(W * dpr * glowScale);
  glowC.height = Math.ceil(H * dpr * glowScale);
}

export function initRender(canvas) {
  main = canvas;
  mctx = main.getContext('2d');
  envC = makeCanvas(1, 1); envX = envC.getContext('2d');
  groundC = makeCanvas(1, 1); groundX = groundC.getContext('2d');
  entC = makeCanvas(1, 1); entX = entC.getContext('2d');
  glowC = makeCanvas(1, 1); glowX = glowC.getContext('2d');
  darkC = makeCanvas(1, 1); darkX = darkC.getContext('2d');

  mountains = [
    bakeMountain('#141B22', 210, 60),
    bakeMountain('#1A222B', 150, 44),
    bakeMountain('#20293380', 110, 34),
  ];
  brushSpr = bakeBrush();

  resize();
  addEventListener('resize', resize);

  // 雾带初始化（世界坐标附近随机）
  fogs = [];
  for (let i = 0; i < 8; i++) {
    fogs.push({
      x: rand(-900, 900), y: rand(-600, 600),
      w: rand(340, 720), h: rand(60, 130),
      vx: rand(4, 14) * (Math.random() < 0.5 ? -1 : 1),
      alpha: rand(0.025, 0.06),
    });
  }
}

export function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1); // dpr 上限 2
  W = innerWidth; H = innerHeight;
  main.width = Math.ceil(W * dpr); main.height = Math.ceil(H * dpr);
  main.style.width = W + 'px'; main.style.height = H + 'px';
  for (const c of [envC, groundC, entC, darkC]) {
    c.width = main.width; c.height = main.height;
  }
  sizeGlow();
  vignette = bakeVignette();
  const tmp = document.createElement('canvas').getContext('2d');
  skyGrad = tmp.createLinearGradient(0, 0, 0, H * 0.55);
  skyGrad.addColorStop(0, 'rgba(35,48,60,0.5)');
  skyGrad.addColorStop(1, 'rgba(35,48,60,0)');
}

export const view = { get w() { return W; }, get h() { return H; } };

// ———— 帧开始：画 L0/L1，准备 L2/L3 的世界变换 ————
export function beginFrame(G) {
  const cam = G.cam;

  // L0 环境远景
  envX.setTransform(dpr, 0, 0, dpr, 0, 0);
  envX.fillStyle = C.ink;
  envX.fillRect(0, 0, W, H);
  // 天际微光（柔和渐变，无硬边）
  envX.fillStyle = skyGrad;
  envX.fillRect(0, 0, W, H * 0.55);
  const pars = [0.15, 0.35, 0.5].slice(0, envLayers);
  for (let li = 0; li < pars.length; li++) {
    const m = mountains[li];
    const par = pars[li];
    const baseY = H - m.height + 40 + li * 46 - cam.y * par * 0.3;
    let ox = (-cam.x * par) % m.width;
    if (ox > 0) ox -= m.width;
    for (let x = ox; x < W; x += m.width) {
      envX.drawImage(m, x, baseY);
    }
  }
  // 雾带（大椭圆低透明度缓慢漂移）
  const fogSpr = glowSprite('rgba(190,200,205,0.5)', 128);
  for (let i = 0; i < Math.min(fogCount, fogs.length); i++) {
    const f = fogs[i];
    f.x += f.vx * G.dtReal;
    // 以 0.5 视差映射到屏幕，超出则环绕
    let sx = (f.x - cam.x * 0.5) % (W + f.w * 2);
    if (sx < -f.w) sx += W + f.w * 2;
    const sy = ((f.y - cam.y * 0.5) % (H + 200) + H + 200) % (H + 200) - 100;
    envX.globalAlpha = f.alpha;
    envX.drawImage(fogSpr, sx - f.w / 2, sy - f.h / 2, f.w, f.h);
  }
  envX.globalAlpha = 1;

  // L1 地面：笔触网格（世界对齐）+ 痕迹
  groundX.setTransform(dpr, 0, 0, dpr, 0, 0);
  groundX.clearRect(0, 0, W, H);
  groundX.save();
  cam.applyTo(groundX, W, H);
  const cs = 96;
  const x0 = Math.floor((cam.x - W / 2 - 60) / cs) * cs;
  const x1 = cam.x + W / 2 + 60;
  const y0 = Math.floor((cam.y - H / 2 - 60) / cs) * cs;
  const y1 = cam.y + H / 2 + 60;
  for (let gy = y0; gy < y1; gy += cs) {
    for (let gx = x0; gx < x1; gx += cs) {
      // 每格确定性伪随机（网格哈希）：角度/透明度稳定不闪
      const hsh = ((gx * 73856093) ^ (gy * 19349663)) >>> 0;
      const a = (hsh % 1000) / 1000;
      if (a < 0.55) continue; // 稀疏
      groundX.globalAlpha = 0.05 + a * 0.05;
      groundX.save();
      groundX.translate(gx + (hsh % 47), gy + (hsh % 31));
      groundX.rotate(((hsh % 360) / 360) * TAU);
      groundX.drawImage(brushSpr, -14, -5);
      groundX.restore();
    }
  }
  groundX.globalAlpha = 1;
  drawDecals(groundX, cam, W, H);
  groundX.restore();

  // L2 实体层
  entX.setTransform(dpr, 0, 0, dpr, 0, 0);
  entX.clearRect(0, 0, W, H);
  entX.save();
  cam.applyTo(entX, W, H);

  // L3 辉光层（低分辨率 + lighter）
  const s = glowScale;
  glowX.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
  glowX.globalCompositeOperation = 'source-over';
  glowX.clearRect(0, 0, W, H);
  glowX.globalCompositeOperation = 'lighter';
  glowX.save();
  cam.applyTo(glowX, W, H);

  return { ent: entX, glow: glowX };
}

// ———— 帧结束：暗层光照 + 合成 + 后期 ————
export function endFrame(G) {
  const cam = G.cam;
  entX.restore();
  glowX.restore();

  // 暗层：夜色压住画面，光源以 destination-out 冲出光圈
  const darkAlpha = G.darkAlpha;
  darkX.setTransform(dpr, 0, 0, dpr, 0, 0);
  darkX.globalCompositeOperation = 'source-over';
  darkX.clearRect(0, 0, W, H);
  if (darkAlpha > 0.01) {
    darkX.fillStyle = `rgba(5,8,12,${darkAlpha})`;
    darkX.fillRect(0, 0, W, H);
    darkX.globalCompositeOperation = 'destination-out';
    const holeSpr = glowSprite('rgba(255,255,255,1)', 128);
    darkX.save();
    cam.applyTo(darkX, W, H);
    for (let i = 0; i < G.lights.length; i++) {
      const L = G.lights[i];
      if (!cam.inView(L.x, L.y, W, H, L.r)) continue;
      darkX.globalAlpha = L.a ?? 0.9;
      darkX.drawImage(holeSpr, L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    darkX.restore();
    darkX.globalAlpha = 1;
  }

  // ———— 合成到主画布 ————
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.globalCompositeOperation = 'source-over';
  mctx.imageSmoothingEnabled = true;
  mctx.drawImage(envC, 0, 0);
  mctx.drawImage(groundC, 0, 0);
  mctx.drawImage(entC, 0, 0);
  // 辉光放大叠加
  mctx.globalCompositeOperation = 'lighter';
  mctx.drawImage(glowC, 0, 0, main.width, main.height);
  // 单帧色差：雷击瞬间辉光层 RGB 偏移重画
  if (G.fx.aberr > 0.01) {
    const off = 2 * dpr * (G.fx.aberr);
    mctx.globalAlpha = 0.5 * G.fx.aberr;
    mctx.drawImage(glowC, off, 0, main.width, main.height);
    mctx.drawImage(glowC, -off, off * 0.5, main.width, main.height);
    mctx.globalAlpha = 1;
  }
  mctx.globalCompositeOperation = 'source-over';
  if (darkAlpha > 0.01) mctx.drawImage(darkC, 0, 0);

  // 色调分级（平滑插值后的当前色）
  const gr = G.grade;
  if (gr.a > 0.005) {
    mctx.globalCompositeOperation = 'overlay';
    mctx.globalAlpha = gr.a;
    mctx.fillStyle = `rgb(${gr.r | 0},${gr.g | 0},${gr.b | 0})`;
    mctx.fillRect(0, 0, main.width, main.height);
    mctx.globalAlpha = 1;
    mctx.globalCompositeOperation = 'source-over';
  }
  // 常驻柔和暗角
  mctx.drawImage(vignette, 0, 0, main.width, main.height);
  // 受击红闪
  if (G.fx.red > 0.01) {
    mctx.fillStyle = `rgba(199,60,54,${0.32 * G.fx.red})`;
    mctx.fillRect(0, 0, main.width, main.height);
  }
  // 事件金闪
  if (G.fx.gold > 0.01) {
    mctx.globalCompositeOperation = 'lighter';
    mctx.fillStyle = `rgba(255,216,144,${0.4 * G.fx.gold})`;
    mctx.fillRect(0, 0, main.width, main.height);
    mctx.globalCompositeOperation = 'source-over';
  }
  // 白闪（冰封/飞升渐白）
  if (G.fx.white > 0.01) {
    mctx.fillStyle = `rgba(245,248,250,${clamp(G.fx.white, 0, 1)})`;
    mctx.fillRect(0, 0, main.width, main.height);
  }
}

// 世界变换下往主画布上画（飘字等最顶层世界元素）
export function overlayWorld(G, drawFn) {
  mctx.save();
  mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  G.cam.applyTo(mctx, W, H);
  drawFn(mctx);
  mctx.restore();
}
