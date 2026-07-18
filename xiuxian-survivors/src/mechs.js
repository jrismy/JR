import { rand, TAU, dist2, clamp } from './utils.js';
import { C } from './data.js';
import * as vfx from './vfx.js';
import { enemies, damageEnemy } from './entities.js';
import { sfx } from './audio.js';

// ============================================================
// 神通：跨大境界永久觉醒的被动能力
// p.powers[key] = 状态对象
// ============================================================
export function grantPower(G, key) {
  const p = G.player;
  switch (key) {
    case 'shield': p.powers.shield = { t: 0 }; break;
    case 'nova': p.powers.nova = { t: 3 }; break;
    case 'avatar': p.powers.avatar = { a: 0, shootT: 0 }; break;
    case 'field': p.powers.field = { }; break;
    case 'swordrain': p.powers.swordrain = { t: 2 }; break;
    case 'unity': p.powers.unity = true; break;
    case 'chainthunder': p.powers.chainthunder = { t: 2 }; break;
    case 'undying': p.powers.undying = { available: true }; break;
    case 'immortal': p.powers.immortal = true; break;
  }
}

export function updatePowers(G, dt) {
  const p = G.player;
  const pw = p.powers;
  // 筑基·灵气护盾：10秒一层抵一击
  if (pw.shield) {
    pw.shield.t -= dt;
    if (pw.shield.t <= 0 && p.shield < 1) {
      p.shield = 1;
      pw.shield.t = 10;
      vfx.spawnWave(p.x, p.y, 40, C.jian, 0.4, 2);
    }
    if (p.shield < 1 && pw.shield.t <= 0) pw.shield.t = 10;
    if (p.shield >= 1 && pw.shield.t <= 0) pw.shield.t = 10;
  }
  // 金丹·金丹震爆：8秒冲击波+击退
  if (pw.nova) {
    pw.nova.t -= dt;
    if (pw.nova.t <= 0) {
      pw.nova.t = 8;
      const R = 190;
      vfx.spawnWave(p.x, p.y, R, C.gold, 0.55, 5, true);
      vfx.burst(p.x, p.y, C.gold, 16, 240, 8, 0.5);
      G.cam.kickZoom(0.04); // 缩放冲击
      G.cam.shake(5);
      sfx.nova();
      G.hash.query(p.x, p.y, R, (e) => {
        if (dist2(e.x, e.y, p.x, p.y) < R * R) {
          const dx = e.x - p.x, dy = e.y - p.y;
          const l = Math.hypot(dx, dy) || 1;
          damageEnemy(G, e, 22, { kx: (dx / l) * 420, ky: (dy / l) * 420 });
        }
        return false;
      });
    }
  }
  // 元婴·元婴出窍：绕体元婴自动射神念弹
  if (pw.avatar) {
    pw.avatar.a += dt * 2.2;
    pw.avatar.shootT -= dt;
    if (pw.avatar.shootT <= 0) {
      pw.avatar.shootT = 0.9;
      const ax = p.x + Math.cos(pw.avatar.a) * 42;
      const ay = p.y + Math.sin(pw.avatar.a) * 42;
      // 找目标直接闪电式命中（神念弹：细金线）
      let best = null, bd = 420 * 420;
      for (let i = 0; i < enemies.count; i++) {
        const e = enemies.items[i];
        if (e.dying > 0 || e.birth > 0.1) continue;
        const d = dist2(ax, ay, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        damageEnemy(G, best, 14);
        vfx.burst(best.x, best.y, C.gold, 3, 90, 5, 0.3);
        // 神念弹迹线
        const bolt = vfx.spawnBolt(best.x, best.y, ay, 'rgba(255,232,180,0.9)', 1.5, 0);
      }
    }
  }
  // 炼虚·虚空剑雨：5秒一轮
  if (pw.swordrain) {
    pw.swordrain.t -= dt;
    if (pw.swordrain.t <= 0) {
      pw.swordrain.t = 5;
      let n = 0;
      for (let i = 0; i < enemies.count && n < 10; i++) {
        const e = enemies.items[i];
        if (e.dying > 0 || e.birth > 0.1) continue;
        if (dist2(e.x, e.y, p.x, p.y) > 500 * 500) continue;
        n++;
        // 剑从天降：斩痕+粒子+伤害
        vfx.spawnSlash(e.x, e.y, C.rice, 1.1);
        vfx.spawnP({
          x: e.x + rand(-4, 4), y: e.y - 160, vx: 0, vy: 900,
          life: 0.18, size0: 26, size1 : 26,
          sprite: vfx.swordSprite(C.rice, false), rot: Math.PI / 2,
        });
        damageEnemy(G, e, 26);
      }
      if (n) sfx.sword();
    }
  }
  // 大乘·雷劫缠身：4.5秒6跳链电
  if (pw.chainthunder) {
    pw.chainthunder.t -= dt;
    if (pw.chainthunder.t <= 0) {
      pw.chainthunder.t = 4.5;
      let from = { x: p.x, y: p.y };
      let cur = null;
      const hitSet = new Set();
      for (let j = 0; j < 6; j++) {
        let best = null, bd = 240 * 240;
        for (let i = 0; i < enemies.count; i++) {
          const e = enemies.items[i];
          if (e.dying > 0 || e.birth > 0.1 || hitSet.has(e)) continue;
          const d = dist2(from.x, from.y, e.x, e.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (!best) break;
        hitSet.add(best);
        vfx.spawnBolt(best.x, best.y, from.y - 14, C.jie, 2.5, 1);
        damageEnemy(G, best, 30);
        from = best;
      }
      if (hitSet.size) { sfx.thunder(); G.fx.aberr = 0.7; }
    }
  }
}

export function drawPowers(rc, G) {
  const { ent, glow } = rc;
  const p = G.player;
  const pw = p.powers;
  // 元婴：小金人绕体
  if (pw.avatar) {
    const ax = p.x + Math.cos(pw.avatar.a) * 42;
    const ay = p.y + Math.sin(pw.avatar.a) * 42 - 6 + Math.sin(G.time * 5) * 3;
    const gs = vfx.glowSprite(C.gold, 32);
    glow.globalAlpha = 0.75;
    glow.drawImage(gs, ax - 12, ay - 12, 24, 24);
    glow.globalAlpha = 1;
    ent.save();
    ent.translate(ax, ay);
    ent.fillStyle = '#FFEAB8';
    // 小盘坐人形
    ent.beginPath(); ent.arc(0, -4, 2.6, 0, TAU); ent.fill();     // 头
    ent.beginPath(); ent.ellipse(0, 1.5, 3.6, 3, 0, 0, TAU); ent.fill(); // 身
    ent.restore();
  }
  // 化神·神念领域：淡青大圈
  if (pw.field) {
    glow.globalAlpha = 0.10 + Math.sin(G.time * 1.8) * 0.04;
    const s = vfx.glowSprite(C.jian, 128);
    glow.drawImage(s, p.x - 260, p.y - 260, 520, 520);
    glow.globalAlpha = 0.3;
    glow.strokeStyle = C.jian;
    glow.lineWidth = 1;
    glow.beginPath();
    glow.arc(p.x, p.y, 260, 0, TAU);
    glow.stroke();
    glow.globalAlpha = 1;
  }
  // 合体·天人合一：周身金光粒子
  if (pw.unity && Math.random() < 0.3) {
    const spr = vfx.glowSprite(C.gold, 24);
    vfx.spawnP({
      x: p.x + rand(-14, 14), y: p.y + rand(-6, 14),
      vx: rand(-8, 8), vy: rand(-55, -30),
      life: rand(0.5, 0.9), size0: rand(3, 6), size1: 0, sprite: spr,
    });
  }
  // 真仙：更盛
  if (pw.immortal && Math.random() < 0.5) {
    const spr = vfx.glowSprite('#FFF2CE', 24);
    vfx.spawnP({
      x: p.x + rand(-18, 18), y: p.y + rand(-8, 16),
      vx: rand(-10, 10), vy: rand(-75, -40),
      life: rand(0.6, 1.1), size0: rand(3, 7), size1: 0, sprite: spr,
    });
  }
}
