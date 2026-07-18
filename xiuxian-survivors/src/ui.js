import { CHARACTERS, MODES, WEAPONS, PASSIVES, FORBIDDEN, REALMS, DAOFRUITS, CN_NUM, QUALITY } from './data.js';
import { fmtTime } from './utils.js';

const $ = (id) => document.getElementById(id);
let H = null; // 回调集合（game.js 注入）

export const settings = {
  shake: true, dmgNumbers: true,
  quality: 'auto', // 'auto' | 0 | 1 | 2
  skin: 'assets',  // 'assets' 素材皮肤（缺图自动回退）| 'classic' 经典绘制
  sfxVol: 0.7, bgmVol: 0.5,
};
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('xx_settings') || '{}');
    Object.assign(settings, s);
  } catch (e) {}
}
function saveSettings() {
  try { localStorage.setItem('xx_settings', JSON.stringify(settings)); } catch (e) {}
}

const SCREENS = ['menu', 'charsel', 'modesel', 'codex', 'settings', 'levelup', 'result'];
export function showScreen(name) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== name);
  const inGame = name === null;
  $('hud').classList.toggle('hidden', !H.isInRun());
  $('pauseBtn').classList.toggle('hidden', !H.isInRun());
}
export function hideAllScreens() {
  for (const s of SCREENS) $(s).classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('pauseBtn').classList.remove('hidden');
}

export function initUI(handlers) {
  H = handlers;
  loadSettings();

  $('btnStart').onclick = () => { H.unlock(); buildCharCards(); showScreen('charsel'); };
  $('btnCodex').onclick = () => { H.unlock(); buildCodex(); showScreen('codex'); };
  $('btnSettings').onclick = () => { H.unlock(); buildSettings(); showScreen('settings'); };
  $('btnBackMenu').onclick = () => H.backToMenu();
  $('pauseBtn').onclick = () => H.togglePause();
  document.querySelectorAll('.back-btn').forEach((b) => {
    b.onclick = () => showScreen(b.dataset.back);
  });
}

// ———— 角色 / 模式选择 ————
let pickedChar = null;
function buildCharCards() {
  const wrap = $('charCards');
  wrap.innerHTML = '';
  for (const c of CHARACTERS) {
    const el = document.createElement('button');
    el.className = 'pick-card';
    el.innerHTML = `<h3>${c.name}</h3><div class="tagline">${c.tagline}</div><div class="desc">${c.desc}</div>`;
    el.onclick = () => { pickedChar = c; buildModeCards(); showScreen('modesel'); };
    wrap.appendChild(el);
  }
}
function buildModeCards() {
  const wrap = $('modeCards');
  wrap.innerHTML = '';
  for (const m of MODES) {
    const el = document.createElement('button');
    el.className = 'pick-card';
    el.innerHTML = `<h3>${m.name}</h3><div class="tagline">${m.tagline}</div><div class="desc">${m.desc}</div>`;
    el.onclick = () => H.startRun(pickedChar, m);
    wrap.appendChild(el);
  }
}

// ———— HUD ————
export function updateHUD(G) {
  const p = G.player;
  const hpFill = $('hpBar').querySelector('.fill');
  const hpTip = $('hpBar').querySelector('.tip');
  const hpPct = Math.max(0, p.hp / p.maxHp) * 100;
  hpFill.style.width = hpPct + '%';
  hpTip.style.left = hpPct + '%';
  const xpFill = $('xpBar').querySelector('.fill');
  const xpTip = $('xpBar').querySelector('.tip');
  const xpPct = Math.min(100, (p.xp / G.xpNeeded) * 100);
  xpFill.style.width = xpPct + '%';
  xpTip.style.left = xpPct + '%';
  $('realmText').textContent = `${REALMS[p.realm].name}${CN_NUM[p.realmSub - 1]}层 · Lv.${p.level}`;
  $('timeText').textContent = fmtTime(G.time);
  $('killText').textContent = `斩 ${G.kills}`;
  // 连斩：白→金→赤
  const cb = $('comboBox');
  if (G.combo >= 3 && G.comboT > 0) {
    cb.classList.add('on');
    $('comboNum').textContent = G.combo;
    $('comboNum').style.color = G.combo >= 50 ? '#FF7A6E' : G.combo >= 15 ? '#FFD890' : '#E8E2D0';
  } else cb.classList.remove('on');
  // 妖王血条
  const bw = $('bossBarWrap');
  if (G.activeBoss && G.activeBoss.dying <= 0) {
    bw.classList.add('on');
    $('bossName').textContent = G.activeBoss.name;
    $('bossBar').querySelector('.fill').style.width = Math.max(0, G.activeBoss.hp / G.activeBoss.maxHp * 100) + '%';
  } else bw.classList.remove('on');
}

// ———— 升级选卡 ————
export function showLevelUp(cards, realmLabel, onPick) {
  $('luRealm').textContent = realmLabel;
  const wrap = $('luCards');
  wrap.innerHTML = '';
  cards.forEach((card) => {
    const el = document.createElement('button');
    el.className = 'lu-card' + (card.gold ? ' gold' : '') + (card.evo ? ' evo' : '');
    el.innerHTML = `<span class="kind">${card.kind}</span><h3>${card.name}${card.lvLabel ? `<span class="lv">${card.lvLabel}</span>` : ''}</h3><div class="desc">${card.desc}</div>`;
    el.onclick = () => onPick(card);
    wrap.appendChild(el);
  });
  showScreen('levelup');
}

// ———— 横幅（书法大字，笔画错时浮现）————
export function banner(chars, sub = '', cls = '') {
  const layer = $('bannerLayer');
  layer.innerHTML = ''; // 同屏只保留最新一条横幅，避免演出叠字
  const el = document.createElement('div');
  el.className = 'banner-v ' + cls;
  el.innerHTML = [...chars].map((c, i) => `<span style="animation-delay:${i * 0.12}s">${c}</span>`).join('');
  layer.appendChild(el);
  let subEl = null;
  if (sub) {
    subEl = document.createElement('div');
    subEl.className = 'banner-sub';
    subEl.textContent = sub;
    layer.appendChild(subEl);
  }
  setTimeout(() => { el.remove(); subEl && subEl.remove(); }, 2700);
}
export function letterbox(on) {
  $('letterbox').classList.toggle('on', on);
}

// ———— 结算 ————
export function showResult({ won, grade, level, kills, time, realm, mode }) {
  $('resultTitle').textContent = won ? '飞 升' : '道 陨';
  $('resultTitle').className = won ? 'gold' : 'dead';
  $('resultTitle').id = 'resultTitle';
  $('gradeSeal').textContent = grade;
  $('resultStats').innerHTML = [
    `证道之途<b>${mode}</b>`,
    `境界修为<b>${realm} · Lv.${level}</b>`,
    `斩妖除魔<b>${kills}</b>`,
    `行道时长<b>${fmtTime(time)}</b>`,
  ].join('<br>');
  showScreen('result');
}

// ———— 图鉴 ————
function buildCodex() {
  const el = $('codexPanel');
  let html = '';
  html += `<div class="codex-sec"><h4>术法 · 七式</h4>`;
  for (const id in WEAPONS) {
    const w = WEAPONS[id];
    const evos = Object.entries(w.evoNotes).map(([lv, n]) => `${lv}重✦${n}`).join(' / ');
    html += `<div class="codex-item"><b>${w.name}</b>（至${w.maxLv}重）— ${w.desc}<br><span style="opacity:0.65">${evos}</span></div>`;
  }
  html += `</div><div class="codex-sec"><h4>禁术 · 七绝</h4>`;
  for (const id in FORBIDDEN) {
    const f = FORBIDDEN[id];
    html += `<div class="codex-item gold"><b>${f.name}</b> — 需【${WEAPONS[f.weapon].name}】满重 + 【${PASSIVES[f.passive].name}】三重。${f.desc}</div>`;
  }
  html += `</div><div class="codex-sec"><h4>心法 · 六诀</h4>`;
  for (const id in PASSIVES) {
    const ps = PASSIVES[id];
    html += `<div class="codex-item"><b>${ps.name}</b>（至${ps.maxLv}重）— ${ps.desc}</div>`;
  }
  html += `</div><div class="codex-sec"><h4>神通 · 境界觉醒</h4>`;
  for (const r of REALMS) {
    if (!r.power) continue;
    html += `<div class="codex-item"><b>${r.name} · ${r.powerName}</b> — ${r.powerDesc}</div>`;
  }
  html += `</div><div class="codex-sec"><h4>道果 · 五味</h4>`;
  for (const d of DAOFRUITS) {
    html += `<div class="codex-item"><b>${d.name}</b> — ${d.desc}（功法悟尽后可无限采撷）</div>`;
  }
  html += `</div>`;
  el.innerHTML = html;
}

// ———— 设置 ————
function buildSettings() {
  const el = $('settingsPanel');
  el.innerHTML = '';
  const row = (label, ctl) => {
    const r = document.createElement('div');
    r.className = 'set-row';
    r.innerHTML = `<span>${label}</span>`;
    const c = document.createElement('div');
    c.className = 'ctl';
    c.appendChild(ctl);
    r.appendChild(c);
    el.appendChild(r);
  };
  const toggle = (key, apply) => {
    const b = document.createElement('button');
    const paint = () => { b.textContent = settings[key] ? '开' : '关'; b.classList.toggle('on', !!settings[key]); };
    paint();
    b.onclick = () => { settings[key] = !settings[key]; paint(); saveSettings(); apply && apply(); };
    return b;
  };
  const slider = (key, apply) => {
    const s = document.createElement('input');
    s.type = 'range'; s.min = 0; s.max = 1; s.step = 0.05;
    s.value = settings[key];
    s.oninput = () => { settings[key] = parseFloat(s.value); saveSettings(); apply && apply(); };
    return s;
  };
  row('震屏', toggle('shake'));
  row('伤害数字', toggle('dmgNumbers'));
  // 皮肤切换：经典绘制 / 素材皮肤
  const swrap = document.createElement('div');
  swrap.className = 'ctl';
  for (const [val, name] of [['classic', '经典绘制'], ['assets', '素材皮肤']]) {
    const b = document.createElement('button');
    b.textContent = name;
    b.classList.toggle('on', settings.skin === val);
    b.onclick = () => {
      settings.skin = val;
      saveSettings();
      swrap.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
    };
    swrap.appendChild(b);
  }
  const sr = document.createElement('div');
  sr.className = 'set-row';
  sr.innerHTML = '<span>角色皮肤</span>';
  sr.appendChild(swrap);
  el.appendChild(sr);
  // 画质档
  const qwrap = document.createElement('div');
  qwrap.className = 'ctl';
  const opts = [['auto', '自适应'], [0, '极'], [1, '高'], [2, '中']];
  for (const [val, name] of opts) {
    const b = document.createElement('button');
    b.textContent = name;
    const paint = () => b.classList.toggle('on', settings.quality === val);
    paint();
    b.onclick = () => {
      settings.quality = val;
      saveSettings();
      qwrap.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      H.qualityChanged();
    };
    qwrap.appendChild(b);
  }
  const r = document.createElement('div');
  r.className = 'set-row';
  r.innerHTML = '<span>画质</span>';
  r.appendChild(qwrap);
  el.appendChild(r);
  row('音效音量', slider('sfxVol', () => H.volumeChanged('sfx', settings.sfxVol)));
  row('音乐音量', slider('bgmVol', () => H.volumeChanged('bgm', settings.bgmVol)));
}

// ———— 调试面板 ————
let debugOn = false;
export function toggleDebug() {
  debugOn = !debugOn;
  $('debug').style.display = debugOn ? 'block' : 'none';
}
export function setDebug(txt) {
  if (debugOn) $('debug').textContent = txt;
}
export const isDebug = () => debugOn;
