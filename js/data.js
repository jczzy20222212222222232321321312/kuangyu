/* 矿域 矿域 — static world data & economy defaults */
(function () {
'use strict';
const ORE = (window.ORE = window.ORE || {});

const CLANS = [
  {
    key: 'tide', name: '南极王国', en: 'ANTARCTIC', color: '#58b7dc', fg: '#001319',
    bonus: '守御 +12%', bonusShort: 'DEF +12%', angle: -Math.PI / 6,
    lore: '南极冰海上的王国。蓝冰为城，深海为壕，守住极昼下的最后一道冰墙。',
    perk: '你驻防在所有地块的士兵防御 +12%。',
    sigil: 'M50 6 L82 33 L66 51 L90 74 L54 94 L38 64 L12 80 L20 40 L6 24 Z',
  },
  {
    key: 'ember', name: '森林王国', en: 'FOREST', color: '#57a35f', fg: '#001006',
    bonus: '攻击 +10%', bonusShort: 'ATK +10%', angle: Math.PI / 2,
    lore: '巨木与藤蔓之下的森林王国。每一棵古树都是一座瞭望塔。',
    perk: '你派出的所有进攻部队攻击力 +10%。',
    sigil: 'M50 5 L88 27 L78 57 L52 95 L22 72 L12 30 Z',
  },
  {
    key: 'dune', name: '沙漠王国', en: 'DESERT', color: '#d8a83f', fg: '#1b1000',
    bonus: '提取 +12%', bonusShort: 'EXTRACT +12%', angle: Math.PI * 1.17,
    lore: '金色沙海与土山之间的商队王国。风把城墙磨成沙，也把矿脉吹到地表。',
    perk: '每名士兵的提取额度 +12%，烧兵取矿更划算。',
    sigil: 'M50 4 L63 33 L94 40 L72 62 L80 94 L51 76 L22 92 L30 60 L6 38 L36 30 Z',
  },
];
const CLAN = Object.fromEntries(CLANS.map((c) => [c.key, c]));

const TIERS = [
  { name: '新兵', en: 'RECRUIT', color: '#3b3b3b', fg: '#ece9e1', mult: 1.0 },
  { name: '老兵', en: 'VETERAN', color: '#e6e2d8', fg: '#000', mult: 1.12 },
  { name: '精锐', en: 'CAPTAIN', color: '#fec23e', fg: '#000', mult: 1.27 },
  { name: '统领', en: 'WARLORD', color: '#ff5b45', fg: '#000', mult: 1.45 },
  { name: '传奇', en: 'GENESIS', color: '#d6a7ff', fg: '#000', mult: 1.7 },
];
const TIER_W = [0.44, 0.30, 0.15, 0.085, 0.025];

const CLASSES = [
  { key: 'vanguard', name: '先锋', icon: '刃', atk: 10, def: 2, spd: 4 },
  { key: 'raider', name: '游骑', icon: '骑', atk: 4, def: 0, spd: 13 },
  { key: 'guard', name: '盾卫', icon: '盾', atk: 0, def: 15, spd: -2 },
  { key: 'archer', name: '弓手', icon: '弓', atk: 8, def: 2, spd: 6 },
  { key: 'warlock', name: '术士', icon: '术', atk: 6, def: 6, spd: 3 },
];
const CLASS = Object.fromEntries(CLASSES.map((c) => [c.key, c]));

const SURNAMES = ['铁', '霜', '烬', '沙', '石', '风', '狼', '鸦', '赤', '苍', '玄', '白', '夜', '雷', '灰', '金', '河', '山', '岚', '荒', '铜', '骨', '盐', '黑'];
const GIVEN_M = ['破军', '岩', '烬', '锋', '烈', '骁', '朔', '岳', '川', '狩', '野', '戈', '铠', '无咎', '长庚', '断岳', '燎原', '沉舟', '北望', '孤城', '铁衣', '逐日', '惊雷', '霜刃', '踏雪', '焚风'];
const GIVEN_F = ['夜莺', '霜', '月', '岚', '砂', '铃', '烟', '绫', '星', '璃', '绯', '雪', '鸢', '棠', '雾', '澜', '宁', '烬羽', '青崖', '照夜', '流萤', '寒酥', '拾光', '归雁', '银朱', '暮云'];

const ZONE_CORE = { name: '摇篮', en: 'THE CRADLE', note: '三族共同承认的中立人口出生点，不可占领。' };
const ZONE_INNER = [
  { name: '赤铁峡谷', en: 'REDIRON RIFT' },
  { name: '苍盐盆地', en: 'PALESALT BASIN' },
  { name: '古战场', en: 'OLD KILLFIELD' },
  { name: '黑曜高原', en: 'OBSIDIAN RISE' },
  { name: '断裂带', en: 'THE BREAK' },
  { name: '熔火隘口', en: 'EMBER GATE' },
];
const ZONE_MID = [
  { name: '灰烬岗', en: 'ASH MOUND' },
  { name: '铁脊岭', en: 'IRONSPINE' },
  { name: '白沙渡', en: 'WHITEFORD' },
  { name: '幽谷', en: 'HOLLOW VALE' },
  { name: '双刃关', en: 'TWINBLADE PASS' },
  { name: '碎石原', en: 'SHARDFLAT' },
  { name: '枯河床', en: 'DRYRIVER' },
  { name: '狼烟坡', en: 'WOLFSMOKE' },
  { name: '盐风台', en: 'SALTWIND' },
  { name: '残塔', en: 'BROKEN SPIRE' },
  { name: '铜环', en: 'COPPER RING' },
  { name: '暗流洼地', en: 'UNDERTOW' },
];
const ZONE_OUTER = [
  { name: '北境哨', en: 'NORTH WATCH' },
  { name: '冻土坑', en: 'FROZEN PIT' },
  { name: '黑松林', en: 'BLACKPINE' },
  { name: '孤石', en: 'LONE STONE' },
  { name: '旧矿道', en: 'OLD SHAFT' },
  { name: '赤沙丘', en: 'RED DUNE' },
  { name: '迷雾泽', en: 'MIST MARSH' },
  { name: '断桥', en: 'BROKEN BRIDGE' },
  { name: '铁砧村', en: 'ANVIL' },
  { name: '石喉', en: 'STONE THROAT' },
  { name: '风蚀谷', en: 'WINDCUT' },
  { name: '长夜营', en: 'LONGNIGHT CAMP' },
  { name: '灰湖', en: 'ASH LAKE' },
  { name: '荒骨地', en: 'BONEFIELD' },
  { name: '东望台', en: 'EASTWATCH' },
  { name: '碎星滩', en: 'STARFALL' },
  { name: '静默岭', en: 'SILENT RIDGE' },
  { name: '蛇径', en: 'SNAKE PATH' },
  { name: '深井', en: 'DEEP WELL' },
  { name: '燧石坡', en: 'FLINT SLOPE' },
  { name: '蜗牛湾', en: 'SNAIL BAY' },
  { name: '铅云坳', en: 'LEADEN HOLLOW' },
  { name: '白骨渡', en: 'BONEFORD' },
  { name: '苦泉', en: 'BITTER SPRING' },
  { name: '苔原', en: 'MOSS FLAT' },
  { name: '矮丘', en: 'LOW BARROW' },
  { name: '裂石谷', en: 'SPLITSTONE' },
  { name: '夕照原', en: 'SUNSET FIELD' },
  { name: '冻河', en: 'FROZEN RIVER' },
  { name: '铁锈沼', en: 'RUST MIRE' },
  { name: '双生峰', en: 'TWIN PEAKS' },
  { name: '暗礁', en: 'BLACK REEF' },
  { name: '黄土岗', en: 'LOESS RIDGE' },
  { name: '冷杉沟', en: 'FIR GULCH' },
  { name: '雷击木', en: 'STRUCK TREE' },
  { name: '盐碱地', en: 'SALT FLAT' },
  { name: '石棺', en: 'STONE COFFIN' },
  { name: '鹰巢', en: 'EYRIE' },
  { name: '低语洞', en: 'WHISPER CAVE' },
  { name: '边界碑', en: 'BOUNDARY STONE' },
  { name: '荒井', en: 'DRY WELL' },
  { name: '赤崖', en: 'RED CLIFF' },
  { name: '残旗营', en: 'TORN BANNER' },
  { name: '暗门', en: 'HIDDEN GATE' },
  { name: '泥沼', en: 'MIRE' },
];

const HEX = { size: 64, radius: 5 };
const RINGS = [
  { no: 1, label: '一环', name: '摇篮', sub: '人口出生点' },
  { no: 2, label: '二环', name: '圣域', sub: '不可侵犯' },
  { no: 3, label: '三环', name: '富矿', sub: '产量最高' },
  { no: 4, label: '四环', name: '矿脉', sub: '产量递减' },
  { no: 5, label: '五环', name: '荒野', sub: '待争夺' },
  { no: 6, label: '六环', name: '边陲', sub: '低产边境' },
];
const RING_WEIGHT = { 3: 5.2, 4: 3.0, 5: 2.0, 6: 1.3 };
const SAFE_SUFFIX = ['壹', '贰'];

const TERRAIN = {
  grass:      { name: '草原',     color: '#4f6b3a', light: '#7b9952', dark: '#2b3d25' },
  mountain:   { name: '山脉',     color: '#6d685e', light: '#a39a89', dark: '#3b3933' },
  river:      { name: '江河',     color: '#2d6270', light: '#67b0bd', dark: '#173840', ground: '#4d6339' },
  desert:     { name: '沙漠',     color: '#b08a54', light: '#ddb97a', dark: '#74552f' },
  snow:       { name: '雪山',     color: '#c6d5da', light: '#f3f8f8', dark: '#75909b' },
  plateau:    { name: '高原',     color: '#8a6a4c', light: '#b99368', dark: '#513c2b' },
  rainforest: { name: '热带雨林', color: '#255033', light: '#4b8358', dark: '#10291c' },
  lake:       { name: '湖泊',     color: '#245b6a', light: '#5fa6b5', dark: '#10323e', ground: '#4d6339' },
};

const ECON = {
  emissionStart: 600,
  emissionFloor: 350,
  emissionDecayHours: 6,
  chestCap: 12000,
  aiChestCap: 18000,
  extractBase: 80,
  extractAtk: 1.6,
  extractDef: 0.8,
  extractTier: 22,
  breedBase: 120,
  breedStep: 35,
  breedBurn: 0.7,
  marryCost: 30,
  marriageBurn: 0.5,
  gestation: 45000,
  breedCooldown: 86400000,
  fertilityMin: 3,
  fertilityMax: 5,
  fortCosts: [0, 60, 140, 260, 420, 640],
  fortDef: 58,
  fortMax: 5,
  marketFee: 0.06,
  feeLp: 0.4,
  feeBurn: 0.3,
  feeTreasury: 0.3,
  swapFee: 0.01,
  totalSupply: 100000000,
  minePoolInitial: 80000000,
  minePoolDailyRate: 0.01,
  dayMs: 86400000,
  startOre: 10000,
  poolOre: 12000000,
  poolEth: 20,
  treasuryOre: 8000000,
  treasuryEth: 2,
  startEth: 2.4,
  graceMs: 180000,
  coreMilitia: 120,
  playerStartZones: 10,
  playerGarrison: 4,
  aiStartZones: 10,
  aiGarrison: 4,
};

function sigilSvg(key, cls) {
  const c = CLAN[key] || CLANS[0];
  return '<svg class="' + (cls || '') + '" viewBox="0 0 100 100" aria-hidden="true"><path d="' + c.sigil + '" fill="currentColor"/></svg>';
}
function markSvg(color) {
  return '<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,4 92,32 76,92 24,94 6,38" fill="' + (color || '#fec23e') + '"/><polygon points="50,22 74,40 64,76 36,78 26,44" fill="#000"/></svg>';
}

ORE.data = {
  CLANS, CLAN, TIERS, TIER_W, CLASSES, CLASS, ECON, TERRAIN,
  SURNAMES, GIVEN_M, GIVEN_F,
  ZONE_CORE, ZONE_INNER, ZONE_MID, ZONE_OUTER,
  HEX, RINGS, RING_WEIGHT, SAFE_SUFFIX,
  sigilSvg, markSvg,
};
})();
