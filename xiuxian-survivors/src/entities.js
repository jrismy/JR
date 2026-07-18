import { Pool, rand, TAU, clamp, dist2, pick, easeOutBack } from './utils.js';
import { C, ENEMY_TYPES, ENEMY_SCALE_PER_MIN, BOSS, BOSS_NAMES, TRIBULATION, PICKUP, REALMS, XP_INFLATION_PER_MIN } from './data.js';
import * as vfx from './vfx.js';
import * as A from './assets.js';
import { SHEET, REALM_LOOK, ENEMY_SKIN } from './appearance.js';
import { sfx } from './audio.js';

// ============================================================
// 玩家
// ============================================================
export function createPlayer(charDef) {
  const p = {
    x: 0, y: 0, r: 12,
    face: 1, moving: false, animT: 0,
    hp: 100, maxHp: 100,
    level: 1, xp: 0,
    realm: 0, realmSub: 1, // 大境界索引 / 层数(1-9)
    invuln: 0,
    transformT: 0, // 突破换装演出计时（0.7s：0.3 白光吞没 + 0.4 新装显现）
    charDef,
    weapons: [],   // {id, lv, timer, evolved, ...}
    passives: {},  // id -> lv
    powers: {},    // 神通状态（mechs.js 使用）
    stats: null,
    shield: 0,     // 灵气护盾层数
    usedRevive: false,
    magnetR: PICKUP.magnetBase,
    lightR: REALMS[0].light,
  };
  recalcStats(p);
  p.maxHp = p.stats.maxHp;
  p.hp = p.maxHp;
  return p;
}

// 汇总属性：基础 × 角色 × 心法 × 神通
export function recalcStats(p) {
  const m = p.charDef.mods;
  const s = {
    maxHp: 100 + (m.hp || 0),
    spd: 168 * (m.spd || 1),
    dmg: (m.dmg || 1),
    cd: (m.cd || 1),
    regen: (m.regen || 0),
    magnet: 1,
  };
  const P = p.passives;
  if (P.jinshen) s.maxHp += 25 * P.jinshen;
  if (P.tayun) s.spd *= 1 + 0.12 * P.tayun;
  if (P.guixi) s.regen += 1.5 * P.guixi;
  if (P.shenshi) s.magnet += 0.4 * P.shenshi;
  if (P.wudao) s.dmg *= 1 + 0.15 * P.wudao;
  if (P.lingxi) s.cd *= Math.pow(0.9, P.lingxi);
  // 神通：天人合一 / 仙威盖世
  if (p.powers.unity) { s.dmg *= 1.3; s.cd *= 0.8; }
  if (p.powers.immortal) { s.dmg *= 1.5; s.spd *= 1.15; s.maxHp *= 1.5; }
  // 道果累积（存在 p.stats 上的增量，迁移）
  if (p.stats) {
    s.dmg *= p.stats._fruitDmg || 1;
    s.cd *= p.stats._fruitCd || 1;
    s.spd *= p.stats._fruitSpd || 1;
    s.regen += p.stats._fruitRegen || 0;
    s.magnet += p.stats._fruitMagnet || 0;
    s.maxHp += p.stats._fruitHp || 0;
    s._fruitDmg = p.stats._fruitDmg || 1;
    s._fruitCd = p.stats._fruitCd || 1;
    s._fruitSpd = p.stats._fruitSpd || 1;
    s._fruitRegen = p.stats._fruitRegen || 0;
    s._fruitMagnet = p.stats._fruitMagnet || 0;
    s._fruitHp = p.stats._fruitHp || 0;
  } else {
    s._fruitDmg = 1; s._fruitCd = 1; s._fruitSpd = 1;
    s._fruitRegen = 0; s._fruitMagnet = 0; s._fruitHp = 0;
  }
  const hpRatio = p.stats ? p.hp / p.maxHp : 1;
  p.stats = s;
  p.maxHp = Math.round(s.maxHp);
  p.hp = clamp(Math.round(p.maxHp * hpRatio), 1, p.maxHp);
  p.magnetR = PICKUP.magnetBase * s.magnet;
  p.lightR = REALMS[p.realm].light;
}

export function hurtPlayer(G, dmg, fromX, fromY) {
  const p = G.player;
  if (p.invuln > 0 || G.state !== 'playing') return;
  if (p.shield > 0) {
    p.shield--;
    p.invuln = 0.6;
    vfx.spawnWave(p.x, p.y, 60, C.jian, 0.4, 3);
    sfx.ice();
    return;
  }
  p.hp -= dmg;
  p.invuln = 0.55;
  G.fx.red = 1;
  G.cam.shake(7);
  sfx.hurt();
  // 受击方向顿挫
  if (fromX !== undefined) {
    const dx = p.x - fromX, dy = p.y - fromY;
    const l = Math.hypot(dx, dy) || 1;
    p.x += (dx / l) * 14; p.y += (dy / l) * 14;
  }
  if (p.hp <= 0) G.onPlayerDeath();
}

// ============================================================
// 敌人（对象池 + 空间哈希）
// ============================================================
const makeEnemy = () => ({
  x: 0, y: 0, hp: 1, maxHp: 1, spd: 60, dmg: 5, r: 10, xp: 1,
  tier: 'normal', color: '#5E6E7A',
  birth: 0, dying: 0, flash: 0, frozen: 0, slowT: 0, slowF: 1,
  wobble: 0, contactCd: 0, burnT: 0, burnDps: 0,
  isBoss: false, name: '', vx: 0, vy: 0, kbx: 0, kby: 0,
  // 天劫化身专用
  ai: null, aiT: 0, dashT: 0, summonT: 0, ringT: 0,
});
export const enemies = new Pool(360, makeEnemy);

// 敌人身体贴图（按 tier 烘焙墨团）
const bodyCache = new Map();
function bodySprite(color, r, tier) {
  const key = `${color}_${r}_${tier}`;
  let c = bodyCache.get(key);
  if (c) return c;
  const s = r * 2 + 14;
  c = document.createElement('canvas');
  c.width = s; c.height = s;
  const ctx = c.getContext('2d');
  ctx.translate(s / 2, s / 2);
  // 不规则墨团：叠圆
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + rand(0.4);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.28, Math.sin(a) * r * 0.28, r * rand(0.72, 0.92), 0, TAU);
    ctx.fillStyle = '#10161C';
    ctx.globalAlpha = 0.85;
    ctx.fill();
  }
  // 色相轮廓
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.strokeStyle = color;
  ctx.lineWidth = tier === 'elite' || tier === 'boss' ? 2.2 : 1.4;
  ctx.stroke();
  if (tier === 'boss' || tier === 'trib') {
    // 妖王双角
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.95;
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sgn * r * 0.45, -r * 0.7);
      ctx.quadraticCurveTo(sgn * r * 0.9, -r * 1.5, sgn * r * 0.35, -r * 1.35);
      ctx.quadraticCurveTo(sgn * r * 0.5, -r * 0.95, sgn * r * 0.2, -r * 0.75);
      ctx.fill();
    }
  }
  bodyCache.set(key, c);
  return c;
}

export function spawnEnemy(G, tier, x, y) {
  if (enemies.count >= enemies.cap) return null;
  const e = enemies.alloc();
  if (!e) return null;
  const t = ENEMY_TYPES[tier];
  const min = G.time / 60;
  const mul = G.modeDef;
  // 无尽模式 20 分钟后强度持续爬升
  const over = G.modeDef.duration === Infinity ? Math.max(0, min - 20) * 0.15 : 0;
  e.x = x; e.y = y;
  e.tier = tier; e.isBoss = false; e.ai = null;
  e.maxHp = e.hp = t.hp * (1 + min * ENEMY_SCALE_PER_MIN.hp + over) * mul.hpMul;
  e.spd = t.spd * (1 + min * ENEMY_SCALE_PER_MIN.spd) * rand(0.9, 1.1);
  e.dmg = t.dmg * (1 + min * ENEMY_SCALE_PER_MIN.dmg + over * 0.5) * mul.dmgMul;
  e.r = t.r; e.color = t.color;
  e.xp = t.xp;
  e.birth = 0.3; e.dying = 0; e.flash = 0; e.frozen = 0; e.slowT = 0; e.slowF = 1;
  e.burnT = 0; e.contactCd = 0; e.kbx = 0; e.kby = 0;
  e.wobble = rand(TAU);
  // 出生：地上一团墨渍
  vfx.spawnDecal(e.x, e.y + 4, vfx.scorchSprite('rgba(10,14,18,0.7)'), t.r / 22, 0.5, 0.25);
  return e;
}

export function spawnBoss(G) {
  const e = enemies.alloc();
  if (!e) return null;
  const min = G.time / 60;
  const a = rand(TAU);
  const d = Math.max(innerWidth, innerHeight) * 0.6 + 80;
  e.x = G.player.x + Math.cos(a) * d;
  e.y = G.player.y + Math.sin(a) * d;
  e.tier = 'boss'; e.isBoss = true; e.ai = null;
  e.name = BOSS_NAMES[G.bossCount % BOSS_NAMES.length];
  e.maxHp = e.hp = (BOSS.hpBase + min * BOSS.hpPerMin) * G.modeDef.hpMul;
  e.spd = BOSS.spd; e.dmg = BOSS.dmg * G.modeDef.dmgMul;
  e.r = BOSS.r; e.color = C.jie; e.xp = BOSS.xp;
  e.birth = 0.5; e.dying = 0; e.flash = 0; e.frozen = 0; e.slowT = 0; e.slowF = 1;
  e.burnT = 0; e.contactCd = 0; e.kbx = 0; e.kby = 0; e.wobble = rand(TAU);
  return e;
}

export function spawnTribulation(G) {
  const e = enemies.alloc();
  if (!e) return null;
  e.x = G.player.x; e.y = G.player.y - 420;
  e.tier = 'trib'; e.isBoss = true;
  e.ai = 'trib'; e.aiT = 0; e.dashT = 4; e.summonT = 6; e.ringT = 2.5;
  e.name = '天劫化身';
  e.maxHp = e.hp = TRIBULATION.hpBase + G.player.level * TRIBULATION.hpPerLevel;
  e.spd = TRIBULATION.spd; e.dmg = TRIBULATION.dmg * G.modeDef.dmgMul;
  e.r = TRIBULATION.r; e.color = C.jie; e.xp = 0;
  e.birth = 0.8; e.dying = 0; e.flash = 0; e.frozen = 0; e.slowT = 0; e.slowF = 1;
  e.burnT = 0; e.contactCd = 0; e.kbx = 0; e.kby = 0; e.wobble = rand(TAU);
  return e;
}

// 通用伤害入口（武器/神通都走这里）
export function damageEnemy(G, e, rawDmg, opts = {}) {
  if (e.dying > 0 || e.birth > 0.12) return false;
  const crit = Math.random() < 0.12;
  const dmg = rawDmg * G.player.stats.dmg * (crit ? 1.75 : 1);
  e.hp -= dmg;
  e.flash = 0.08;
  if (opts.kx) { e.kbx += opts.kx; e.kby += opts.ky; }
  if (G.settings.dmgNumbers) {
    vfx.spawnText(e.x, e.y - e.r, String(Math.round(dmg)), crit ? C.gold : C.rice, crit);
  }
  sfx.hit();
  if (e.hp <= 0) { killEnemy(G, e, opts); return true; }
  return false;
}

export function killEnemy(G, e, opts = {}) {
  if (e.dying > 0) return;
  e.dying = 0.36;
  G.kills++;
  G.combo++;
  G.comboT = 3;
  const xpMul = (1 + (G.time / 60) * XP_INFLATION_PER_MIN) * G.modeDef.xpMul;
  if (e.frozen > 0) {
    // 冻毙：碎成旋转三角冰片
    for (let i = 0; i < 8; i++) {
      const a = rand(TAU), v = rand(60, 190);
      vfx.spawnP({
        x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
        life: rand(0.35, 0.65), size0: rand(8, 16), size1: 2, grav: 260,
        sprite: vfx.shardSprite(), rot: rand(TAU), vrot: rand(-9, 9),
      });
    }
    sfx.ice();
  } else {
    vfx.inkDeath(e.x, e.y, e.r, e.tier === 'elite' ? C.jie : (e.isBoss ? C.jie : C.gold));
  }
  if (e.tier === 'elite') {
    vfx.spawnWave(e.x, e.y, 70, C.jie, 0.4, 3);
    G.timeCtl.stop(0.055); // 精英死亡顿帧
    G.cam.shake(4);
  }
  if (e.isBoss && e.ai !== 'trib') {
    vfx.spawnWave(e.x, e.y, 130, C.jie, 0.6, 4, true);
    G.timeCtl.stop(0.08);
    G.timeCtl.slow(0.3, 1);
    G.cam.shake(10);
    G.onBossKilled(e);
  }
  if (e.ai === 'trib') { G.onTribulationKilled(e); return; }
  // 掉灵气
  spawnGem(G, e.x, e.y, Math.max(1, Math.round(e.xp * xpMul)));
  if (Math.random() < PICKUP.healChance) spawnHeal(G, e.x, e.y);
}

export function updateEnemies(G, dt) {
  const p = G.player;
  G.hash.clear();
  for (let i = enemies.count - 1; i >= 0; i--) {
    const e = enemies.items[i];
    // 死亡动画
    if (e.dying > 0) {
      e.dying -= dt;
      if (e.dying <= 0) enemies.releaseAt(i);
      continue;
    }
    if (e.birth > 0) { e.birth -= dt; }
    e.flash = Math.max(0, e.flash - dt);
    if (e.frozen > 0) { e.frozen -= dt; }
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowF = 1; }
    // 灼烧 DoT
    if (e.burnT > 0) {
      e.burnT -= dt;
      e.hp -= e.burnDps * dt;
      if (Math.random() < dt * 6) vfx.smoke(e.x, e.y - e.r, 1);
      if (e.hp <= 0) { killEnemy(G, e); continue; }
    }
    // 领域减速（化神神通）
    let fieldSlow = 1;
    if (p.powers.field && dist2(e.x, e.y, p.x, p.y) < 260 * 260) fieldSlow = 0.6;
    // 移动
    if (e.frozen <= 0 && e.birth <= 0.1) {
      const dx = p.x - e.x, dy = p.y - e.y;
      const l = Math.hypot(dx, dy) || 1;
      e.wobble += dt * 3;
      const wob = Math.sin(e.wobble) * 0.35;
      const sp = e.spd * e.slowF * fieldSlow;
      if (e.ai === 'trib') {
        updateTribAI(G, e, dt, dx, dy, l);
      } else {
        e.x += (dx / l) * sp * dt + (-dy / l) * wob * sp * dt * 0.4;
        e.y += (dy / l) * sp * dt + (dx / l) * wob * sp * dt * 0.4;
      }
      // 击退衰减
      e.x += e.kbx * dt; e.y += e.kby * dt;
      const kd = Math.exp(-8 * dt);
      e.kbx *= kd; e.kby *= kd;
      // 接触伤害
      e.contactCd -= dt;
      if (e.contactCd <= 0 && l < e.r + p.r + 2) {
        hurtPlayer(G, e.dmg, e.x, e.y);
        e.contactCd = 0.7;
      }
    }
    G.hash.insert(e);
  }
}

// 天劫化身 AI：环形弹幕 / 突进"劫灭" / 召唤
function updateTribAI(G, e, dt, dx, dy, l) {
  const p = G.player;
  e.aiT += dt;
  // 常规逼近
  e.x += (dx / l) * e.spd * dt;
  e.y += (dy / l) * e.spd * dt;
  // 环形弹幕
  e.ringT -= dt;
  if (e.ringT <= 0) {
    e.ringT = TRIBULATION.ringCd;
    G.spawnEnemyBulletRing(e.x, e.y, TRIBULATION.ringBullets, TRIBULATION.bulletSpd, e.dmg * 0.55);
    vfx.spawnWave(e.x, e.y, 120, C.jie, 0.5, 4, true);
    sfx.bossWarn();
  }
  // 突进"劫灭"
  e.dashT -= dt;
  if (e.dashT <= 0) {
    e.dashT = TRIBULATION.dashCd;
    e.kbx = (dx / l) * 620; e.kby = (dy / l) * 620;
    vfx.spawnText(e.x, e.y - e.r - 22, '劫灭', C.jie, true);
    G.cam.shake(6);
  }
  // 召唤
  e.summonT -= dt;
  if (e.summonT <= 0) {
    e.summonT = TRIBULATION.summonCd;
    for (let k = 0; k < 5; k++) {
      const a = rand(TAU);
      const en = spawnEnemy(G, 'normal', e.x + Math.cos(a) * 90, e.y + Math.sin(a) * 90);
      if (en) en.color = C.jie;
    }
  }
}

export function drawEnemies(rc, G) {
  const { ent, glow } = rc;
  const cam = G.cam, w = innerWidth, h = innerHeight;
  const eyeSpr = vfx.glowSprite(C.blood, 16);
  const purpleGlow = vfx.glowSprite(C.jie, 64);
  for (let i = 0; i < enemies.count; i++) {
    const e = enemies.items[i];
    if (!cam.inView(e.x, e.y, w, h, e.r + 40)) continue;
    let scale = 1, alpha = 1;
    if (e.birth > 0) { const t = 1 - e.birth / (e.isBoss ? 0.5 : 0.3); scale = t; alpha = t; }
    if (e.dying > 0) { const t = e.dying / 0.36; scale = 0.9 + (1 - t) * 0.3; alpha = t; }
    // 受击挤压
    let sq = 1;
    if (e.flash > 0) sq = 0.86;
    ent.save();
    ent.translate(e.x, e.y);
    ent.scale(scale * sq, scale * (2 - sq) * 0.5 + scale * 0.5);
    ent.globalAlpha = alpha;
    // 可选敌人皮肤（缺失回退墨团）
    const skin = G.settings.skin !== 'classic' ? A.img(ENEMY_SKIN[e.tier]) : null;
    if (skin) {
      const flip = G.player && G.player.x < e.x ? -1 : 1;
      A.drawSprite(ent, skin, 0, 1, 0, e.r, e.r * 2.4, flip, alpha, 1);
    } else {
      const spr = bodySprite(e.color, e.r, e.tier);
      ent.drawImage(spr, -spr.width / 2, -spr.height / 2);
      // 眼睛
      if (e.dying <= 0) {
        const er = Math.max(2.5, e.r * 0.2);
        ent.drawImage(eyeSpr, -e.r * 0.35 - er, -e.r * 0.25 - er, er * 2, er * 2);
        ent.drawImage(eyeSpr, e.r * 0.35 - er, -e.r * 0.25 - er, er * 2, er * 2);
      }
    }
    // 受击白闪一帧
    if (e.flash > 0.02) {
      ent.globalAlpha = alpha * 0.85;
      ent.globalCompositeOperation = 'lighter';
      ent.beginPath();
      ent.arc(0, 0, e.r, 0, TAU);
      ent.fillStyle = '#FFFFFF';
      ent.fill();
      ent.globalCompositeOperation = 'source-over';
    }
    // 冻结冰壳
    if (e.frozen > 0) {
      ent.globalAlpha = alpha * 0.55;
      ent.beginPath();
      ent.arc(0, 0, e.r + 3, 0, TAU);
      ent.fillStyle = 'rgba(188,232,240,0.5)';
      ent.fill();
      ent.strokeStyle = '#E8FBFF';
      ent.lineWidth = 1.5;
      ent.stroke();
      // 一点镜面闪光
      ent.globalAlpha = alpha * (0.5 + 0.5 * Math.sin(G.time * 7 + e.wobble));
      ent.fillStyle = '#FFFFFF';
      ent.fillRect(-e.r * 0.4, -e.r * 0.55, 3, 3);
    }
    ent.restore();
    // 妖王辉光 + 天劫触手
    if (e.isBoss) {
      glow.globalAlpha = 0.35 * alpha;
      glow.drawImage(purpleGlow, e.x - e.r * 2.4, e.y - e.r * 2.4, e.r * 4.8, e.r * 4.8);
      glow.globalAlpha = 1;
      if (e.ai === 'trib') drawTentacles(glow, e, G.time);
    }
  }
  ent.globalAlpha = 1;
}
// 触手状暗紫气焰：多条正弦摆动的条带
function drawTentacles(glow, e, time) {
  glow.strokeStyle = 'rgba(150,100,220,0.5)';
  glow.lineCap = 'round';
  for (let k = 0; k < 6; k++) {
    const baseA = (k / 6) * TAU + time * 0.5;
    glow.lineWidth = 5;
    glow.globalAlpha = 0.5;
    glow.beginPath();
    for (let j = 0; j <= 8; j++) {
      const t = j / 8;
      const a = baseA + Math.sin(time * 2.2 + k * 1.7 + t * 3) * 0.5 * t;
      const r = e.r + t * 62;
      const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
      j === 0 ? glow.moveTo(x, y) : glow.lineTo(x, y);
    }
    glow.stroke();
  }
  glow.globalAlpha = 1;
}

// ============================================================
// 灵气珠 / 回血丹
// ============================================================
const makeGem = () => ({ x: 0, y: 0, xp: 1, heal: false, bob: 0, vx: 0, vy: 0, pull: false });
export const gems = new Pool(420, makeGem);
export function spawnGem(G, x, y, xp) {
  const g = gems.alloc();
  if (!g) { G.gainXp(xp); return; } // 池满直接入账
  g.x = x + rand(-6, 6); g.y = y + rand(-6, 6);
  g.xp = xp; g.heal = false;
  g.bob = rand(TAU); g.pull = false; g.vx = 0; g.vy = 0;
}
export function spawnHeal(G, x, y) {
  const g = gems.alloc();
  if (!g) return;
  g.x = x; g.y = y; g.xp = 0; g.heal = true;
  g.bob = rand(TAU); g.pull = false; g.vx = 0; g.vy = 0;
}
export function updateGems(G, dt) {
  const p = G.player;
  const mr2 = p.magnetR * p.magnetR;
  for (let i = gems.count - 1; i >= 0; i--) {
    const g = gems.items[i];
    g.bob += dt * 4;
    const d2 = dist2(g.x, g.y, p.x, p.y);
    if (!g.pull && d2 < mr2) g.pull = true;
    if (g.pull) {
      const dx = p.x - g.x, dy = p.y - g.y;
      const l = Math.hypot(dx, dy) || 1;
      const sp = 340 + (1 - l / p.magnetR) * 420;
      g.x += (dx / l) * sp * dt;
      g.y += (dy / l) * sp * dt;
      if (l < p.r + 8) {
        if (g.heal) { p.hp = Math.min(p.maxHp, p.hp + PICKUP.healAmount); vfx.spawnText(p.x, p.y - 18, '+' + PICKUP.healAmount, C.ghost); }
        else G.gainXp(g.xp);
        sfx.pickup();
        gems.releaseAt(i);
      }
    }
  }
}
export function drawGems(rc, G) {
  const { glow } = rc;
  const cam = G.cam, w = innerWidth, h = innerHeight;
  const gemSpr = vfx.glowSprite(C.jian, 24);
  const healSpr = vfx.glowSprite(C.ghost, 24);
  for (let i = 0; i < gems.count; i++) {
    const g = gems.items[i];
    if (!cam.inView(g.x, g.y, w, h, 20)) continue;
    const bob = Math.sin(g.bob) * 2.5;
    const s = g.heal ? 14 : (8 + Math.min(6, g.xp * 0.3));
    glow.globalAlpha = 0.85;
    glow.drawImage(g.heal ? healSpr : gemSpr, g.x - s / 2, g.y - s / 2 + bob, s, s);
  }
  glow.globalAlpha = 1;
}

// ============================================================
// 玩家绘制：分层外观（base+robe+accessory+aura）→ 缺素材回退矢量墨衣修士
// ============================================================
// 矢量版（经典绘制 / 回退）
function drawVectorPlayer(ent, p, t, alpha, scale, bob) {
  ent.save();
  ent.translate(p.x, p.y + bob);
  ent.scale(p.face * scale, scale);
  ent.globalAlpha = alpha;
  // 长袍（墨色，底摆随动）
  ent.beginPath();
  ent.moveTo(0, -14);
  ent.quadraticCurveTo(9, -6, 7 + Math.sin(t * 9) * 1.5, 12);
  ent.quadraticCurveTo(0, 15, -7 + Math.cos(t * 8) * 1.5, 12);
  ent.quadraticCurveTo(-9, -6, 0, -14);
  ent.fillStyle = '#171E26';
  ent.fill();
  ent.strokeStyle = 'rgba(232,226,208,0.75)';
  ent.lineWidth = 1.2;
  ent.stroke();
  // 头
  ent.beginPath();
  ent.arc(0, -19, 5.5, 0, TAU);
  ent.fillStyle = '#E8E2D0';
  ent.fill();
  // 发髻
  ent.beginPath();
  ent.arc(0, -25.5, 2.4, 0, TAU);
  ent.fillStyle = '#171E26';
  ent.fill();
  // 腰间飘带（剑青）
  ent.strokeStyle = C.jian;
  ent.lineWidth = 1.6;
  ent.beginPath();
  ent.moveTo(-4, 0);
  ent.quadraticCurveTo(-13 - Math.sin(t * 7) * 3, 4, -17 - Math.sin(t * 6) * 4, 10);
  ent.stroke();
  ent.restore();
  ent.globalAlpha = 1;
}
// 素材版：base + robe(色调偏移) + accessory 逐层合成；base 缺失返回 false 整体回退
function drawAssetPlayer(rc, p, realm, alpha, scale, bob) {
  const anim = p.moving ? 'run' : 'idle';
  const cfg = SHEET[anim];
  const baseImg = A.img(`player/base_${anim}.png`);
  if (!baseImg) return false;
  const frame = Math.floor(p.animT * cfg.fps) % cfg.frames;
  const look = REALM_LOOK[clamp(realm, 0, REALM_LOOK.length - 1)];
  const x = p.x, y = p.y + 15 + bob;
  const H = SHEET.targetH;
  const ent = rc.ent;
  A.drawSprite(ent, baseImg, frame, cfg.frames, x, y, H, p.face, alpha, scale);
  if (look.layers.includes('robe')) {
    const robe = A.tinted(`player/robe_${anim}.png`, look.robeHue);
    if (robe) A.drawSprite(ent, robe, frame, cfg.frames, x, y, H, p.face, alpha, scale);
  }
  if (look.accessory) {
    const acc = A.img(look.accessory);
    if (acc) A.drawSprite(ent, acc, 0, 1, x, y, H, p.face, alpha, scale);
  }
  return true;
}

export function drawPlayer(rc, G) {
  const { ent, glow } = rc;
  const p = G.player;
  const t = p.animT;
  const bob = p.moving ? Math.sin(t * 11) * 1.6 : Math.sin(t * 2.4) * 1;
  // 突破换装时刻：0–0.3s 白光吞没旧装淡出 → 0.3–0.7s 新装从光中显现
  let drawRealm = p.realm, alpha = 1, scale = 1, whiteGlow = 0;
  if (p.transformT > 0) {
    const e = 0.7 - p.transformT;
    if (e < 0.3) {
      drawRealm = Math.max(0, p.realm - 1);
      alpha = 1 - e / 0.3;
      whiteGlow = e / 0.3;
    } else {
      const k = clamp((e - 0.3) / 0.4, 0, 1);
      scale = 0.6 + 0.4 * easeOutBack(k);
      whiteGlow = 1 - k;
    }
  }
  if (p.invuln > 0 && (t * 20) % 2 < 1) alpha *= 0.45; // 无敌闪烁
  // 皮肤选择：素材皮肤缺 base 时自动回退矢量
  const useAssets = G.settings.skin !== 'classic';
  const drew = useAssets && drawAssetPlayer(rc, p, drawRealm, alpha, scale, bob);
  if (!drew && alpha > 0.02) drawVectorPlayer(ent, p, t, alpha, scale, bob);
  // 白光吞没
  if (whiteGlow > 0) {
    const ws = vfx.glowSprite('#FFFFFF', 64);
    const wr = 40 + whiteGlow * 22;
    glow.globalAlpha = whiteGlow * 0.95;
    glow.drawImage(ws, p.x - wr, p.y - wr + bob * 0.5, wr * 2, wr * 2);
    glow.globalAlpha = 1;
  }

  // 境界光环（辉光层，appearance 配置驱动）
  const look = REALM_LOOK[clamp(drawRealm, 0, REALM_LOOK.length - 1)].aura;
  const auraSpr = vfx.glowSprite(look.color, 64);
  const ar = look.radius + Math.sin(t * 3) * 3;
  glow.globalAlpha = look.strength * (0.8 + Math.sin(t * 2.2) * 0.2) * Math.max(alpha, 0.4);
  glow.drawImage(auraSpr, p.x - ar, p.y - ar + bob * 0.5, ar * 2, ar * 2);
  glow.globalAlpha = 1;
  // 护盾指示
  if (p.shield > 0) {
    glow.strokeStyle = C.jian;
    glow.lineWidth = 1.5;
    glow.globalAlpha = 0.6 + Math.sin(t * 5) * 0.2;
    glow.beginPath();
    glow.arc(p.x, p.y, 22, 0, TAU);
    glow.stroke();
    glow.globalAlpha = 1;
  }
}

export function clearEntities() {
  enemies.clear();
  gems.clear();
}
