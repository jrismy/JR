import { Pool, rand, TAU, clamp, dist2, pick } from './utils.js';
import { C, WEAPONS, FORBIDDEN } from './data.js';
import * as vfx from './vfx.js';
import { enemies, damageEnemy, hurtPlayer } from './entities.js';
import { sfx } from './audio.js';

// ============================================================
// 子弹池（玩家）
// ============================================================
const makeBullet = () => ({
  x: 0, y: 0, vx: 0, vy: 0, dmg: 1, r: 6, life: 0,
  type: 'sword', pierce: 1, homing: 0, target: null,
  trail: [], gen: 0, gold: false, wob: 0,
});
export const bullets = new Pool(320, makeBullet);

// 敌方弹幕（天劫）
const makeEBullet = () => ({ x: 0, y: 0, vx: 0, vy: 0, dmg: 10, r: 7, life: 0, trail: [] });
export const eBullets = new Pool(160, makeEBullet);
export function spawnEnemyBulletRing(G, x, y, n, spd, dmg) {
  for (let i = 0; i < n; i++) {
    const b = eBullets.alloc();
    if (!b) return;
    const a = (i / n) * TAU;
    b.x = x; b.y = y;
    b.vx = Math.cos(a) * spd; b.vy = Math.sin(a) * spd;
    b.dmg = dmg; b.r = 7; b.life = 7;
    b.trail.length = 0;
  }
}

// 燃烧/霜华地面区域
const zones = []; // {x,y,r,t,maxT,type:'burn'|'frost',dps}
function addZone(x, y, r, t, type, dps = 0) {
  if (zones.length > 40) zones.shift();
  zones.push({ x, y, r, t, maxT: t, type, dps, tick: 0 });
}

// ============================================================
// 目标选择（线性扫描池，调用频率低）
// ============================================================
function nearestEnemy(x, y, maxD = 620, skip = null) {
  let best = null, bd = maxD * maxD;
  for (let i = 0; i < enemies.count; i++) {
    const e = enemies.items[i];
    if (e.dying > 0 || e.birth > 0.1 || e === skip) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function randomEnemy(x, y, maxD = 460) {
  const cands = [];
  for (let i = 0; i < enemies.count; i++) {
    const e = enemies.items[i];
    if (e.dying > 0 || e.birth > 0.1) continue;
    if (dist2(x, y, e.x, e.y) < maxD * maxD) { cands.push(e); if (cands.length > 40) break; }
  }
  return cands.length ? pick(cands) : null;
}

// 武器有效数值
function wstats(w) {
  const def = WEAPONS[w.id];
  const lv = w.lv - 1;
  const out = {};
  for (const k in def.base) {
    out[k] = def.base[k] + (def.perLv[k] || 0) * lv;
  }
  out.count = Math.max(1, Math.floor(def.base.count !== undefined ? def.base.count + (def.perLv.count || 0) * lv : 1));
  out.cd = Math.max(0.18, out.cd ?? 1);
  return out;
}

export function addWeapon(G, id) {
  const w = { id, lv: 1, timer: 0.3, evolved: false, angle: rand(TAU), tick: 0, state: null };
  G.player.weapons.push(w);
  return w;
}
export function applyForbidden(G, fid) {
  const f = FORBIDDEN[fid];
  const w = G.player.weapons.find((x) => x.id === f.weapon);
  if (!w) return;
  w.evolved = fid;
  if (fid === 'zhuxian') w.state = { burstT: 5, giants: [0, Math.PI / 2, Math.PI, Math.PI * 1.5] };
  if (fid === 'shenfa') w.state = { boltT: 0.4 };
  if (fid === 'huolong') {
    w.state = { seg: [], tick: 0 };
    for (let i = 0; i < 16; i++) w.state.seg.push({ x: G.player.x - i * 12, y: G.player.y });
    w.state.head = { x: G.player.x, y: G.player.y, a: 0 };
  }
  if (fid === 'bingfeng') w.state = { t: 2 };
}

// ============================================================
// 更新
// ============================================================
export function updateWeapons(G, dt) {
  const p = G.player;
  for (const w of p.weapons) {
    const s = wstats(w);
    const cd = s.cd * p.stats.cd;
    switch (w.id) {
      case 'sword': updateSword(G, w, s, cd, dt); break;
      case 'orbit': updateOrbit(G, w, s, dt); break;
      case 'thunder': updateThunder(G, w, s, cd, dt); break;
      case 'aura': updateAura(G, w, s, dt); break;
      case 'fire': updateFire(G, w, s, cd, dt); break;
      case 'ice': updateIce(G, w, s, cd, dt); break;
      case 'ghost': updateGhost(G, w, s, cd, dt); break;
    }
  }
  updateBullets(G, dt);
  updateEBullets(G, dt);
  updateZones(G, dt);
}

// ———— 1. 御剑术 ————
function fireSword(G, s, gold, fromA) {
  const p = G.player;
  const t = randomEnemy(p.x, p.y, 640) || nearestEnemy(p.x, p.y, 900);
  const b = bullets.alloc();
  if (!b) return;
  const a = fromA ?? (t ? Math.atan2(t.y - p.y, t.x - p.x) : rand(TAU));
  b.x = p.x; b.y = p.y - 6;
  b.vx = Math.cos(a) * s.speed; b.vy = Math.sin(a) * s.speed;
  b.dmg = s.dmg; b.r = 10; b.life = 2.2;
  b.type = 'sword'; b.pierce = s.pierce + (gold ? 1 : 0);
  b.homing = 5; b.target = t; b.gold = gold;
  b.rippleLv = s.lv || 1;
  b.trail.length = 0;
  sfx.sword();
}
function updateSword(G, w, s, cd, dt) {
  s.lv = w.lv;
  w.timer -= dt;
  if (w.timer <= 0) {
    w.timer = cd;
    const gold = w.lv >= 7;
    let count = s.count;
    if (w.evolved === 'zhuxian') count *= 2; // 齐射翻倍
    for (let i = 0; i < count; i++) fireSword(G, s, gold);
  }
  // 诛仙剑阵：巨剑绕体 + 八方剑爆
  if (w.evolved === 'zhuxian') {
    const st = w.state;
    w.angle += dt * 1.4;
    st.tickT = (st.tickT || 0) - dt;
    const p = G.player;
    if (st.tickT <= 0) {
      st.tickT = 0.25;
      for (const ga of st.giants) {
        const a = w.angle + ga;
        const bx = p.x + Math.cos(a) * 92, by = p.y + Math.sin(a) * 92;
        G.hash.query(bx, by, 34, (e) => {
          damageEnemy(G, e, s.dmg * 0.8, { kx: Math.cos(a) * 60, ky: Math.sin(a) * 60 });
          return false;
        });
      }
    }
    st.burstT -= dt;
    if (st.burstT <= 0) {
      st.burstT = 5;
      for (let i = 0; i < 8; i++) fireSword(G, s, true, (i / 8) * TAU);
      vfx.spawnWave(p.x, p.y, 150, C.gold, 0.5, 4, true);
      G.cam.shake(4);
      G.fx.gold = Math.max(G.fx.gold, 0.5);
    }
  }
}

// ———— 2. 剑气环身 ————
function updateOrbit(G, w, s, dt) {
  const p = G.player;
  w.angle += s.rotSpeed * dt;
  w.tick -= dt;
  const rings = w.evolved === 'wanjian' ? 3 : (w.lv >= 7 ? 2 : 1);
  if (w.tick <= 0) {
    w.tick = 0.22;
    for (let ring = 0; ring < rings; ring++) {
      const rr = s.radius + ring * 34;
      const dir = ring % 2 === 0 ? 1 : -1;
      const n = s.count + ring;
      for (let i = 0; i < n; i++) {
        const a = w.angle * dir + (i / n) * TAU;
        const bx = p.x + Math.cos(a) * rr, by = p.y + Math.sin(a) * rr;
        G.hash.query(bx, by, 26, (e) => {
          const killed = damageEnemy(G, e, s.dmg, { kx: Math.cos(a) * 40, ky: Math.sin(a) * 40 });
          if (w.lv >= 5) vfx.burst(bx, by, C.gold, 2, 90, 5, 0.3); // 转金火花
          if (w.evolved === 'wanjian') { e.slowT = 0.8; e.slowF = 0.55; }
          return false;
        });
      }
    }
  }
}

// ———— 3. 天雷引 ————
function strike(G, w, s, x, y, purple, big = false) {
  const col = purple ? C.jie : '#FFF6D8';
  vfx.spawnBolt(x, y, y - 420, col, big ? 5 : 3, big ? 4 : 2);
  vfx.spawnDecal(x, y, vfx.scorchSprite('rgba(8,10,12,0.8)', purple ? 'rgba(200,160,255,0.4)' : 'rgba(255,216,144,0.35)'), 1, 0.65, 0.04);
  if (w && w.lv >= 3) vfx.spawnWave(x, y, 55, col, 0.35, 3);
  vfx.burst(x, y, col, 6, 140, 7, 0.35);
  G.fx.aberr = 1; // 单帧色差
  G.cam.shake(big ? 6 : 3.5);
  sfx.thunder();
  // 溅射伤害
  G.hash.query(x, y, s.splash, (e) => {
    if (dist2(e.x, e.y, x, y) < s.splash * s.splash) damageEnemy(G, e, s.dmg);
    return false;
  });
}
function updateThunder(G, w, s, cd, dt) {
  const p = G.player;
  w.timer -= dt;
  if (w.timer <= 0) {
    w.timer = cd;
    const purple = w.lv >= 5;
    for (let i = 0; i < s.count; i++) {
      const t = randomEnemy(p.x, p.y, 430);
      const x = t ? t.x : p.x + rand(-260, 260);
      const y = t ? t.y : p.y + rand(-180, 180);
      strike(G, w, s, x, y, purple);
      // 7重雷链跳跃
      if (w.lv >= 7 && t) {
        let from = t;
        for (let j = 0; j < 2; j++) {
          const nx = nearestEnemy(from.x, from.y, 170, from);
          if (!nx) break;
          vfx.spawnBolt(nx.x, nx.y, from.y - 20, C.jie, 2, 1);
          damageEnemy(G, nx, s.dmg * 0.6);
          from = nx;
        }
      }
    }
  }
  // 九天神罚：雷云自动劫雷
  if (w.evolved === 'shenfa') {
    w.state.boltT -= dt;
    if (w.state.boltT <= 0) {
      w.state.boltT = 0.4;
      const t = randomEnemy(p.x, p.y, 480);
      if (t) strike(G, w, s, t.x, t.y, true);
    }
  }
}

// ———— 4. 护体罡气 ————
function updateAura(G, w, s, dt) {
  const p = G.player;
  w.angle += dt * 0.8;
  w.tick -= dt;
  const radius = s.radius * (w.evolved === 'hunyuan' ? 1.8 : 1);
  w.curRadius = radius;
  if (w.tick <= 0) {
    w.tick = 0.5;
    let killsHealed = 0;
    G.hash.query(p.x, p.y, radius, (e) => {
      if (dist2(e.x, e.y, p.x, p.y) < radius * radius) {
        const killed = damageEnemy(G, e, s.dmg);
        e.burnT = Math.max(e.burnT, 0.8);
        e.burnDps = s.dmg * 0.5;
        if (killed && w.evolved === 'hunyuan') killsHealed++;
      }
      return false;
    });
    if (killsHealed) {
      p.hp = Math.min(p.maxHp, p.hp + killsHealed * 2);
      vfx.spawnText(p.x, p.y - 20, `+${killsHealed * 2}`, C.ghost);
    }
    // 5重灼热荡波
    if (w.lv >= 5) vfx.spawnWave(p.x, p.y, radius, C.gold, 0.55, 2.5, true);
  }
}

// ———— 5. 三昧真火 ————
function updateFire(G, w, s, cd, dt) {
  const p = G.player;
  w.timer -= dt;
  if (w.state === null || typeof w.state !== 'object' || Array.isArray(w.state)) {
    // fire 的普通状态：activeT
    w.state = w.state && w.state.seg ? w.state : { activeT: 0, dmgTick: 0 };
  }
  if (w.evolved === 'huolong') { updateDragon(G, w, s, dt); return; }
  const st = w.state;
  if (w.timer <= 0) { w.timer = cd + s.duration; st.activeT = s.duration; }
  if (st.activeT > 0) {
    st.activeT -= dt;
    const aim = G.aimAngle;
    const cyan = w.lv >= 5;
    // 火焰粒子
    const col = cyan ? '#7FE8D8' : C.ember;
    const spr = vfx.glowSprite(col, 32);
    for (let i = 0; i < 3; i++) {
      const a = aim + rand(-s.arc / 2, s.arc / 2);
      const v = rand(180, 330);
      vfx.spawnP({
        x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14 - 4,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30,
        life: rand(0.3, 0.55), size0: rand(9, 16), size1: 3, drag: 1.5, sprite: spr,
      });
    }
    if (Math.random() < 0.4) vfx.smoke(p.x + Math.cos(aim) * 40, p.y + Math.sin(aim) * 40, 1);
    // 3重余烬坠地
    if (w.lv >= 3 && Math.random() < 0.25) {
      const a = aim + rand(-s.arc / 2, s.arc / 2);
      const d = rand(60, s.range);
      vfx.spawnP({
        x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d - 20,
        vx: rand(-15, 15), vy: rand(30, 70), grav: 120,
        life: 0.5, size0: 4, size1: 1, sprite: spr,
      });
    }
    // 伤害 tick
    st.dmgTick -= dt;
    if (st.dmgTick <= 0) {
      st.dmgTick = 0.12;
      G.hash.query(p.x, p.y, s.range, (e) => {
        const dx = e.x - p.x, dy = e.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < s.range) {
          let da = Math.atan2(dy, dx) - aim;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          if (Math.abs(da) < s.arc / 2) {
            const killed = damageEnemy(G, e, s.dmg);
            e.burnT = Math.max(e.burnT, 1.2);
            e.burnDps = s.dmg * 0.8;
            // 7重青莲焚地
            if (w.lv >= 7 && Math.random() < 0.1) {
              vfx.spawnDecal(e.x, e.y, vfx.lotusSprite(), 1, 0.85, 0.08);
              addZone(e.x, e.y, 46, 3, 'burn', s.dmg * 1.6);
            }
          }
        }
        return false;
      });
      sfx.fire();
    }
  }
}
// 焚世火龙：14+ 节蛇形身体正弦游动
function updateDragon(G, w, s, dt) {
  const st = w.state;
  const head = st.head;
  const t = nearestEnemy(head.x, head.y, 900) || { x: G.player.x + Math.cos(G.time) * 200, y: G.player.y + Math.sin(G.time) * 200 };
  const ta = Math.atan2(t.y - head.y, t.x - head.x);
  let da = ta - head.a;
  while (da > Math.PI) da -= TAU;
  while (da < -Math.PI) da += TAU;
  head.a += clamp(da, -2.6 * dt, 2.6 * dt) + Math.sin(G.time * 6) * 0.6 * dt;
  const spd = 330;
  head.x += Math.cos(head.a) * spd * dt;
  head.y += Math.sin(head.a) * spd * dt;
  // 身体跟随
  let prev = head;
  for (const seg of st.seg) {
    const dx = prev.x - seg.x, dy = prev.y - seg.y;
    const l = Math.hypot(dx, dy) || 1;
    if (l > 13) {
      seg.x += (dx / l) * (l - 13);
      seg.y += (dy / l) * (l - 13);
    }
    prev = seg;
  }
  // 沿途火星与灼痕
  if (Math.random() < 0.5) {
    const spr = vfx.glowSprite(C.ember, 32);
    vfx.spawnP({ x: head.x + rand(-8, 8), y: head.y + rand(-8, 8), vx: rand(-40, 40), vy: rand(-60, -10), life: 0.5, size0: 8, size1: 2, sprite: spr });
  }
  if (Math.random() < 0.06) vfx.spawnDecal(head.x, head.y, vfx.scorchSprite('rgba(30,14,8,0.6)'), 0.7, 0.4, 0.1);
  // 碰撞伤害
  st.tick -= dt;
  if (st.tick <= 0) {
    st.tick = 0.18;
    G.hash.query(head.x, head.y, 30, (e) => { damageEnemy(G, e, s.dmg * 2.2); return false; });
    for (let i = 0; i < st.seg.length; i += 3) {
      const seg = st.seg[i];
      G.hash.query(seg.x, seg.y, 22, (e) => { damageEnemy(G, e, s.dmg * 1.1); return false; });
    }
  }
}

// ———— 6. 寒冰诀 ————
function updateIce(G, w, s, cd, dt) {
  const p = G.player;
  w.timer -= dt;
  if (w.timer <= 0) {
    w.timer = cd;
    for (let i = 0; i < s.count; i++) {
      const t = randomEnemy(p.x, p.y, 560);
      const b = bullets.alloc();
      if (!b) break;
      const a = t ? Math.atan2(t.y - p.y, t.x - p.x) + rand(-0.08, 0.08) : rand(TAU);
      b.x = p.x; b.y = p.y;
      b.vx = Math.cos(a) * s.speed; b.vy = Math.sin(a) * s.speed;
      b.dmg = s.dmg; b.r = 8; b.life = 1.6;
      b.type = 'ice'; b.pierce = 2; b.homing = 0; b.target = null; b.gold = false;
      b.trail.length = 0;
      b.slow = s.slow; b.slowDur = s.slowDur;
      b.lv = w.lv;
    }
    sfx.ice();
  }
  // 冰封千里
  if (w.evolved === 'bingfeng') {
    w.state.t -= dt;
    if (w.state.t <= 0) {
      w.state.t = 9;
      G.fx.white = 0.85;
      sfx.freeze();
      G.timeCtl.stop(0.06);
      for (let i = 0; i < enemies.count; i++) {
        const e = enemies.items[i];
        if (e.dying > 0 || e.ai === 'trib') continue;
        e.frozen = Math.max(e.frozen, 2);
        damageEnemy(G, e, s.dmg * 1.5);
      }
      vfx.spawnWave(p.x, p.y, 460, C.ice, 0.8, 5, true);
    }
  }
}

// ———— 7. 幽冥鬼火 ————
function fireGhost(G, s, w, x, y, gen = 0) {
  const b = bullets.alloc();
  if (!b) return;
  const t = randomEnemy(x, y, 560);
  const a = t ? Math.atan2(t.y - y, t.x - x) : rand(TAU);
  b.x = x; b.y = y;
  b.vx = Math.cos(a) * s.speed; b.vy = Math.sin(a) * s.speed;
  b.dmg = s.dmg * (gen ? 0.6 : 1); b.r = 9; b.life = 3.2;
  b.type = 'ghost'; b.pierce = 1;
  b.homing = s.turn * (w.lv >= 7 ? 1.7 : 1);
  b.target = t; b.gen = gen; b.wob = rand(TAU);
  b.trail.length = 0;
  b.lv = w.lv; b.evolved = w.evolved;
  sfx.ghost();
}
function updateGhost(G, w, s, cd, dt) {
  const p = G.player;
  w.timer -= dt;
  if (w.timer <= 0) {
    w.timer = cd;
    let count = s.count;
    if (w.evolved === 'huangquan') count *= 2;
    for (let i = 0; i < count; i++) fireGhost(G, s, w, p.x, p.y - 8);
  }
}

// ============================================================
// 子弹更新与碰撞
// ============================================================
const TRAIL_LEN = { sword: 9, ghost: 8, ice: 0 };
function updateBullets(G, dt) {
  for (let i = bullets.count - 1; i >= 0; i--) {
    const b = bullets.items[i];
    b.life -= dt;
    if (b.life <= 0) { bullets.releaseAt(i); continue; }
    // 追踪
    if (b.homing > 0) {
      if (!b.target || b.target.dying > 0) b.target = nearestEnemy(b.x, b.y, 500);
      if (b.target) {
        const ta = Math.atan2(b.target.y - b.y, b.target.x - b.x);
        const ca = Math.atan2(b.vy, b.vx);
        let da = ta - ca;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        const na = ca + clamp(da, -b.homing * dt, b.homing * dt);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      }
    }
    // 鬼火正弦游动
    if (b.type === 'ghost') {
      b.wob += dt * 9;
      const ca = Math.atan2(b.vy, b.vx);
      const na = ca + Math.sin(b.wob) * 1.4 * dt;
      const sp = Math.hypot(b.vx, b.vy);
      b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    // 拖尾记录
    const tl = b.type === 'sword' ? 9 : b.type === 'ghost' && b.lv >= 3 ? 8 : 0;
    if (tl) {
      b.trail.unshift({ x: b.x, y: b.y });
      if (b.trail.length > tl) b.trail.length = tl;
    }
    // 碰撞
    let removed = false;
    G.hash.query(b.x, b.y, b.r + 30, (e) => {
      if (e.dying > 0 || e.birth > 0.1) return false;
      const rr = b.r + e.r;
      if (dist2(b.x, b.y, e.x, e.y) > rr * rr) return false;
      onBulletHit(G, b, e);
      b.pierce--;
      if (b.pierce <= 0) { bullets.releaseAt(i); removed = true; return true; }
      return false;
    });
    if (removed) continue;
  }
}
function onBulletHit(G, b, e) {
  const a = Math.atan2(b.vy, b.vx);
  if (b.type === 'sword') {
    damageEnemy(G, e, b.dmg, { kx: Math.cos(a) * 90, ky: Math.sin(a) * 90 });
    vfx.spawnSlash(e.x, e.y, b.gold ? C.gold : C.rice, b.gold ? 1.25 : 1); // 月牙斩痕
    vfx.burst(e.x, e.y, b.gold ? C.gold : C.rice, 4, 130, 6, 0.3);       // 火花
    if (b.rippleLv >= 5) vfx.spawnWave(e.x, e.y, 40, C.jian, 0.3, 2);    // 5重命中涟漪
  } else if (b.type === 'ice') {
    damageEnemy(G, e, b.dmg);
    e.slowT = b.slowDur; e.slowF = 1 - b.slow;
    if (b.lv >= 3) { // 碎冰溅射
      vfx.burst(e.x, e.y, C.ice, 5, 110, 6, 0.35);
      G.hash.query(e.x, e.y, 50, (o) => { if (o !== e) damageEnemy(G, o, b.dmg * 0.4); return false; });
    }
    if (b.lv >= 5 && Math.random() < 0.2) e.frozen = 1.2; // 概率冻结
    if (b.lv >= 7) addZone(e.x, e.y, 56, 2.5, 'frost', 0); // 霜华减速圈
  } else if (b.type === 'ghost') {
    damageEnemy(G, e, b.dmg);
    vfx.burst(e.x, e.y, C.ghost, 5, 100, 7, 0.4);
    const canSplit = (b.lv >= 5 || b.evolved === 'huangquan') && b.gen === 0;
    if (canSplit && (b.evolved === 'huangquan' || Math.random() < 0.6)) {
      vfx.spawnWave(e.x, e.y, 40, C.ghost, 0.35, 2); // 幽绿波纹
      for (let k = 0; k < 2; k++) fireGhost(G, { speed: 260, dmg: b.dmg, turn: 3.4, count: 1 }, { lv: b.lv, evolved: b.evolved }, e.x, e.y, 1);
    }
  }
}
function updateEBullets(G, dt) {
  const p = G.player;
  for (let i = eBullets.count - 1; i >= 0; i--) {
    const b = eBullets.items[i];
    b.life -= dt;
    if (b.life <= 0) { eBullets.releaseAt(i); continue; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.trail.unshift({ x: b.x, y: b.y });
    if (b.trail.length > 6) b.trail.length = 6;
    const rr = b.r + p.r;
    if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
      hurtPlayer(G, b.dmg, b.x, b.y);
      eBullets.releaseAt(i);
    }
  }
}
function updateZones(G, dt) {
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    z.t -= dt;
    if (z.t <= 0) { zones.splice(i, 1); continue; }
    z.tick -= dt;
    if (z.tick <= 0) {
      z.tick = 0.35;
      G.hash.query(z.x, z.y, z.r, (e) => {
        if (dist2(e.x, e.y, z.x, z.y) < z.r * z.r) {
          if (z.type === 'burn') damageEnemy(G, e, z.dps * 0.35);
          else { e.slowT = 0.6; e.slowF = 0.5; }
        }
        return false;
      });
      if (z.type === 'burn') vfx.burst(z.x + rand(-z.r, z.r) * 0.6, z.y + rand(-z.r, z.r) * 0.6, '#7FE8D8', 1, 40, 6, 0.4);
    }
  }
}

// ============================================================
// 绘制
// ============================================================
export function drawWeapons(rc, G) {
  const { ent, glow } = rc;
  const p = G.player;
  const time = G.time;
  for (const w of p.weapons) {
    const s = wstats(w);
    if (w.id === 'orbit') drawOrbit(rc, G, w, s);
    if (w.id === 'aura') drawAura(rc, G, w, s);
    if (w.id === 'sword' && w.evolved === 'zhuxian') drawGiantSwords(rc, G, w);
    if (w.id === 'thunder' && w.evolved === 'shenfa') drawCloud(rc, G, w);
    if (w.id === 'fire' && w.evolved === 'huolong') drawDragon(rc, G, w);
  }
  drawZones(rc, G);
  drawBullets(rc, G);
}
function drawOrbit(rc, G, w, s) {
  const { glow } = rc;
  const p = G.player;
  const rings = w.evolved === 'wanjian' ? 3 : (w.lv >= 7 ? 2 : 1);
  const spr = vfx.swordSprite(w.lv >= 5 ? C.gold : C.jian, w.lv >= 5);
  for (let ring = 0; ring < rings; ring++) {
    const rr = s.radius + ring * 34;
    const dir = ring % 2 === 0 ? 1 : -1;
    const n = s.count + ring;
    const size = w.evolved === 'wanjian' ? 1.5 : 1;
    for (let i = 0; i < n; i++) {
      const a = w.angle * dir + (i / n) * TAU;
      const bx = p.x + Math.cos(a) * rr, by = p.y + Math.sin(a) * rr;
      // 残影（3重+）
      if (w.lv >= 3) {
        drawSwordAt(glow, spr, p.x + Math.cos(a - 0.22 * dir) * rr, p.y + Math.sin(a - 0.22 * dir) * rr, a - 0.22 * dir + Math.PI / 2 * dir, 0.3, size);
      }
      drawSwordAt(glow, spr, bx, by, a + Math.PI / 2 * dir, 0.95, size);
    }
  }
}
function drawSwordAt(ctx, spr, x, y, rot, alpha, size = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  ctx.drawImage(spr, -24 * size, -7 * size, 48 * size, 14 * size);
  ctx.restore();
  ctx.globalAlpha = 1;
}
function drawAura(rc, G, w, s) {
  const { ent, glow } = rc;
  const p = G.player;
  const radius = w.curRadius || s.radius;
  const pulse = 0.75 + Math.sin(G.time * 2.4) * 0.25; // 呼吸脉动
  // 罡气边缘
  glow.globalAlpha = 0.35 * pulse;
  glow.strokeStyle = C.gold;
  glow.lineWidth = 2;
  glow.beginPath();
  glow.arc(p.x, p.y, radius, 0, TAU);
  glow.stroke();
  glow.globalAlpha = 0.12 * pulse;
  const gspr = vfx.glowSprite(C.gold, 128);
  glow.drawImage(gspr, p.x - radius, p.y - radius, radius * 2, radius * 2);
  glow.globalAlpha = 1;
  // 八卦符文环（3重+）
  if (w.lv >= 3) {
    const bag = vfx.baguaSprite(Math.round(radius * 0.8), 'rgba(255,216,144,0.8)');
    ent.save();
    ent.translate(p.x, p.y);
    ent.rotate(w.angle);
    ent.globalAlpha = 0.6;
    ent.drawImage(bag, -bag.width / 2, -bag.height / 2);
    ent.restore();
    ent.globalAlpha = 1;
  }
  // 太极虚影（7重+ / 混元道场巨型）双层反向
  if (w.lv >= 7 || w.evolved === 'hunyuan') {
    const tj = vfx.taijiSprite(Math.round(radius * (w.evolved === 'hunyuan' ? 0.95 : 0.55)));
    ent.save();
    ent.translate(p.x, p.y);
    ent.rotate(-w.angle * 1.6);
    ent.globalAlpha = 0.3;
    ent.drawImage(tj, -tj.width / 2, -tj.height / 2);
    ent.restore();
    ent.globalAlpha = 1;
  }
}
function drawGiantSwords(rc, G, w) {
  const { glow } = rc;
  const p = G.player;
  const spr = vfx.swordSprite(C.gold, true);
  for (const ga of w.state.giants) {
    const a = w.angle + ga;
    const bx = p.x + Math.cos(a) * 92, by = p.y + Math.sin(a) * 92;
    drawSwordAt(glow, spr, bx, by, a + Math.PI / 2, 1, 2.2);
    const gs = vfx.glowSprite(C.gold, 32);
    glow.globalAlpha = 0.5;
    glow.drawImage(gs, bx - 20, by - 20, 40, 40);
    glow.globalAlpha = 1;
  }
}
function drawCloud(rc, G, w) {
  const { ent, glow } = rc;
  const p = G.player;
  const cy = p.y - 110;
  ent.globalAlpha = 0.75;
  for (let i = 0; i < 4; i++) {
    const ox = Math.sin(G.time * 0.9 + i * 2) * 12;
    ent.beginPath();
    ent.arc(p.x - 36 + i * 24 + ox, cy + Math.sin(i * 2.4) * 6, 20, 0, TAU);
    ent.fillStyle = '#141A22';
    ent.fill();
  }
  ent.globalAlpha = 1;
  glow.globalAlpha = 0.3 + Math.sin(G.time * 13) * 0.15;
  const gs = vfx.glowSprite(C.jie, 64);
  glow.drawImage(gs, p.x - 55, cy - 26, 110, 52);
  glow.globalAlpha = 1;
}
function drawDragon(rc, G, w) {
  const { glow } = rc;
  const st = w.state;
  if (!st || !st.head) return;
  const spr = vfx.glowSprite(C.ember, 64);
  // 身体明度从头到尾衰减
  for (let i = st.seg.length - 1; i >= 0; i--) {
    const seg = st.seg[i];
    const t = 1 - i / st.seg.length;
    const sz = 10 + t * 18;
    glow.globalAlpha = 0.2 + t * 0.5;
    glow.drawImage(spr, seg.x - sz, seg.y - sz, sz * 2, sz * 2);
  }
  // 头部大辉光 + 双目
  glow.globalAlpha = 1;
  glow.drawImage(spr, st.head.x - 30, st.head.y - 30, 60, 60);
  const eye = vfx.glowSprite('#FFF6D8', 16);
  const ea = st.head.a;
  for (const sgn of [-1, 1]) {
    const ex = st.head.x + Math.cos(ea + sgn * 0.5) * 12;
    const ey = st.head.y + Math.sin(ea + sgn * 0.5) * 12;
    glow.drawImage(eye, ex - 3, ey - 3, 6, 6);
  }
}
function drawZones(rc, G) {
  const { glow } = rc;
  for (const z of zones) {
    const a = Math.min(1, z.t / z.maxT + 0.3);
    if (z.type === 'frost') {
      glow.globalAlpha = 0.22 * a;
      const s = vfx.glowSprite(C.ice, 64);
      glow.drawImage(s, z.x - z.r, z.y - z.r, z.r * 2, z.r * 2);
      glow.globalAlpha = 0.5 * a;
      glow.strokeStyle = C.ice;
      glow.lineWidth = 1.5;
      glow.beginPath();
      glow.arc(z.x, z.y, z.r, 0, TAU);
      glow.stroke();
    } else {
      glow.globalAlpha = 0.16 * a;
      const s = vfx.glowSprite('#7FE8D8', 64);
      glow.drawImage(s, z.x - z.r, z.y - z.r, z.r * 2, z.r * 2);
    }
  }
  glow.globalAlpha = 1;
}
function drawBullets(rc, G) {
  const { ent, glow } = rc;
  const cam = G.cam, w = innerWidth, h = innerHeight;
  for (let i = 0; i < bullets.count; i++) {
    const b = bullets.items[i];
    if (!cam.inView(b.x, b.y, w, h, 40)) continue;
    const a = Math.atan2(b.vy, b.vx);
    if (b.type === 'sword') {
      // 拖尾条带：金剑拖金虹
      if (b.trail.length > 2) vfx.drawRibbon(glow, b.trail, 5, b.gold ? 'rgba(255,216,144,0.8)' : 'rgba(210,225,235,0.55)');
      const spr = vfx.swordSprite(b.gold ? C.gold : C.rice, b.gold);
      drawSwordAt(b.gold ? glow : ent, spr, b.x, b.y, a, 1, b.gold ? 1.2 : 1);
      if (b.gold) { // 7重淬金入辉光层
        const gs = vfx.glowSprite(C.gold, 32);
        glow.globalAlpha = 0.5;
        glow.drawImage(gs, b.x - 14, b.y - 14, 28, 28);
        glow.globalAlpha = 1;
      }
    } else if (b.type === 'ice') {
      ent.save();
      ent.translate(b.x, b.y);
      ent.rotate(a);
      ent.drawImage(vfx.shardSprite(), -17, -7);
      ent.restore();
      const gs = vfx.glowSprite(C.ice, 32);
      glow.globalAlpha = 0.4;
      glow.drawImage(gs, b.x - 12, b.y - 12, 24, 24);
      glow.globalAlpha = 1;
    } else if (b.type === 'ghost') {
      // 鬼火拖幽绿冥焰
      if (b.trail.length > 2) vfx.drawRibbon(glow, b.trail, 6, 'rgba(127,224,152,0.6)');
      const gs = vfx.glowSprite(C.ghost, 32);
      const sz = b.gen ? 16 : 22;
      glow.drawImage(gs, b.x - sz / 2, b.y - sz / 2, sz, sz);
      // 两点小眼睛
      ent.fillStyle = '#0D1216';
      ent.fillRect(b.x - 4, b.y - 3, 2.5, 3.5);
      ent.fillRect(b.x + 1.5, b.y - 3, 2.5, 3.5);
    }
  }
  // 敌方弹幕：发光紫珠带拖尾
  const pb = vfx.glowSprite(C.jie, 32);
  for (let i = 0; i < eBullets.count; i++) {
    const b = eBullets.items[i];
    if (!cam.inView(b.x, b.y, w, h, 30)) continue;
    if (b.trail.length > 2) vfx.drawRibbon(glow, b.trail, 4, 'rgba(200,160,255,0.5)');
    glow.drawImage(pb, b.x - 10, b.y - 10, 20, 20);
  }
}

export function clearWeapons() {
  bullets.clear();
  eBullets.clear();
  zones.length = 0;
}
