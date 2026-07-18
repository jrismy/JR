// 程序化音频：Web Audio 全合成，无外部文件。
// 音效经 sfxGain，BGM 经 bgmGain，可分别调音量。
let ac = null;
let sfxGain = null, bgmGain = null;
let noiseBuf = null;
export const volumes = { sfx: 0.7, bgm: 0.5 };
let bgmTimer = 0, bgmRunning = false, tense = false;
let droneOscs = [];

function ensureCtx() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { return false; }
  sfxGain = ac.createGain(); sfxGain.gain.value = volumes.sfx; sfxGain.connect(ac.destination);
  bgmGain = ac.createGain(); bgmGain.gain.value = volumes.bgm; bgmGain.connect(ac.destination);
  // 白噪 buffer 复用
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}
export function unlockAudio() { ensureCtx(); }
export function setVolume(kind, v) {
  volumes[kind] = v;
  if (!ac) return;
  (kind === 'sfx' ? sfxGain : bgmGain).gain.value = v;
}

// ———— 基础合成积木 ————
function env(g, t0, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
}
function osc(type, f0, f1, t0, dur, peak, dest) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  env(g, t0, 0.005, peak, dur);
  o.connect(g).connect(dest);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(t0, dur, peak, filterFreq, dest, type = 'lowpass') {
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
  const g = ac.createGain();
  env(g, t0, 0.003, peak, dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t0); src.stop(t0 + dur + 0.05);
}

// ———— 音效 ————
let lastHit = 0;
export const sfx = {
  hit() { // 短噪声爆（限频防轰炸）
    if (!ac) return;
    const t = ac.currentTime;
    if (t - lastHit < 0.045) return;
    lastHit = t;
    noise(t, 0.07, 0.16, 900, sfxGain);
  },
  sword() { if (!ac) return; osc('sawtooth', 1400, 3400, ac.currentTime, 0.1, 0.05, sfxGain); },
  thunder() {
    if (!ac) return;
    const t = ac.currentTime;
    noise(t, 0.35, 0.5, 220, sfxGain);
    noise(t, 0.14, 0.3, 3800, sfxGain, 'highpass');
    osc('sine', 90, 42, t, 0.4, 0.5, sfxGain);
  },
  ice() { if (!ac) return; const t = ac.currentTime; noise(t, 0.12, 0.22, 5200, sfxGain, 'highpass'); osc('triangle', 2100, 3600, t, 0.08, 0.06, sfxGain); },
  fire() { if (!ac) return; noise(ac.currentTime, 0.3, 0.1, 600, sfxGain); },
  ghost() { if (!ac) return; osc('sine', 700, 320, ac.currentTime, 0.3, 0.08, sfxGain); },
  pickup() { if (!ac) return; osc('sine', 900, 1500, ac.currentTime, 0.08, 0.07, sfxGain); },
  hurt() { if (!ac) return; const t = ac.currentTime; osc('square', 190, 90, t, 0.16, 0.16, sfxGain); noise(t, 0.1, 0.2, 500, sfxGain); },
  levelup() { // 五声音阶上行琶音
    if (!ac) return;
    const t = ac.currentTime;
    [523.25, 587.33, 659.25, 783.99, 880].forEach((f, i) =>
      osc('triangle', f, f, t + i * 0.07, 0.35, 0.12, sfxGain));
  },
  breakthrough() { // 钟声 = 多正弦叠加长衰减
    if (!ac) return;
    const t = ac.currentTime;
    [220, 331, 442, 553, 664].forEach((f, i) =>
      osc('sine', f, f * 0.985, t, 2.4 - i * 0.3, 0.22 / (i + 1), sfxGain));
  },
  bossWarn() {
    if (!ac) return;
    const t = ac.currentTime;
    osc('sawtooth', 68, 62, t, 0.9, 0.22, sfxGain);
    osc('sawtooth', 71, 64, t, 0.9, 0.22, sfxGain);
  },
  nova() { if (!ac) return; const t = ac.currentTime; osc('sine', 300, 60, t, 0.5, 0.3, sfxGain); noise(t, 0.3, 0.25, 400, sfxGain); },
  gong() { // 洪钟：低频泛音长衰减 + 槌击噪声
    if (!ac) return;
    const t = ac.currentTime;
    [150, 226, 302, 449].forEach((f, i) =>
      osc('sine', f, f * 0.985, t, 1.1 - i * 0.18, 0.22 / (i + 1), sfxGain));
    noise(t, 0.06, 0.2, 800, sfxGain);
  },
  qin() { // 琴音：两声快拨
    if (!ac) return;
    const t = ac.currentTime;
    osc('triangle', 660, 654, t, 0.4, 0.12, sfxGain);
    osc('triangle', 990, 981, t + 0.07, 0.35, 0.09, sfxGain);
  },
  freeze() { if (!ac) return; const t = ac.currentTime; noise(t, 0.5, 0.3, 6000, sfxGain, 'highpass'); osc('sine', 2800, 900, t, 0.5, 0.1, sfxGain); },
  ascend() {
    if (!ac) return;
    const t = ac.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      osc('sine', f, f, t + i * 0.16, 1.8, 0.14, sfxGain));
    noise(t, 2.2, 0.06, 2000, sfxGain, 'highpass');
  },
};

// ———— BGM：程序化五声音阶散板 ————
// 宫商角徵羽 (C D E G A)；天劫阶段切紧张变奏（压低+加密+异音）。
const SCALE_CALM = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
const SCALE_TENSE = [220.0, 246.94, 261.63, 329.63, 349.23, 440.0, 466.16];
function pluck(freq, when, vel) {
  // 古筝式拨弦：快衰减三角波 + 轻微降调 + 低通
  const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
  o.type = 'triangle';
  o.frequency.setValueAtTime(freq, when);
  o.frequency.exponentialRampToValueAtTime(freq * 0.994, when + 1.1);
  f.type = 'lowpass'; f.frequency.setValueAtTime(3200, when);
  f.frequency.exponentialRampToValueAtTime(700, when + 1.1);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(vel, when + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 1.25);
  o.connect(f).connect(g).connect(bgmGain);
  o.start(when); o.stop(when + 1.4);
}
export function startBGM() {
  if (!ensureCtx() || bgmRunning) return;
  bgmRunning = true;
  bgmTimer = 0;
  // 低频持续垫底（两个微失谐正弦）
  [55, 55.35].forEach((f) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.value = 0.05;
    o.connect(g).connect(bgmGain);
    o.start();
    droneOscs.push({ o, g });
  });
}
export function stopBGM() {
  bgmRunning = false;
  droneOscs.forEach(({ o }) => { try { o.stop(); } catch (e) {} });
  droneOscs = [];
}
export function setTense(v) {
  if (tense === v) return;
  tense = v;
  droneOscs.forEach(({ o }, i) => { o.frequency.value = v ? [49, 49.6][i] : [55, 55.35][i]; });
}
// 每帧驱动：随机慢速散板
export function tickBGM(dtReal) {
  if (!bgmRunning || !ac) return;
  bgmTimer -= dtReal;
  if (bgmTimer <= 0) {
    const scale = tense ? SCALE_TENSE : SCALE_CALM;
    const t = ac.currentTime + 0.02;
    const n = Math.random() < 0.3 ? 2 : 1; // 偶尔双音
    for (let i = 0; i < n; i++) {
      pluck(scale[(Math.random() * scale.length) | 0] * (Math.random() < 0.15 ? 0.5 : 1),
        t + i * 0.09, 0.1 + Math.random() * 0.08);
    }
    bgmTimer = tense ? 0.5 + Math.random() * 1.1 : 0.9 + Math.random() * 2.0;
  }
}
