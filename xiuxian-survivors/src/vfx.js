import { Pool, rand, TAU, clamp } from './utils.js';
import { C, QUALITY } from './data.js';

// ============================================================
// 预烘焙贴图：启动时烘焙到小 canvas，运行时只 drawImage。
// 禁止每帧新建渐变。
// ============================================================
const bakeCache = new Map();
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
// 径向光斑（含多色多尺寸缓存）
export function glowSprite(color, size = 64) {
  const key = `g_${color}_${size}`;
  let c = bakeCache.get(key);
  if (c) return c;
  c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.25, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  bakeCache.set(key, c);
  return c;
}
// 实心软圆点
export function dotSprite(color, size = 16) {
  const key = `d_${color}_${size}`;
  let c = bakeCache.get(key);
  if (c) return c;
  c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.6, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  bakeCache.set(key, c);
  return c;
}
// 剑形（朝右）
export function swordSprite(color, gold = false) {
  const key = `s_${color}_${gold}`;
  let c = bakeCache.get(key);
  if (c) return c;
  const w = 48, h = 14;
  c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.translate(0, h / 2);
  // 剑身
  ctx.beginPath();
  ctx.moveTo(46, 0); ctx.lineTo(30, -3.6); ctx.lineTo(8, -2.2); ctx.lineTo(8, 2.2); ctx.lineTo(30, 3.6);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  // 高光脊线
  ctx.beginPath();
  ctx.moveTo(46, 0); ctx.lineTo(10, -0.7); ctx.lineTo(10, 0.7);
  ctx.closePath();
  ctx.fillStyle = gold ? '#FFF7DF' : '#FFFFFF';
  ctx.fill();
  // 剑格与柄
  ctx.fillStyle = gold ? C.gold : '#B8C4CC';
  ctx.fillRect(6, -5, 3, 10);
  ctx.fillRect(0, -1.4, 6, 2.8);
  bakeCache.set(key, c);
  return c;
}
// 冰棱（多边形晶体+高光棱线，朝右）
export function shardSprite() {
  let c = bakeCache.get('shard');
  if (c) return c;
  const w = 34, h = 14;
  c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.translate(0, h / 2);
  ctx.beginPath();
  ctx.moveTo(33, 0); ctx.lineTo(20, -6); ctx.lineTo(4, -3); ctx.lineTo(1, 0); ctx.lineTo(4, 3); ctx.lineTo(20, 6);
  ctx.closePath();
  ctx.fillStyle = 'rgba(188,232,240,0.9)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(33, 0); ctx.lineTo(6, -1);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  bakeCache.set('shard', c);
  return c;
}
// 月牙斩痕（弧形闪光）
export function crescentSprite(color) {
  const key = `cr_${color}`;
  let c = bakeCache.get(key);
  if (c) return c;
  const s = 72;
  c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.translate(s / 2, s / 2);
  ctx.beginPath();
  ctx.arc(0, 0, 28, -0.55 * Math.PI, 0.55 * Math.PI);
  ctx.arc(0, 0, 15, 0.55 * Math.PI, -0.55 * Math.PI, true);
  ctx.closePath();
  const g = ctx.createRadialGradient(0, 0, 12, 0, 0, 30);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.7, color);
  g.addColorStop(1, 'rgba(255,255,255,0.95)');
  ctx.fillStyle = g;
  ctx.fill();
  bakeCache.set(key, c);
  return c;
}
// 八瓣青莲декал
export function lotusSprite() {
  let c = bakeCache.get('lotus');
  if (c) return c;
  const s = 96;
  c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.translate(s / 2, s / 2);
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i / 8) * TAU);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(12, -14, 0, -40);
    ctx.quadraticCurveTo(-12, -14, 0, 0);
    ctx.fillStyle = 'rgba(120,220,190,0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,255,230,0.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, TAU);
  ctx.fillStyle = 'rgba(255,240,200,0.9)';
  ctx.fill();
  bakeCache.set('lotus', c);
  return c;
}
// 焦痕/灼印/冰迹（地面痕迹）
export function scorchSprite(color = 'rgba(0,0,0,0.55)', ring = null) {
  const key = `sc_${color}_${ring}`;
  let c = bakeCache.get(key);
  if (c) return c;
  const s = 72;
  c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.translate(s / 2, s / 2);
  // 不规则墨渍：多圆叠加
  for (let i = 0; i < 7; i++) {
    const a = rand(TAU), r = rand(6, 22);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * rand(0, 12), Math.sin(a) * rand(0, 12), r, 0, TAU);
    ctx.fillStyle = color;
    ctx.globalAlpha = rand(0.25, 0.6);
    ctx.fill();
  }
  if (ring) {
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, TAU);
    ctx.strokeStyle = ring;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  bakeCache.set(key, c);
  return c;
}
// 八卦符文环
export function baguaSprite(radius, color) {
  const key = `bg_${radius}_${color}`;
  let c = bakeCache.get(key);
  if (c) return c;
  const s = radius * 2 + 16;
  c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.translate(s / 2, s / 2);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, radius - 12, 0, TAU); ctx.globalAlpha = 0.4; ctx.stroke();
  // 八卦爻符
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i / 8) * TAU);
    ctx.translate(0, -radius + 6);
    const trigram = i; // 用位模式画三爻
    for (let j = 0; j < 3; j++) {
      const y = j * 3.4 - 3.4;
      ctx.lineWidth = 2;
      if ((trigram >> j) & 1) {
        ctx.beginPath(); ctx.moveTo(-5, y); ctx.lineTo(5, y); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(-5, y); ctx.lineTo(-1, y); ctx.moveTo(1, y); ctx.lineTo(5, y); ctx.stroke();
      }
    }
    ctx.restore();
  }
  bakeCache.set(key, c);
  return c;
}
// 太极虚影
export function taijiSprite(radius) {
  const key = `tj_${radius}`;
  let c = bakeCache.get(key);
  if (c) return c;
  const s = radius * 2 + 8;
  c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.translate(s / 2, s / 2);
  ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2); ctx.fillStyle = 'rgba(232,226,208,0.55)'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, radius, Math.PI / 2, -Math.PI / 2); ctx.fillStyle = 'rgba(20,26,32,0.65)'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, -radius / 2, radius / 2, 0, TAU); ctx.fillStyle = 'rgba(232,226,208,0.55)'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, radius / 2, radius / 2, 0, TAU); ctx.fillStyle = 'rgba(20,26,32,0.65)'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, -radius / 2, radius / 7, 0, TAU); ctx.fillStyle = 'rgba(20,26,32,0.8)'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, radius / 2, radius / 7, 0, TAU); ctx.fillStyle = 'rgba(232,226,208,0.7)'; ctx.fill();
  ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.strokeStyle = 'rgba(232,226,208,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  bakeCache.set(key, c);
  return c;
}

// ============================================================
// 粒子系统（对象池）
// ============================================================
const makeParticle = () => ({
  x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
  size0: 8, size1: 0, drag: 0, grav: 0,
  sprite: null, additive: true, rot: 0, vrot: 0, alpha: 1,
});
export const particles = new Pool(QUALITY[0].particleCap, makeParticle);
let particleCap = QUALITY[0].particleCap;
export function setParticleCap(cap) { particleCap = cap; }

export function spawnP(opts) {
  if (particles.count >= particleCap) return null;
  const p = particles.alloc();
  if (!p) return null;
  p.x = opts.x; p.y = opts.y;
  p.vx = opts.vx || 0; p.vy = opts.vy || 0;
  p.life = 0; p.maxLife = opts.life || 0.6;
  p.size0 = opts.size0 ?? 10; p.size1 = opts.size1 ?? 0;
  p.drag = opts.drag ?? 0; p.grav = opts.grav ?? 0;
  p.sprite = opts.sprite;
  p.additive = opts.additive !== false;
  p.rot = opts.rot || 0; p.vrot = opts.vrot || 0;
  p.alpha = opts.alpha ?? 1;
  return p;
}

// ———— 飘字 ————
const makeText = () => ({ x: 0, y: 0, vy: 0, life: 0, maxLife: 1, txt: '', color: C.rice, size: 13, crit: false });
export const floatTexts = new Pool(140, makeText);
export function spawnText(x, y, txt, color = C.rice, crit = false) {
  const t = floatTexts.alloc();
  if (!t) return;
  t.x = x + rand(-8, 8); t.y = y - 10;
  t.vy = -46;
  t.life = 0; t.maxLife = crit ? 0.9 : 0.65;
  t.txt = txt; t.color = color; t.crit = crit;
  t.size = crit ? 20 : 13;
}

// ———— 冲击环 ————
const makeWave = () => ({ x: 0, y: 0, r0: 0, r1: 100, life: 0, maxLife: 0.5, color: C.gold, width: 3, dbl: false });
export const waves = new Pool(60, makeWave);
export function spawnWave(x, y, r1, color = C.gold, maxLife = 0.5, width = 3, dbl = false, r0 = 0) {
  const w = waves.alloc();
  if (!w) return;
  w.x = x; w.y = y; w.r0 = r0; w.r1 = r1;
  w.life = 0; w.maxLife = maxLife;
  w.color = color; w.width = width; w.dbl = dbl;
}

// ———— 斩痕（旋转弧形闪光）————
const makeSlash = () => ({ x: 0, y: 0, rot: 0, vrot: 0, scale: 1, life: 0, maxLife: 0.15, sprite: null });
export const slashes = new Pool(50, makeSlash);
export function spawnSlash(x, y, color, scale = 1) {
  const s = slashes.alloc();
  if (!s) return;
  s.x = x; s.y = y;
  s.rot = rand(TAU); s.vrot = rand(-6, 6);
  s.scale = scale;
  s.life = 0; s.maxLife = 0.15;
  s.sprite = crescentSprite(color);
}

// ———— 雷电（递归分叉折线）————
const makeBolt = () => ({ pts: [], branches: [], life: 0, maxLife: 0.3, color: C.gold, width: 3 });
export const bolts = new Pool(24, makeBolt);
function jaggedLine(x0, y0, x1, y1, displace, pts) {
  pts.length = 0;
  const seg = 8;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const mid = Math.sin(t * Math.PI); // 中段偏移最大
    pts.push([
      x0 + (x1 - x0) * t + rand(-1, 1) * displace * mid,
      y0 + (y1 - y0) * t + rand(-1, 1) * displace * mid * 0.5,
    ]);
  }
}
export function spawnBolt(x, y, topY, color = '#FFF6D8', width = 3, branchCount = 2) {
  const b = bolts.alloc();
  if (!b) return;
  b.color = color; b.width = width;
  b.life = 0; b.maxLife = 0.3;
  jaggedLine(x + rand(-30, 30), topY, x, y, 26, b.pts);
  b.branches.length = 0;
  // 主干上分出 2–3 条支叉
  for (let i = 0; i < branchCount + (Math.random() < 0.5 ? 1 : 0); i++) {
    const start = b.pts[2 + ((Math.random() * (b.pts.length - 4)) | 0)];
    const br = [];
    jaggedLine(start[0], start[1], start[0] + rand(-70, 70), start[1] + rand(30, 90), 14, br);
    b.branches.push(br);
  }
  return b;
}

// ———— 地面痕迹层（持久,低频衰减）————
export const decals = [];
let decalCap = QUALITY[0].decalCap;
export function setDecalCap(cap) { decalCap = cap; while (decals.length > decalCap) decals.shift(); }
export function spawnDecal(x, y, sprite, scale = 1, alpha = 0.7, decay = 0.045) {
  if (decals.length >= decalCap) decals.shift();
  decals.push({ x, y, sprite, scale, rot: rand(TAU), alpha, decay });
}

// ———— 便捷发射器 ————
export function burst(x, y, color, n, spd = 120, size = 8, life = 0.5) {
  const spr = glowSprite(color, 32);
  for (let i = 0; i < n; i++) {
    const a = rand(TAU), v = rand(0.3, 1) * spd;
    spawnP({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * rand(0.6, 1.2), size0: size, size1: 0, drag: 2.5, sprite: spr });
  }
}
// 敌人死亡：墨滴（普通混合下坠）+ 灵光碎片（加法上飘）
export function inkDeath(x, y, r, tint) {
  const inkSpr = dotSprite('rgba(16,20,26,0.9)', 20);
  for (let i = 0; i < 5; i++) {
    const a = rand(TAU), v = rand(20, 80);
    spawnP({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: rand(0.4, 0.8), size0: r * rand(0.4, 0.8), size1: 0, grav: 130, additive: false, sprite: inkSpr });
  }
  const spr = glowSprite(tint || C.gold, 24);
  for (let i = 0; i < 6; i++) {
    spawnP({ x: x + rand(-r, r), y: y + rand(-r, r), vx: rand(-18, 18), vy: rand(-70, -30), life: rand(0.5, 1), size0: rand(3, 7), size1: 0, sprite: spr });
  }
}
// 灰烟（普通混合）
export function smoke(x, y, n = 2) {
  const spr = dotSprite('rgba(70,76,82,0.35)', 24);
  for (let i = 0; i < n; i++) {
    spawnP({ x: x + rand(-6, 6), y, vx: rand(-12, 12), vy: rand(-50, -25), life: rand(0.6, 1.1), size0: rand(6, 10), size1: 18, additive: false, sprite: spr });
  }
}

// ============================================================
// 更新与绘制
// ============================================================
export function updateVfx(dt) {
  for (let i = particles.count - 1; i >= 0; i--) {
    const p = particles.items[i];
    p.life += dt;
    if (p.life >= p.maxLife) { particles.releaseAt(i); continue; }
    if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; }
    p.vy += p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.vrot * dt;
  }
  for (let i = floatTexts.count - 1; i >= 0; i--) {
    const t = floatTexts.items[i];
    t.life += dt;
    if (t.life >= t.maxLife) { floatTexts.releaseAt(i); continue; }
    t.y += t.vy * dt;
    t.vy *= Math.exp(-3 * dt);
  }
  for (let i = waves.count - 1; i >= 0; i--) {
    const w = waves.items[i];
    w.life += dt;
    if (w.life >= w.maxLife) waves.releaseAt(i);
  }
  for (let i = slashes.count - 1; i >= 0; i--) {
    const s = slashes.items[i];
    s.life += dt;
    s.rot += s.vrot * dt;
    if (s.life >= s.maxLife) slashes.releaseAt(i);
  }
  for (let i = bolts.count - 1; i >= 0; i--) {
    const b = bolts.items[i];
    b.life += dt;
    if (b.life >= b.maxLife) bolts.releaseAt(i);
  }
  // 痕迹低频衰减
  for (let i = decals.length - 1; i >= 0; i--) {
    const d = decals[i];
    d.alpha -= d.decay * dt;
    if (d.alpha <= 0.02) decals.splice(i, 1);
  }
}

// 痕迹画进地面层（世界变换下调用）
export function drawDecals(ctx, cam, w, h) {
  for (let i = 0; i < decals.length; i++) {
    const d = decals[i];
    if (!cam.inView(d.x, d.y, w, h, 80)) continue;
    ctx.globalAlpha = Math.min(0.8, d.alpha);
    const s = d.sprite;
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.drawImage(s, -s.width * d.scale / 2, -s.height * d.scale / 2, s.width * d.scale, s.height * d.scale);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// 普通混合粒子（墨滴/灰烟）→ 实体层；加法粒子 → 辉光层
export function drawParticles(entCtx, glowCtx, cam, w, h) {
  for (let i = 0; i < particles.count; i++) {
    const p = particles.items[i];
    if (!cam.inView(p.x, p.y, w, h, 40)) continue;
    const t = p.life / p.maxLife;
    const size = p.size0 + (p.size1 - p.size0) * t;
    const alpha = p.alpha * (1 - t);
    const ctx = p.additive ? glowCtx : entCtx;
    ctx.globalAlpha = alpha;
    if (p.rot || p.vrot) {
      // 旋转粒子（冰片等）按原始宽高比绘制
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const ar = p.sprite.height / p.sprite.width;
      ctx.drawImage(p.sprite, -size / 2, -size * ar / 2, size, size * ar);
      ctx.restore();
    } else {
      ctx.drawImage(p.sprite, p.x - size / 2, p.y - size / 2, size, size);
    }
  }
  entCtx.globalAlpha = 1;
  glowCtx.globalAlpha = 1;
}

export function drawWavesAndSlashes(glowCtx, cam, w, h) {
  for (let i = 0; i < waves.count; i++) {
    const wv = waves.items[i];
    const t = wv.life / wv.maxLife;
    const r = wv.r0 + (wv.r1 - wv.r0) * (1 - Math.pow(1 - t, 3));
    glowCtx.globalAlpha = (1 - t) * 0.9;
    glowCtx.strokeStyle = wv.color;
    glowCtx.lineWidth = wv.width * (1 - t * 0.5);
    glowCtx.beginPath();
    glowCtx.arc(wv.x, wv.y, r, 0, TAU);
    glowCtx.stroke();
    if (wv.dbl) { // 双重扩散环：内实外虚
      glowCtx.globalAlpha = (1 - t) * 0.4;
      glowCtx.lineWidth = wv.width * 2.4;
      glowCtx.beginPath();
      glowCtx.arc(wv.x, wv.y, r * 1.18, 0, TAU);
      glowCtx.stroke();
    }
  }
  for (let i = 0; i < slashes.count; i++) {
    const s = slashes.items[i];
    const t = s.life / s.maxLife;
    glowCtx.globalAlpha = 1 - t;
    glowCtx.save();
    glowCtx.translate(s.x, s.y);
    glowCtx.rotate(s.rot);
    const sc = s.scale * (0.7 + t * 0.5);
    glowCtx.drawImage(s.sprite, -36 * sc, -36 * sc, 72 * sc, 72 * sc);
    glowCtx.restore();
  }
  glowCtx.globalAlpha = 1;
}

export function drawBolts(glowCtx) {
  for (let i = 0; i < bolts.count; i++) {
    const b = bolts.items[i];
    const t = b.life / b.maxLife;
    const a = 1 - t;
    // 外圈辉光
    glowCtx.globalAlpha = a * 0.5;
    glowCtx.strokeStyle = b.color;
    glowCtx.lineWidth = b.width * 3.2;
    strokePolyline(glowCtx, b.pts);
    for (const br of b.branches) { glowCtx.lineWidth = b.width * 1.8; strokePolyline(glowCtx, br); }
    // 白炽核心
    glowCtx.globalAlpha = a;
    glowCtx.strokeStyle = '#FFFFFF';
    glowCtx.lineWidth = b.width;
    strokePolyline(glowCtx, b.pts);
    glowCtx.lineWidth = b.width * 0.6;
    for (const br of b.branches) strokePolyline(glowCtx, br);
  }
  glowCtx.globalAlpha = 1;
}
function strokePolyline(ctx, pts) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

export function drawFloatTexts(ctx) {
  for (let i = 0; i < floatTexts.count; i++) {
    const t = floatTexts.items[i];
    const k = t.life / t.maxLife;
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    // 暴击金色放大弹跳缓动 scale 1.4→1
    let scale = 1;
    if (t.crit && k < 0.3) scale = 1.4 - (k / 0.3) * 0.4;
    ctx.font = `700 ${Math.round(t.size * scale)}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(t.txt, t.x + 1, t.y + 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.txt, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

// 拖尾条带：首宽尾窄、透明度渐隐的三角条带（不是圆点串）
// pts: [{x,y}...] 新点在前
export function drawRibbon(ctx, pts, width, color, alphaMul = 1) {
  const n = pts.length;
  if (n < 2) return;
  ctx.fillStyle = color;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1];
    const t0 = i / (n - 1), t1 = (i + 1) / (n - 1);
    let dx = p1.x - p0.x, dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const nx = -dy, ny = dx;
    const w0 = width * (1 - t0), w1 = width * (1 - t1);
    ctx.globalAlpha = alphaMul * (1 - t0) * 0.75;
    ctx.beginPath();
    ctx.moveTo(p0.x + nx * w0, p0.y + ny * w0);
    ctx.lineTo(p1.x + nx * w1, p1.y + ny * w1);
    ctx.lineTo(p1.x - nx * w1, p1.y - ny * w1);
    ctx.lineTo(p0.x - nx * w0, p0.y - ny * w0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function clearVfx() {
  particles.clear(); floatTexts.clear(); waves.clear(); slashes.clear(); bolts.clear();
  decals.length = 0;
}
