// ============================================================
// 全部数值配置。改手感只改这里。
// ============================================================

// ———— 主色板 ————
export const C = {
  ink: '#0D1216',      // 墨底
  paper: '#1A222B',    // 宣纸灰
  rice: '#E8E2D0',     // 米白
  gold: '#FFD890',     // 灵金
  jian: '#9FD8BC',     // 剑青
  jie: '#C8A0FF',      // 劫紫
  ice: '#BCE8F0',      // 冰蓝
  ghost: '#7FE098',    // 幽绿
  blood: '#C75450',    // 血红
  ember: '#FF9E6B',    // 火橙（三昧真火基色）
};

// ———— 画质档 ————
// 采样近 5 秒平均帧率，<50fps 自动降档；设置里可手动锁定。
export const QUALITY = [
  { name: '极', particleCap: 1400, glowScale: 0.5, envLayers: 3, fogCount: 7, decalCap: 160 },
  { name: '高', particleCap: 850, glowScale: 0.4, envLayers: 2, fogCount: 4, decalCap: 100 },
  { name: '中', particleCap: 450, glowScale: 0.33, envLayers: 1, fogCount: 2, decalCap: 60 },
];

// ———— 经验曲线 ————
export const xpNeed = (lv) => Math.floor(4 + lv * 2.4 + Math.pow(lv, 1.62) * 0.55);
export const XP_INFLATION_PER_MIN = 0.09; // 敌人经验值每分钟 +9%

// ———— 境界 ————
// 每大境界九层；跨大境界触发突破演出并永久觉醒神通。
export const REALMS = [
  { name: '炼气', power: null, light: 120 },
  { name: '筑基', power: 'shield', powerName: '灵气护盾', powerDesc: '每10秒凝聚一层护盾，抵挡一次伤害', light: 140 },
  { name: '金丹', power: 'nova', powerName: '金丹震爆', powerDesc: '每8秒释放金色冲击波，击退并伤害周围敌人', light: 160 },
  { name: '元婴', power: 'avatar', powerName: '元婴出窍', powerDesc: '元婴绕体飞行，自动发射神念弹', light: 180 },
  { name: '化神', power: 'field', powerName: '神念领域', powerDesc: '大范围神念压制，域内敌人减速40%', light: 205 },
  { name: '炼虚', power: 'swordrain', powerName: '虚空剑雨', powerDesc: '每5秒天降一轮虚空剑雨', light: 230 },
  { name: '合体', power: 'unity', powerName: '天人合一', powerDesc: '伤害+30%，冷却-20%，周身金光', light: 255 },
  { name: '大乘', power: 'chainthunder', powerName: '雷劫缠身', powerDesc: '每4.5秒引下紫色链电，跳跃6次', light: 280 },
  { name: '渡劫', power: 'undying', powerName: '不死金身', powerDesc: '道陨时以金身复活一次并清扫全场', light: 305 },
  { name: '真仙', power: 'immortal', powerName: '仙威盖世', powerDesc: '全属性增幅+50%', light: 340 },
];
export const REALM_SUBS = 9; // 每大境界层数
export const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

// ———— 角色 ————
export const CHARACTERS = [
  {
    id: 'jianchenzi', name: '剑尘子', tagline: '起始功法 · 御剑术',
    desc: '一生只磨一剑。伤害提升 15%。',
    startWeapon: 'sword', mods: { dmg: 1.15 },
  },
  {
    id: 'zidian', name: '紫电真人', tagline: '起始功法 · 天雷引',
    desc: '身负天雷体质。冷却缩减 15%，移速 +8%。',
    startWeapon: 'thunder', mods: { cd: 0.85, spd: 1.08 },
  },
  {
    id: 'xuanyue', name: '玄岳居士', tagline: '起始功法 · 护体罡气',
    desc: '稳如玄岳。生命 +50，每秒回复 1 点，移速 -8%。',
    startWeapon: 'aura', mods: { hp: 50, regen: 1, spd: 0.92 },
  },
];

// ———— 模式 ————
export const MODES = [
  {
    id: 'zhengdao', name: '证道之途', tagline: '20分钟 · 天劫结局',
    desc: '坚持二十分钟，迎战天劫化身，斩之即可飞升。',
    duration: 1200, hpMul: 1, dmgMul: 1, xpMul: 1, hasEnding: true,
  },
  {
    id: 'wujin', name: '无尽妖渊', tagline: '无终点 · 强度爬升',
    desc: '没有天劫，也没有尽头。二十分钟后妖潮强度持续攀升，直至道陨。',
    duration: Infinity, hpMul: 1, dmgMul: 1, xpMul: 1, hasEnding: false,
  },
  {
    id: 'xiuluo', name: '修罗炼狱', tagline: '敌血×1.6 伤害×1.5 · 灵气+35%',
    desc: '妖属尽出的炼狱。承受更强的妖物，收获更快的修行。',
    duration: 1200, hpMul: 1.6, dmgMul: 1.5, xpMul: 1.35, hasEnding: true,
  },
];

// ———— 武器（7种，同时最多5种）————
// 每级数值走 scale；vis 里的重数触发视觉质变（升级界面用 ✦ 标注）。
export const MAX_WEAPONS = 5;
export const WEAPONS = {
  sword: {
    name: '御剑术', maxLv: 8, color: C.rice,
    desc: '祭出追踪飞剑，斩尽近前之敌。',
    evoNotes: { 3: '剑迹拖尾', 5: '命中涟漪', 7: '飞剑淬金' },
    base: { cd: 1.1, dmg: 9, count: 1, speed: 380, pierce: 1 },
    perLv: { dmg: 3.4, count: 0.5, cd: -0.05 }, // count 累计取整
  },
  orbit: {
    name: '剑气环身', maxLv: 7, color: C.jian,
    desc: '剑气环绕周身，触之即溃。',
    evoNotes: { 3: '剑刃残影', 5: '转金火花', 7: '外圈反向第二环' },
    base: { cd: 0, dmg: 6, count: 2, radius: 78, rotSpeed: 2.6 },
    perLv: { dmg: 2.2, count: 0.65, radius: 6 },
  },
  thunder: {
    name: '天雷引', maxLv: 7, color: C.gold,
    desc: '引九天之雷，殛落妖群。',
    evoNotes: { 3: '落雷冲击环', 5: '雷光染紫', 7: '雷链跳跃' },
    base: { cd: 1.9, dmg: 16, count: 1, splash: 60 },
    perLv: { dmg: 5.5, count: 0.5, cd: -0.12, splash: 5 },
  },
  aura: {
    name: '护体罡气', maxLv: 7, color: C.gold,
    desc: '罡气灼烧近身之敌。',
    evoNotes: { 3: '八卦符文', 5: '灼热荡波', 7: '太极虚影' },
    base: { cd: 0.5, dmg: 3.5, radius: 95 },
    perLv: { dmg: 1.6, radius: 10 },
  },
  fire: {
    name: '三昧真火', maxLv: 7, color: C.ember,
    desc: '口吐三昧真火，焚尽前路。',
    evoNotes: { 3: '余烬坠地', 5: '火转青焰', 7: '命中生青莲焚地' },
    base: { cd: 1.6, dmg: 4, duration: 0.9, arc: 0.62, range: 190 },
    perLv: { dmg: 1.5, range: 14, arc: 0.05 },
  },
  ice: {
    name: '寒冰诀', maxLv: 7, color: C.ice,
    desc: '冰棱穿刺，寒气蚀骨减速。',
    evoNotes: { 3: '碎冰溅射', 5: '概率冻结', 7: '霜华减速圈' },
    base: { cd: 1.35, dmg: 8, count: 2, speed: 430, slow: 0.4, slowDur: 1.6 },
    perLv: { dmg: 2.6, count: 0.5, cd: -0.06 },
  },
  ghost: {
    name: '幽冥鬼火', maxLv: 7, color: C.ghost,
    desc: '放出幽冥鬼火，索命不休。',
    evoNotes: { 3: '冥焰曳尾', 5: '命中分裂', 7: '强化追索' },
    base: { cd: 1.5, dmg: 7, count: 1, speed: 250, turn: 3.2 },
    perLv: { dmg: 2.4, count: 0.55, cd: -0.07 },
  },
};

// ———— 心法（各5重）————
export const PASSIVES = {
  jinshen: { name: '不灭金身', maxLv: 5, desc: '每重生命上限 +25', per: { hp: 25 } },
  tayun: { name: '踏云步', maxLv: 5, desc: '每重移速 +12%', per: { spd: 0.12 } },
  guixi: { name: '龟息诀', maxLv: 5, desc: '每重每秒回复 +1.5', per: { regen: 1.5 } },
  shenshi: { name: '神识扩展', maxLv: 5, desc: '每重灵气吸取范围 +40%', per: { magnet: 0.4 } },
  wudao: { name: '悟道', maxLv: 5, desc: '每重伤害 +15%', per: { dmg: 0.15 } },
  lingxi: { name: '灵犀诀', maxLv: 5, desc: '每重冷却 -10%', per: { cd: 0.10 } },
};

// ———— 禁术（超武）————
// 武器满重 + 指定心法≥3重后出金框卡，觉醒带全屏演出。
export const FORBIDDEN = {
  zhuxian: {
    name: '诛仙剑阵', weapon: 'sword', passive: 'wudao', color: C.gold,
    desc: '御剑齐射翻倍，四柄巨型金剑绕体，每5秒八方剑爆。',
  },
  wanjian: {
    name: '万剑天罗', weapon: 'orbit', passive: 'jinshen', color: C.gold,
    desc: '三环巨剑反向旋转，剑域之内众妖皆缓。',
  },
  shenfa: {
    name: '九天神罚', weapon: 'thunder', passive: 'lingxi', color: C.jie,
    desc: '头顶凝聚雷云，每0.4秒自动降下一道劫雷。',
  },
  hunyuan: {
    name: '混元道场', weapon: 'aura', passive: 'guixi', color: C.gold,
    desc: '罡气范围×1.8，域内击杀回复生命，巨型太极镇压。',
  },
  huolong: {
    name: '焚世火龙', weapon: 'fire', passive: 'tayun', color: C.ember,
    desc: '召出焚世火龙实体，自动索敌，所过之处皆成焦土。',
  },
  bingfeng: {
    name: '冰封千里', weapon: 'ice', passive: 'shenshi', color: C.ice,
    desc: '每9秒冰封全屏2秒，天地失色，冰闪夺目。',
  },
  huangquan: {
    name: '黄泉引路', weapon: 'ghost', passive: 'wudao', color: C.ghost,
    desc: '鬼火数量×2，命中必定分裂，黄泉之火燎原。',
  },
};

// ———— 道果（功法悟尽后的无限兜底，任何时刻必有三张卡）————
export const DAOFRUITS = [
  { id: 'df_dmg', name: '力道果', desc: '伤害 +5%', apply: (p) => { p.stats.dmg += 0.05; } },
  { id: 'df_hp', name: '生道果', desc: '生命上限 +15，并回复 60', apply: (p) => { p.maxHp += 15; p.hp = Math.min(p.maxHp, p.hp + 60); } },
  { id: 'df_cd', name: '疾道果', desc: '冷却 -3%', apply: (p) => { p.stats.cd = Math.max(0.25, p.stats.cd - 0.03); } },
  { id: 'df_spd', name: '风道果', desc: '移速 +5%，吸取 +10%', apply: (p) => { p.stats.spd += 0.05; p.stats.magnet += 0.1; } },
  { id: 'df_regen', name: '春道果', desc: '每秒回复 +0.5，回复 8', apply: (p) => { p.stats.regen += 0.5; p.hp = Math.min(p.maxHp, p.hp + 8); } },
];

// ———— 敌人 ————
// 属性随分钟膨胀；spawnInterval 随时间收紧（下限 0.14s）。
export const ENEMY_TYPES = {
  swift: { hp: 6, spd: 118, dmg: 5, xp: 1, r: 10, color: '#7A8894', weight: 3 },
  normal: { hp: 14, spd: 74, dmg: 9, xp: 2, r: 13, color: '#5E6E7A', weight: 4 },
  elite: { hp: 85, spd: 52, dmg: 16, xp: 8, r: 20, color: '#8A6E9E', weight: 1 },
};
export const ENEMY_SCALE_PER_MIN = { hp: 0.32, dmg: 0.11, spd: 0.012 }; // 每分钟乘性增幅
export const SPAWN = {
  baseInterval: 0.62, minInterval: 0.14, tightenPerMin: 0.06,
  maxAlive: 320, // 同屏上限（性能护栏）
  openingBurst: 8, // 开局立即冒出的一小波，画面不空场
};

// ———— 妖王（每60秒）————
export const BOSS_NAMES = ['赤目狼王', '玄鳞蟒君', '白骨将军', '青面修罗', '幽泉鬼母', '铁背妖猿', '血翼蝠王', '九尾灵狐', '碧眼雷狮', '万年尸魈', '墨蛟真妖', '啸月天狼', '腐骨毒尊', '金瞳貔貅', '夜叉罗刹', '沉渊龟圣', '焚天鸦皇', '寒潭蛇姬', '崩山犀魔'];
export const BOSS = {
  interval: 60, hpBase: 320, hpPerMin: 260, spd: 60, dmg: 22, r: 30, xp: 40,
};

// ———— 妖潮（每150秒环形包围）————
export const HORDE = { interval: 150, baseCount: 26, perWave: 10 };

// ———— 天劫（证道/修罗 第18分钟警告，第20分钟降临）————
export const TRIBULATION = {
  warnAt: 1080, arriveAt: 1200,
  hpBase: 9000, hpPerLevel: 260,
  spd: 46, dmg: 30, r: 44,
  ringCd: 5.5, ringBullets: 26, bulletSpd: 150,
  dashCd: 8, summonCd: 12,
};

// ———— 拾取物 ————
export const PICKUP = { gemR: 6, magnetBase: 70, healAmount: 25, healChance: 0.025 };

// ———— 结算评级 ————
// 依等级 / 击杀 / 是否一命通关：SS 需要通关 + 未用复活 + 等级≥55。
export const gradeOf = (won, level, kills, usedRevive) => {
  if (won && !usedRevive && level >= 55) return 'SS';
  if (won && level >= 45) return 'S';
  if (won || level >= 40 || kills >= 2600) return 'A';
  return 'B';
};
