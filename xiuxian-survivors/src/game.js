import { C, QUALITY, xpNeed, REALMS, REALM_SUBS, CN_NUM, MODES, WEAPONS, PASSIVES, FORBIDDEN, DAOFRUITS, MAX_WEAPONS, SPAWN, HORDE, BOSS, TRIBULATION, gradeOf, ENEMY_TYPES } from './data.js';
import { SpatialHash, rand, TAU, clamp, lerp, pick, fmtTime, dist2 } from './utils.js';
import { Camera, TimeCtl } from './camera.js';
import * as R from './render.js';
import * as vfx from './vfx.js';
import * as E from './entities.js';
import * as W from './weapons.js';
import * as M from './mechs.js';
import * as UI from './ui.js';
import { initInput, getMove, callbacks as inputCb } from './input.js';
import { sfx, startBGM, stopBGM, setTense, tickBGM, unlockAudio, setVolume } from './audio.js';

// ============================================================
// 全局游戏状态
// ============================================================
export const G = {
  state: 'menu', // menu | playing | levelup | paused | over | ascend
  cam: new Camera(),
  timeCtl: new TimeCtl(),
  hash: new SpatialHash(72),
  player: null,
  modeDef: MODES[0],
  charDef: null,
  time: 0, dtReal: 0,
  kills: 0, combo: 0, comboT: 0,
  xpNeeded: xpNeed(1),
  pendingLevels: 0,
  // 定时事件
  spawnT: 1, bossT: BOSS.interval, hordeT: HORDE.interval, hordeWave: 0,
  bossCount: 0, activeBoss: null,
  tribWarned: false, tribSpawned: false, tribAlive: false,
  // 视觉状态
  lights: [],
  fx: { red: 0, gold: 0, white: 0, aberr: 0 },
  grade: { r: 40, g: 74, b: 82, a: 0.1 },
  gradeTarget: { r: 40, g: 74, b: 82, a: 0.1 },
  darkAlpha: 0.42, darkTarget: 0.42,
  hordePhaseT: 0,
  settings: UI.settings,
  // 画质自适应
  qualityTier: 0, fpsSamples: [], fpsAcc: 0, fpsFrames: 0,
  // 飞升演出
  ascendT: 0, overT: 0, won: false, grade_: 'B',
  // 菜单氛围
  menuStreak: null, menuStreakT: 3,
  spawnEnemyBulletRing: null,
  onPlayerDeath: null, onBossKilled: null, onTribulationKilled: null,
  gainXp: null,
  aimAngle: 0,
};
G.spawnEnemyBulletRing = (x, y, n, s, d) => W.spawnEnemyBulletRing(G, x, y, n, s, d);

// ============================================================
// 初始化
// ============================================================
let rafId = 0, lastT = 0;
export function initGame(canvas) {
  R.initRender(canvas);
  initInput();
  UI.initUI({
    startRun,
    backToMenu,
    togglePause,
    unlock: () => { unlockAudio(); startBGM(); },
    isInRun: () => ['playing', 'levelup', 'paused', 'ascend', 'over'].includes(G.state),
    qualityChanged: applyQuality,
    volumeChanged: (kind, v) => setVolume(kind, v),
  });
  inputCb.pause = () => { if (G.state === 'playing' || G.state === 'paused') togglePause(); };
  inputCb.debug = () => UI.toggleDebug();
  setVolume('sfx', UI.settings.sfxVol);
  setVolume('bgm', UI.settings.bgmVol);
  applyQuality();
  UI.showScreen('menu');
  lastT = performance.now();
  rafId = requestAnimationFrame(loop);
  window.__G = G; // 调试/自测入口
  window.__startTest = (ci = 0, mi = 0) => startRun(CHARACTERS[ci], MODES[mi]);
  window.__test = {
    spawn: (tier, n = 1) => {
      for (let i = 0; i < n; i++) {
        const a = rand(TAU), d = rand(200, 500);
        E.spawnEnemy(G, tier, G.player.x + Math.cos(a) * d, G.player.y + Math.sin(a) * d);
      }
    },
    boss: spawnBossEvent,
    horde: hordeEvent,
    trib: tribulationArrive,
    breakthrough: () => breakthrough(G.player.realm),
    E, W,
  };
}

function applyQuality() {
  const s = UI.settings.quality;
  if (s !== 'auto') G.qualityTier = s;
  const q = QUALITY[G.qualityTier];
  R.setQualityTier(G.qualityTier);
  vfx.setParticleCap(q.particleCap);
  vfx.setDecalCap(q.decalCap);
}

// ============================================================
// 开局 / 收尾
// ============================================================
import { CHARACTERS } from './data.js';
export function startRun(charDef, modeDef, ci, mi) {
  charDef = charDef || CHARACTERS[ci || 0];
  modeDef = modeDef || MODES[mi || 0];
  G.charDef = charDef; G.modeDef = modeDef;
  G.player = E.createPlayer(charDef);
  E.clearEntities();
  W.clearWeapons();
  vfx.clearVfx();
  G.time = 0; G.kills = 0; G.combo = 0; G.comboT = 0;
  G.xpNeeded = xpNeed(1);
  G.pendingLevels = 0;
  G.spawnT = 0.8; G.bossT = BOSS.interval; G.hordeT = HORDE.interval; G.hordeWave = 0;
  G.bossCount = 0; G.activeBoss = null;
  G.tribWarned = false; G.tribSpawned = false; G.tribAlive = false;
  G.fx.red = G.fx.gold = G.fx.white = G.fx.aberr = 0;
  G.hordePhaseT = 0; G.ascendT = 0; G.overT = 0; G.won = false;
  G.cam.x = 0; G.cam.y = 0;
  W.addWeapon(G, charDef.startWeapon);
  setTense(false);
  G.state = 'playing';
  // 开局小波敌人，避免空场
  for (let i = 0; i < SPAWN.openingBurst; i++) {
    const a = rand(TAU), d = rand(320, 520);
    E.spawnEnemy(G, i % 3 === 0 ? 'swift' : 'normal', Math.cos(a) * d, Math.sin(a) * d);
  }
  UI.hideAllScreens();
  document.getElementById('pauseBtn').textContent = '暂停';
}
function backToMenu() {
  G.state = 'menu';
  E.clearEntities();
  W.clearWeapons();
  vfx.clearVfx();
  setTense(false);
  UI.showScreen('menu');
}
function togglePause() {
  if (G.state === 'playing') {
    G.state = 'paused';
    document.getElementById('pauseBtn').textContent = '继续';
  } else if (G.state === 'paused') {
    G.state = 'playing';
    document.getElementById('pauseBtn').textContent = '暂停';
  }
}

// ============================================================
// 经验与升级
// ============================================================
G.gainXp = (n) => {
  const p = G.player;
  p.xp += n;
  while (p.xp >= G.xpNeeded) {
    p.xp -= G.xpNeeded;
    p.level++;
    G.xpNeeded = xpNeed(p.level);
    G.pendingLevels++;
  }
};

// 升级卡池
function genCards() {
  const p = G.player;
  const cards = [];
  const pool = [];
  // 禁术金框卡（优先展示）
  for (const fid in FORBIDDEN) {
    const f = FORBIDDEN[fid];
    const w = p.weapons.find((x) => x.id === f.weapon);
    if (w && !w.evolved && w.lv >= WEAPONS[f.weapon].maxLv && (p.passives[f.passive] || 0) >= 3) {
      cards.push({ type: 'forbidden', fid, gold: true, kind: '禁术 · 觉醒', name: f.name, desc: f.desc, lvLabel: '' });
      break; // 一次最多一张禁术
    }
  }
  // 已持有武器升级
  for (const w of p.weapons) {
    const def = WEAPONS[w.id];
    if (w.lv < def.maxLv) {
      const to = w.lv + 1;
      const evo = def.evoNotes[to];
      pool.push({
        type: 'wup', id: w.id, kind: '术法精进', name: def.name,
        lvLabel: `${to}重${evo ? ' ✦' : ''}`,
        desc: evo ? `✦ 质变：${evo}` : `威能提升，${def.desc}`,
        evo: !!evo,
      });
    }
  }
  // 新武器
  if (p.weapons.length < MAX_WEAPONS) {
    for (const id in WEAPONS) {
      if (!p.weapons.find((x) => x.id === id)) {
        pool.push({ type: 'wnew', id, kind: '新悟术法', name: WEAPONS[id].name, lvLabel: '一重', desc: WEAPONS[id].desc });
      }
    }
  }
  // 心法
  for (const id in PASSIVES) {
    const lv = p.passives[id] || 0;
    if (lv < PASSIVES[id].maxLv) {
      pool.push({ type: 'pup', id, kind: '心法', name: PASSIVES[id].name, lvLabel: `${lv + 1}重`, desc: PASSIVES[id].desc });
    }
  }
  // 洗牌填充
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  for (const c of pool) {
    if (cards.length >= 3) break;
    cards.push(c);
  }
  // 道果兜底：任何时刻必有三张卡
  while (cards.length < 3) {
    const used = new Set(cards.map((c) => c.name));
    const cand = DAOFRUITS.filter((d) => !used.has(d.name));
    const d = cand.length ? pick(cand) : pick(DAOFRUITS);
    cards.push({ type: 'fruit', id: d.id, kind: '道果', name: d.name, desc: d.desc });
  }
  return cards;
}

function applyCard(card) {
  const p = G.player;
  if (card.type === 'wnew') W.addWeapon(G, card.id);
  else if (card.type === 'wup') {
    const w = p.weapons.find((x) => x.id === card.id);
    w.lv++;
  } else if (card.type === 'pup') {
    p.passives[card.id] = (p.passives[card.id] || 0) + 1;
    E.recalcStats(p);
  } else if (card.type === 'forbidden') {
    W.applyForbidden(G, card.fid);
    forbiddenCutscene(card.fid);
  } else if (card.type === 'fruit') {
    const s = p.stats;
    if (card.id === 'df_dmg') s._fruitDmg = (s._fruitDmg || 1) * 1.05;
    if (card.id === 'df_hp') { s._fruitHp = (s._fruitHp || 0) + 15; }
    if (card.id === 'df_cd') s._fruitCd = (s._fruitCd || 1) * 0.97;
    if (card.id === 'df_spd') { s._fruitSpd = (s._fruitSpd || 1) * 1.05; s._fruitMagnet = (s._fruitMagnet || 0) + 0.1; }
    if (card.id === 'df_regen') s._fruitRegen = (s._fruitRegen || 0) + 0.5;
    E.recalcStats(p);
    if (card.id === 'df_hp') p.hp = Math.min(p.maxHp, p.hp + 60);
    if (card.id === 'df_regen') p.hp = Math.min(p.maxHp, p.hp + 8);
  }
}

function openLevelUp() {
  G.state = 'levelup';
  sfx.levelup();
  const p = G.player;
  const label = `${REALMS[p.realm].name}${CN_NUM[p.realmSub - 1]}层 → 第 ${p.level} 阶`;
  UI.showLevelUp(genCards(), label, (card) => {
    applyCard(card);
    G.pendingLevels--;
    // 境界推进：每级 +1 层，跨大境界触发突破
    advanceRealm();
    if (G.pendingLevels > 0) { openLevelUp(); return; }
    UI.hideAllScreens();
    G.state = 'playing';
  });
}
function advanceRealm() {
  const p = G.player;
  p.realmSub++;
  if (p.realmSub > REALM_SUBS && p.realm < REALMS.length - 1) {
    p.realmSub = 1;
    p.realm++;
    breakthrough(p.realm);
  } else if (p.realmSub > REALM_SUBS) {
    p.realmSub = REALM_SUBS;
  }
}

// ———— 大境界突破演出 ————
function breakthrough(realmIdx) {
  const p = G.player;
  const r = REALMS[realmIdx];
  G.timeCtl.slow(0.15, 0.5); // 慢动作再回弹
  G.fx.gold = 1;
  G.cam.shake(6);
  sfx.breakthrough();
  // 换装时刻：白光吞没 0.3s → 新外观从光中显现，旧外观平滑淡出
  p.transformT = 0.7;
  setTimeout(() => vfx.spawnWave(p.x, p.y, 95, '#FFF6DC', 0.5, 4), 300); // 显现金环
  // 三重错时金环
  for (let i = 0; i < 3; i++) {
    setTimeout(() => vfx.spawnWave(p.x, p.y, 180 + i * 70, C.gold, 0.7, 5 - i, true), i * 130);
  }
  // 粒子喷泉
  const spr = vfx.glowSprite(C.gold, 32);
  for (let i = 0; i < 40; i++) {
    const a = rand(TAU);
    vfx.spawnP({
      x: p.x, y: p.y, vx: Math.cos(a) * rand(30, 120), vy: -rand(120, 380),
      life: rand(0.6, 1.4), size0: rand(4, 9), size1: 0, grav: 300, sprite: spr,
    });
  }
  UI.banner(r.name, r.power ? `神通觉醒 · ${r.powerName}` : '');
  if (r.power) M.grantPower(G, r.power);
  E.recalcStats(p);
}

// ———— 禁术觉醒演出 ————
function forbiddenCutscene(fid) {
  const f = FORBIDDEN[fid];
  G.timeCtl.slow(0.2, 0.7);
  G.fx.gold = 1;
  G.cam.shake(8);
  G.cam.kickZoom(0.05);
  sfx.breakthrough();
  UI.banner(f.name, '禁 术 觉 醒', fid === 'shenfa' ? 'purple' : '');
  const p = G.player;
  for (let i = 0; i < 3; i++) {
    setTimeout(() => vfx.spawnWave(p.x, p.y, 220 + i * 80, f.color, 0.8, 5 - i, true), i * 150);
  }
}

// ============================================================
// 事件：妖王 / 妖潮 / 天劫
// ============================================================
function spawnBossEvent() {
  const b = E.spawnBoss(G);
  if (!b) return;
  G.bossCount++;
  G.activeBoss = b;
  // 出场演出：黑边字幕框 + 名号泼墨 + 红色闪电
  UI.letterbox(true);
  UI.banner(b.name, '妖 王 现 世', 'red');
  G.cam.kickZoom(0.03); // 镜头轻推
  sfx.bossWarn();
  vfx.spawnBolt(b.x + 40, b.y, b.y - 380, '#FF6A5E', 4, 3);
  vfx.spawnBolt(b.x - 40, b.y, b.y - 420, '#FF6A5E', 3, 2);
  setTimeout(() => UI.letterbox(false), 1600);
}
G.onBossKilled = (boss) => {
  if (G.activeBoss === boss) G.activeBoss = null;
  // 必掉宝箱：自动获得 2 个已持有功法升级
  const p = G.player;
  const ups = [];
  for (let k = 0; k < 2; k++) {
    const cands = [];
    for (const w of p.weapons) if (w.lv < WEAPONS[w.id].maxLv) cands.push({ t: 'w', o: w });
    for (const id in PASSIVES) {
      const lv = p.passives[id] || 0;
      if (p.passives[id] && lv < PASSIVES[id].maxLv) cands.push({ t: 'p', o: id });
    }
    if (!cands.length) break;
    const c = pick(cands);
    if (c.t === 'w') { c.o.lv++; ups.push(`${WEAPONS[c.o.id].name}+1`); }
    else { p.passives[c.o]++; ups.push(`${PASSIVES[c.o].name}+1`); }
  }
  E.recalcStats(p);
  G.fx.gold = Math.max(G.fx.gold, 0.8);
  UI.banner('得宝', ups.join(' · ') || '功行圆满');
  E.spawnHeal(G, boss.x, boss.y);
};
function hordeEvent() {
  G.hordeWave++;
  G.hordePhaseT = 9; // 色调偏红时段
  UI.banner('妖潮', `第 ${G.hordeWave} 波 · 来 袭`, 'red');
  sfx.bossWarn();
  const p = G.player;
  const n = HORDE.baseCount + G.hordeWave * HORDE.perWave;
  const d = Math.max(innerWidth, innerHeight) * 0.55 + 60;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rand(0.1);
    const tier = Math.random() < 0.12 ? 'elite' : (Math.random() < 0.5 ? 'swift' : 'normal');
    E.spawnEnemy(G, tier, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
  }
}
function tribulationArrive() {
  G.tribSpawned = true;
  G.tribAlive = true;
  const t = E.spawnTribulation(G);
  G.activeBoss = t;
  UI.letterbox(true);
  UI.banner('天劫化身', '劫 云 压 顶', 'purple');
  sfx.bossWarn();
  setTense(true);
  G.timeCtl.slow(0.3, 1);
  setTimeout(() => UI.letterbox(false), 1800);
}
G.onTribulationKilled = (e) => {
  G.tribAlive = false;
  G.activeBoss = null;
  // 飞升演出
  G.state = 'ascend';
  G.ascendT = 0;
  G.won = true;
  G.timeCtl.slow(0.25, 1.2);
  sfx.ascend();
  vfx.spawnWave(e.x, e.y, 300, C.gold, 1, 6, true);
};
G.onPlayerDeath = () => {
  const p = G.player;
  if (p.powers.undying && p.powers.undying.available) {
    // 渡劫·不死金身：复活一次+清场
    p.powers.undying.available = false;
    p.usedRevive = true;
    p.hp = p.maxHp;
    p.invuln = 2.5;
    G.fx.white = 1;
    G.fx.gold = 1;
    G.timeCtl.stop(0.08);
    G.cam.shake(12);
    sfx.breakthrough();
    UI.banner('不死金身', '金 身 不 灭');
    for (let i = 0; i < E.enemies.count; i++) {
      const e = E.enemies.items[i];
      if (e.ai !== 'trib' && e.dying <= 0) E.killEnemy(G, e);
    }
    return;
  }
  G.state = 'over';
  G.overT = 0;
  G.won = false;
  G.timeCtl.slow(0.3, 1.2);
  stopRunAudio();
};
function stopRunAudio() { setTense(false); }

// ============================================================
// 主循环
// ============================================================
function loop(t) {
  rafId = requestAnimationFrame(loop);
  let dtReal = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  G.dtReal = dtReal;
  tickBGM(dtReal);
  sampleFps(dtReal);

  const dt = G.timeCtl.update(dtReal);
  G.cam.enabled = UI.settings.shake;
  G.cam.update(dtReal);

  switch (G.state) {
    case 'menu': updateMenu(dtReal); break;
    case 'playing': updatePlaying(dt, dtReal); break;
    case 'ascend': updateAscend(dt, dtReal); break;
    case 'over': updateOver(dt, dtReal); break;
    case 'levelup': case 'paused':
      // 静止但保持画面（粒子微更新让画面不"死"）
      vfx.updateVfx(dtReal * 0.25);
      break;
  }
  decayFx(dtReal);
  renderWorld();
  if (G.state !== 'menu' && G.player) UI.updateHUD(G);
  UI.setDebug(
    `fps ${G.fpsAvg?.toFixed(0) ?? '--'} | tier ${QUALITY[G.qualityTier].name}\n` +
    `enemies ${E.enemies.count} | bullets ${W.bullets.count}\n` +
    `particles ${vfx.particles.count} | decals ${vfx.decals.length}\n` +
    `state ${G.state} | t ${fmtTime(G.time)}`
  );
}

// ———— 帧率采样与画质自适应 ————
function sampleFps(dtReal) {
  G.fpsAcc += dtReal; G.fpsFrames++;
  if (G.fpsAcc >= 0.5) {
    const inst = G.fpsFrames / G.fpsAcc;
    G.fpsAcc = 0; G.fpsFrames = 0;
    G.fpsSamples.push(inst);
    if (G.fpsSamples.length > 10) G.fpsSamples.shift(); // 近5秒
    G.fpsAvg = G.fpsSamples.reduce((a, b) => a + b, 0) / G.fpsSamples.length;
    if (UI.settings.quality === 'auto' && G.fpsSamples.length >= 6 && G.fpsAvg < 50 && G.qualityTier < 2) {
      G.qualityTier++;
      G.fpsSamples.length = 0;
      applyQuality();
    }
  }
}

function decayFx(dtReal) {
  const f = G.fx;
  f.red = Math.max(0, f.red - dtReal * 2.6);
  f.gold = Math.max(0, f.gold - dtReal * 1.8);
  f.aberr = Math.max(0, f.aberr - dtReal * 6);
  if (G.state !== 'ascend') f.white = Math.max(0, f.white - dtReal * 1.4);
  // 色调分级平滑过渡（2–3秒插值）
  const gr = G.grade, gt = G.gradeTarget;
  const k = 1 - Math.exp(-0.8 * dtReal);
  gr.r = lerp(gr.r, gt.r, k); gr.g = lerp(gr.g, gt.g, k);
  gr.b = lerp(gr.b, gt.b, k); gr.a = lerp(gr.a, gt.a, k);
  G.darkAlpha = lerp(G.darkAlpha, G.darkTarget, k);
}

// ———— 色调随进程演变 ————
function updateGrading() {
  if (G.state === 'ascend') {
    G.gradeTarget = { r: 255, g: 226, b: 170, a: 0.35 };
    G.darkTarget = 0.05;
  } else if (G.tribSpawned && G.tribAlive) {
    // 天劫：整体压紫
    G.gradeTarget = { r: 120, g: 70, b: 190, a: 0.3 };
    G.darkTarget = 0.55;
  } else if (G.hordePhaseT > 0) {
    // 妖潮偏红
    G.gradeTarget = { r: 150, g: 55, b: 50, a: 0.22 };
    G.darkTarget = 0.46;
  } else {
    // 开局冷墨青
    G.gradeTarget = { r: 40, g: 74, b: 82, a: 0.12 };
    G.darkTarget = 0.42;
  }
}

// ============================================================
// 局内更新
// ============================================================
function updatePlaying(dt, dtReal) {
  const p = G.player;
  G.time += dt;
  p.animT += dt;
  // 输入移动
  const mv = getMove();
  p.moving = mv.x !== 0 || mv.y !== 0;
  if (p.moving) {
    p.x += mv.x * p.stats.spd * dt;
    p.y += mv.y * p.stats.spd * dt;
    if (mv.x !== 0) p.face = mv.x > 0 ? 1 : -1;
  }
  p.invuln = Math.max(0, p.invuln - dt);
  if (p.transformT > 0) p.transformT -= dtReal; // 换装演出走真实时间（慢动作中也流畅）
  // 回血
  p.hp = Math.min(p.maxHp, p.hp + p.stats.regen * dt);
  // 瞄准角
  const tgt = nearestForAim();
  G.aimAngle = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : (p.face > 0 ? 0 : Math.PI);
  // 相机
  G.cam.follow(p.x, p.y, dt || dtReal);
  // 系统
  E.updateEnemies(G, dt);
  W.updateWeapons(G, dt);
  M.updatePowers(G, dt);
  E.updateGems(G, dt);
  vfx.updateVfx(dt);
  // 连斩
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
  if (G.hordePhaseT > 0) G.hordePhaseT -= dt;
  // 刷怪
  spawnTick(dt);
  // 定时事件
  if (!G.tribSpawned) {
    G.bossT -= dt;
    if (G.bossT <= 0) { G.bossT = BOSS.interval; spawnBossEvent(); }
    G.hordeT -= dt;
    if (G.hordeT <= 0) { G.hordeT = HORDE.interval; hordeEvent(); }
  }
  // 天劫时间线
  if (G.modeDef.hasEnding) {
    if (!G.tribWarned && G.time >= TRIBULATION.warnAt) {
      G.tribWarned = true;
      UI.banner('天劫将至', '两 分 钟 后 降 临', 'purple');
      sfx.bossWarn();
      setTense(true);
    }
    if (!G.tribSpawned && G.time >= TRIBULATION.arriveAt) tribulationArrive();
  }
  // 天劫紫雨
  if (G.tribSpawned && G.tribAlive && Math.random() < dtReal * 40) {
    const spr = vfx.glowSprite(C.jie, 16);
    vfx.spawnP({
      x: G.cam.x + rand(-innerWidth / 2, innerWidth / 2),
      y: G.cam.y - innerHeight / 2 - 20,
      vx: -60, vy: 520, life: 1.4, size0: 3, size1: 3, sprite: spr, alpha: 0.5,
    });
  }
  updateGrading();
  // 升级触发
  if (G.pendingLevels > 0) openLevelUp();
}

function nearestForAim() {
  const p = G.player;
  let best = null, bd = 700 * 700;
  for (let i = 0; i < E.enemies.count; i++) {
    const e = E.enemies.items[i];
    if (e.dying > 0 || e.birth > 0.1) continue;
    const d = dist2(p.x, p.y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// ———— 刷怪 ————
function spawnTick(dt) {
  const min = G.time / 60;
  const interval = Math.max(SPAWN.minInterval, SPAWN.baseInterval - SPAWN.tightenPerMin * min);
  G.spawnT -= dt;
  while (G.spawnT <= 0) {
    G.spawnT += interval;
    if (E.enemies.count >= SPAWN.maxAlive) break;
    // 类型权重：3分钟后解锁精英
    let tier = 'normal';
    const r = Math.random() * 8;
    if (r < ENEMY_TYPES.swift.weight) tier = 'swift';
    else if (min > 3 && r > 7.2) tier = 'elite';
    const p = G.player;
    const a = rand(TAU);
    const d = Math.max(innerWidth, innerHeight) * 0.55 + rand(30, 120);
    E.spawnEnemy(G, tier, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
  }
}

// ———— 飞升演出 ————
function updateAscend(dt, dtReal) {
  const p = G.player;
  G.ascendT += dtReal;
  p.animT += dt;
  G.cam.follow(p.x, p.y, dtReal);
  vfx.updateVfx(dt || dtReal * 0.3);
  E.updateGems(G, dt);
  updateGrading();
  const T = G.ascendT;
  // 花瓣与灵光逆流上升
  if (T > 0.8 && T < 3.2) {
    for (let i = 0; i < 3; i++) {
      const spr = vfx.glowSprite(Math.random() < 0.5 ? C.gold : '#FFF2CE', 24);
      vfx.spawnP({
        x: p.x + rand(-innerWidth / 3, innerWidth / 3),
        y: p.y + innerHeight / 2 + 20,
        vx: rand(-15, 15), vy: -rand(180, 420),
        life: rand(1, 2), size0: rand(3, 8), size1: 1, sprite: spr,
      });
    }
  }
  // 画面渐白
  if (T > 2.6) G.fx.white = Math.min(1, (T - 2.6) / 1.2);
  if (T > 4.2) {
    finishRun(true);
  }
}
function updateOver(dt, dtReal) {
  G.overT += dtReal;
  vfx.updateVfx(dt || dtReal * 0.3);
  if (G.overT > 1.6) finishRun(false);
}
function finishRun(won) {
  const p = G.player;
  G.grade_ = gradeOf(won, p.level, G.kills, p.usedRevive);
  G.state = 'result';
  UI.showResult({
    won, grade: G.grade_,
    level: p.level, kills: G.kills, time: G.time,
    realm: `${REALMS[p.realm].name}${CN_NUM[p.realmSub - 1]}层`,
    mode: G.modeDef.name,
  });
}

// ============================================================
// 菜单氛围：视差远山 + 飘浮灵光 + 金剑掠屏 + "道"字水印
// ============================================================
function updateMenu(dtReal) {
  G.cam.x += 26 * dtReal;
  G.time += dtReal;
  G.darkTarget = 0.3;
  G.gradeTarget = { r: 40, g: 74, b: 82, a: 0.12 };
  vfx.updateVfx(dtReal);
  // 飘浮灵光
  if (Math.random() < dtReal * 4) {
    const spr = vfx.glowSprite(Math.random() < 0.7 ? C.jian : C.gold, 24);
    vfx.spawnP({
      x: G.cam.x + rand(-innerWidth / 2, innerWidth / 2),
      y: G.cam.y + innerHeight / 2 + 10,
      vx: rand(-8, 8), vy: -rand(20, 60),
      life: rand(3, 6), size0: rand(3, 8), size1: 1, sprite: spr, alpha: 0.7,
    });
  }
  // 金剑掠屏
  G.menuStreakT -= dtReal;
  if (G.menuStreakT <= 0 && !G.menuStreak) {
    G.menuStreakT = rand(4, 8);
    G.menuStreak = {
      x: G.cam.x - innerWidth / 2 - 100,
      y: G.cam.y + rand(-innerHeight / 3, innerHeight / 3),
      vx: rand(900, 1300), vy: rand(-60, 60), trail: [],
    };
  }
  if (G.menuStreak) {
    const s = G.menuStreak;
    s.x += s.vx * dtReal; s.y += s.vy * dtReal;
    s.trail.unshift({ x: s.x, y: s.y });
    if (s.trail.length > 14) s.trail.length = 14;
    if (s.x > G.cam.x + innerWidth / 2 + 200) G.menuStreak = null;
  }
}

// ============================================================
// 渲染
// ============================================================
function renderWorld() {
  const rc = R.beginFrame(G);
  buildLights();
  if (G.state === 'menu') {
    // "道"字水印
    rc.ent.save();
    rc.ent.globalAlpha = 0.055;
    rc.ent.fillStyle = C.rice;
    rc.ent.font = `700 ${Math.min(innerWidth, innerHeight) * 0.62}px "Noto Serif SC", "Songti SC", serif`;
    rc.ent.textAlign = 'center';
    rc.ent.textBaseline = 'middle';
    rc.ent.fillText('道', G.cam.x + innerWidth * 0.22, G.cam.y - innerHeight * 0.05);
    rc.ent.restore();
    if (G.menuStreak) {
      const s = G.menuStreak;
      vfx.drawRibbon(rc.glow, s.trail, 6, 'rgba(255,216,144,0.75)');
      const spr = vfx.swordSprite(C.gold, true);
      rc.glow.save();
      rc.glow.translate(s.x, s.y);
      rc.glow.rotate(Math.atan2(s.vy, s.vx));
      rc.glow.drawImage(spr, -24, -7);
      rc.glow.restore();
    }
    vfx.drawParticles(rc.ent, rc.glow, G.cam, innerWidth, innerHeight);
  } else if (G.player) {
    E.drawGems(rc, G);
    W.drawWeapons(rc, G);
    E.drawEnemies(rc, G);
    E.drawPlayer(rc, G);
    M.drawPowers(rc, G);
    vfx.drawParticles(rc.ent, rc.glow, G.cam, innerWidth, innerHeight);
    vfx.drawWavesAndSlashes(rc.glow, G.cam, innerWidth, innerHeight);
    vfx.drawBolts(rc.glow);
    // 飞升金色光柱
    if (G.state === 'ascend' && G.ascendT > 0.9) {
      const p = G.player;
      const bw = 60 + Math.sin(G.ascendT * 6) * 10;
      const gr = rc.glow;
      gr.globalAlpha = Math.min(1, (G.ascendT - 0.9) / 0.5) * 0.85;
      const spr = vfx.glowSprite(C.gold, 64);
      gr.drawImage(spr, p.x - bw, p.y - innerHeight, bw * 2, innerHeight * 2);
      gr.drawImage(spr, p.x - bw * 0.45, p.y - innerHeight, bw * 0.9, innerHeight * 2);
      gr.globalAlpha = 1;
    }
  }
  R.endFrame(G);
  // 飘字（世界空间，最顶层）
  if (G.player && G.state !== 'menu') {
    R.overlayWorld(G, (ctx) => vfx.drawFloatTexts(ctx));
  }
}

function buildLights() {
  G.lights.length = 0;
  if (G.state === 'menu') return;
  const p = G.player;
  if (!p) return;
  // 玩家光圈：境界越高越大
  G.lights.push({ x: p.x, y: p.y, r: p.lightR, a: 0.95 });
  // 灵气珠微光
  for (let i = 0; i < E.gems.count && i < 60; i++) {
    const g = E.gems.items[i];
    G.lights.push({ x: g.x, y: g.y, r: 26, a: 0.5 });
  }
  // 雷电大闪
  for (let i = 0; i < vfx.bolts.count; i++) {
    const b = vfx.bolts.items[i];
    const pt = b.pts[b.pts.length - 1];
    if (pt) G.lights.push({ x: pt[0], y: pt[1], r: 180, a: 0.8 });
  }
  // 妖王
  if (G.activeBoss && G.activeBoss.dying <= 0) {
    G.lights.push({ x: G.activeBoss.x, y: G.activeBoss.y, r: 130, a: 0.6 });
  }
  // 火龙头
  for (const w of p.weapons) {
    if (w.evolved === 'huolong' && w.state && w.state.head) {
      G.lights.push({ x: w.state.head.x, y: w.state.head.y, r: 120, a: 0.7 });
    }
  }
}
