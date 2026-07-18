// ———— 数学与随机 ————
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};
// 指数平滑（帧率无关的 lerp）
export const damp = (a, b, smooth, dt) => lerp(a, b, 1 - Math.exp(-smooth * dt));

// ———— 对象池 ————
// 固定容量池：alloc 返回复用对象，满时返回 null（调用方直接放弃生成）。
// 存活对象保存在 items[0..count)，release 用 swap-remove，遍历时倒序删除安全。
export class Pool {
  constructor(cap, factory) {
    this.cap = cap;
    this.items = new Array(cap);
    this.count = 0;
    for (let i = 0; i < cap; i++) this.items[i] = factory();
  }
  alloc() {
    if (this.count >= this.cap) return null;
    return this.items[this.count++];
  }
  // 释放 items[i]（i 必须 < count）
  releaseAt(i) {
    const it = this.items[i];
    this.count--;
    this.items[i] = this.items[this.count];
    this.items[this.count] = it;
  }
  clear() { this.count = 0; }
}

// ———— 空间哈希网格 ————
// 敌人每帧重建；查询圆形范围。禁止 O(n²)：子弹/玩家碰撞全部走这里。
export class SpatialHash {
  constructor(cellSize = 72) {
    this.cs = cellSize;
    this.map = new Map();
  }
  clear() { this.map.clear(); }
  key(cx, cy) { return cx * 100000 + cy; }
  insert(e) {
    const cx = Math.floor(e.x / this.cs), cy = Math.floor(e.y / this.cs);
    const k = this.key(cx, cy);
    let cell = this.map.get(k);
    if (!cell) { cell = []; this.map.set(k, cell); }
    cell.push(e);
  }
  // 对 (x,y,r) 覆盖的所有格子里的实体调用 cb；cb 返回 true 时提前终止
  query(x, y, r, cb) {
    const cs = this.cs;
    const x0 = Math.floor((x - r) / cs), x1 = Math.floor((x + r) / cs);
    const y0 = Math.floor((y - r) / cs), y1 = Math.floor((y + r) / cs);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = this.map.get(this.key(cx, cy));
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          if (cb(cell[i])) return;
        }
      }
    }
  }
}

// ———— 缓动 ————
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t) => { const c = 1.70158 * 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// 计时格式 mm:ss
export const fmtTime = (s) => {
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  return `${m < 10 ? '0' : ''}${m}:${ss < 10 ? '0' : ''}${ss}`;
};
