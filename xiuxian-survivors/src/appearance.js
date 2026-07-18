// ============================================================
// 境界外观配置表（占位配置，素材放入 assets/player/ 后自动生效）
//
// 角色 = 分层合成：
//   base(身体)  → assets/player/base_idle.png / base_run.png（单行帧序列）
//   robe(法袍)  → assets/player/robe_idle.png / robe_run.png（可按境界色调偏移）
//   accessory   → assets/player/acc_*.png（单帧饰品，部分境界佩戴）
//   aura(光环)  → 程序化绘制，走辉光层，强度/颜色由本表控制
// 任何一层素材缺失都单独回退，不影响其他层。
// ============================================================
import { C } from './data.js';

// 精灵表规格：单行帧序列，全部图层共用同一帧配置
export const SHEET = {
  idle: { frames: 4, fps: 5 },
  run: { frames: 4, fps: 10 },
  targetH: 40, // 世界单位下角色显示高度（按整数倍缩放逼近）
};

// 每个大境界的外观定义：
//   layers    使用哪些层
//   robeHue   法袍色相偏移角（基于素材原色 hue-rotate）
//   accessory 饰品文件名（null = 不佩戴）
//   aura      光环 { color, strength(0~1), radius 相对基準 }
export const REALM_LOOK = [
  { layers: ['base', 'robe'], robeHue: 0, accessory: null, aura: { color: C.jian, strength: 0.22, radius: 26 } },          // 炼气
  { layers: ['base', 'robe'], robeHue: 25, accessory: null, aura: { color: C.jian, strength: 0.3, radius: 30 } },          // 筑基
  { layers: ['base', 'robe'], robeHue: 140, accessory: 'player/acc_jindan.png', aura: { color: '#D9DFB8', strength: 0.38, radius: 35 } }, // 金丹
  { layers: ['base', 'robe'], robeHue: 165, accessory: 'player/acc_jindan.png', aura: { color: '#D9DFB8', strength: 0.44, radius: 40 } }, // 元婴
  { layers: ['base', 'robe'], robeHue: 190, accessory: 'player/acc_jindan.png', aura: { color: C.gold, strength: 0.5, radius: 46 } },     // 化神
  { layers: ['base', 'robe'], robeHue: 210, accessory: 'player/acc_heti.png', aura: { color: C.gold, strength: 0.56, radius: 52 } },      // 炼虚
  { layers: ['base', 'robe'], robeHue: 235, accessory: 'player/acc_heti.png', aura: { color: C.gold, strength: 0.64, radius: 58 } },      // 合体
  { layers: ['base', 'robe'], robeHue: 265, accessory: 'player/acc_heti.png', aura: { color: C.gold, strength: 0.72, radius: 64 } },      // 大乘
  { layers: ['base', 'robe'], robeHue: 290, accessory: 'player/acc_zhenxian.png', aura: { color: '#FFE9BC', strength: 0.82, radius: 72 } }, // 渡劫
  { layers: ['base', 'robe'], robeHue: 320, accessory: 'player/acc_zhenxian.png', aura: { color: '#FFF2CE', strength: 0.95, radius: 82 } }, // 真仙
];

// 玩家层素材清单（预加载用）
export const PLAYER_FILES = [
  'player/base_idle.png', 'player/base_run.png',
  'player/robe_idle.png', 'player/robe_run.png',
  ...new Set(REALM_LOOK.map((r) => r.accessory).filter(Boolean)),
];

// 敌人皮肤（可选，单帧；缺失回退墨团绘制）
export const ENEMY_FILES = [
  'enemies/swift.png', 'enemies/normal.png', 'enemies/elite.png', 'enemies/boss.png',
];
export const ENEMY_SKIN = {
  swift: 'enemies/swift.png',
  normal: 'enemies/normal.png',
  elite: 'enemies/elite.png',
  boss: 'enemies/boss.png',
  trib: 'enemies/boss.png',
};
