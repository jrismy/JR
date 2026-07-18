import { damp, rand, clamp } from './utils.js';

// 相机：平滑跟随 + 震屏(位移+微旋转,指数衰减) + 缩放冲击
export class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.zoom = 1;
    this.zoomKick = 0;      // 缩放冲击（金丹震爆等）
    this.shakeMag = 0;      // 震屏强度
    this.shakeX = 0; this.shakeY = 0; this.shakeRot = 0;
    this.enabled = true;    // 设置里可关闭震屏
  }
  follow(tx, ty, dt) {
    this.x = damp(this.x, tx, 6.5, dt);
    this.y = damp(this.y, ty, 6.5, dt);
  }
  shake(mag) { if (!this.enabled) return; this.shakeMag = Math.min(26, this.shakeMag + mag); }
  kickZoom(amount = 0.04) { this.zoomKick = Math.min(0.09, this.zoomKick + amount); }
  update(dt) {
    // 指数衰减
    this.shakeMag *= Math.exp(-7 * dt);
    if (this.shakeMag < 0.05) this.shakeMag = 0;
    this.shakeX = rand(-1, 1) * this.shakeMag;
    this.shakeY = rand(-1, 1) * this.shakeMag;
    this.shakeRot = rand(-1, 1) * this.shakeMag * 0.0022; // ±约1°上限
    this.zoomKick *= Math.exp(-5.5 * dt);
    this.zoom = 1 + this.zoomKick;
  }
  // 把世界变换应用到 ctx（假定已 setTransform 到 CSS 像素）
  applyTo(ctx, w, h) {
    ctx.translate(w / 2, h / 2);
    ctx.rotate(this.shakeRot);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x + this.shakeX, -this.y + this.shakeY);
  }
  // 世界坐标 → 屏幕坐标（供 UI 元素用，忽略旋转的微小影响）
  toScreen(wx, wy, w, h) {
    return {
      x: (wx - this.x + this.shakeX) * this.zoom + w / 2,
      y: (wy - this.y + this.shakeY) * this.zoom + h / 2,
    };
  }
  // 视口剔除判断（世界坐标 + 余量）
  inView(x, y, w, h, pad = 60) {
    const hw = w / 2 / this.zoom + pad, hh = h / 2 / this.zoom + pad;
    return x > this.x - hw && x < this.x + hw && y > this.y - hh && y < this.y + hh;
  }
}

// 统一 timeScale：顿帧、慢动作全走这里，所有 update 用 scaled dt
export class TimeCtl {
  constructor() {
    this.scale = 1;
    this.hitstop = 0;       // 顿帧剩余（真实秒）
    this.slowT = 0;         // 慢动作剩余
    this.slowScale = 1;
  }
  stop(sec) { this.hitstop = Math.max(this.hitstop, sec); }
  slow(scale, sec) { this.slowScale = scale; this.slowT = Math.max(this.slowT, sec); }
  update(dtReal) {
    if (this.hitstop > 0) {
      this.hitstop -= dtReal;
      this.scale = 0;
      return 0;
    }
    if (this.slowT > 0) {
      this.slowT -= dtReal;
      // 回弹：最后0.25秒平滑回到1
      const t = clamp(this.slowT / 0.25, 0, 1);
      this.scale = this.slowScale + (1 - this.slowScale) * (1 - t);
    } else {
      this.scale = 1;
    }
    return dtReal * this.scale;
  }
}
