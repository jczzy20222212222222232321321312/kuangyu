#!/usr/bin/env node
/*
 * 矿域 server-authoritative shared world.
 * Run: node server/world-server.js
 *
 * Owns: map ownership, faction territory, player troops/ORE, attacks,
 * 30-second battles, recruitment, online presence and leaderboard.
 * No external dependencies.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const storage = require('./storage');
let vaultSigner = null;
function getVaultSigner() {
  if (vaultSigner) return vaultSigner;
  if (!ethers) throw new Error('ethers not installed');
  let key = process.env.CLAIM_SIGNER_KEY;
  if (!key) {
    const file = process.env.CLAIM_SIGNER_FILE || '/tmp/kuangyu-deployer.json';
    key = JSON.parse(fs.readFileSync(file, 'utf8')).privateKey;
  }
  vaultSigner = new ethers.Wallet(key);
  return vaultSigner;
}
async function rpcCall(method, params) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  let last = null;
  for (const url of RPC_URLS) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || 'RPC error');
      return j.result;
    } catch (e) { last = e; }
  }
  throw new Error('all RPCs failed: ' + (last && last.message || 'unknown'));
}

let ethers = null; try { ethers = require('ethers'); } catch (e) { console.warn('[world] ethers not installed; wallet login disabled'); }

const PORT = Number(process.env.PORT || 8091);
const HOST = process.env.HOST || '0.0.0.0';
const WORLD_SEED = Number(process.env.WORLD_SEED || 424242);
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'world.db');
const NFT_CONTRACT = (process.env.NFT_CONTRACT || '0xe097C843634536F60e4a7Dc8be7072F68101B8f8').toLowerCase();
const ORE_TOKEN = (process.env.ORE_TOKEN || '0x9765893116392d65c0455dd47944f86e6E01fd0D').toLowerCase();
const ORE_VAULT = (process.env.ORE_VAULT || '0xA25dFBC5e210301B79605dFe6FfA9bd1690d0944').toLowerCase();
const CHAIN_ID = Number(process.env.CHAIN_ID || 97);
const ORE_BURNER = (process.env.ORE_BURNER || '0x5d66191117AdAA3402FA5cAC30A79bd407ff1b8e').toLowerCase();
const ORE_MARKET = (process.env.ORE_MARKET || '0x7715A1f308ae9Cc04Fee0241708a4ef9094F2A89').toLowerCase();
const ORE_MINE_POOL = (process.env.ORE_MINE_POOL || '0x7c3F6beEFca6E46BdB6c0b6CD8177E6Fe4af81cF').toLowerCase();
const MAP_HASH = process.env.MAP_HASH || 'e9b2cfaae0c66b318c47a16c40e99d1a45ca6daa31da1d3469a3de2115f02df8';
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD'.toLowerCase();
const NFT_RPC = process.env.NFT_RPC || 'https://bsc-testnet-rpc.publicnode.com';
const RPC_URLS = (process.env.NFT_RPC_LIST || [NFT_RPC,'https://data-seed-prebsc-1-s1.binance.org:8545','https://data-seed-prebsc-2-s1.binance.org:8545','https://bsc-testnet.public.blastapi.io','https://bsc-testnet.blockpi.network/v1/rpc/public','https://rpc.ankr.com/bsc_testnet_chapel'].join(',')).split(',').map(x=>x.trim()).filter(Boolean);
let readProvider = null;
function getReadProvider() {
  if (!readProvider) readProvider = new ethers.FallbackProvider(RPC_URLS.map((url) => new ethers.JsonRpcProvider(url, 97, { staticNetwork: true })), 97, { quorum: 1 });
  return readProvider;
}

const NFT_MOCK_COUNT = process.env.NFT_MOCK_COUNT != null ? Number(process.env.NFT_MOCK_COUNT) : null;
const NFT_MOCK_IDS = process.env.NFT_MOCK_IDS ? String(process.env.NFT_MOCK_IDS).split(',').map((x) => x.trim()).filter(Boolean) : null;
const NONCE_TTL = Number(process.env.NONCE_TTL || 5 * 60 * 1000);
const CORS_ALLOW = (process.env.CORS_ORIGIN || 'http://127.0.0.1:8080,http://localhost:8080,http://192.168.10.108:8080,http://127.0.0.1:8081,http://localhost:8081').split(',').map((x) => x.trim()).filter(Boolean);
function corsOrigin(req) { const o = req.headers.origin || ''; if (!o) return ''; return CORS_ALLOW.includes('*') || CORS_ALLOW.includes(o) ? o : ''; }
const OFFLINE_MS = Number(process.env.OFFLINE_MS || 45000);
const CLAIM_COOLDOWN_MS = Number(process.env.CLAIM_COOLDOWN_MS || 1200);
const ATTACK_COOLDOWN_MS = Number(process.env.ATTACK_COOLDOWN_MS || 2200);
const BATTLE_MS = Number(process.env.BATTLE_MS || 30000);
const RECRUIT_COST = Number(process.env.RECRUIT_COST || 100);
const START_ORE = Number(process.env.START_ORE || 10000);
const START_TROOPS = Number(process.env.START_TROOPS || 10);
const TICK_MS = 1000;

const state = {
  version: 1,
  seed: WORLD_SEED,
  manifest: null,
  owners: {},
  players: {},
  battles: [],
  listings: [],
  births: [],
  garrisons: {},
  forts: {},
  vaults: {},
  pool: { ore: 0, shares: 0 },
  nextSoldierId: 1,
  events: [],
  results: [],
  defenses: {},
  startedAt: Date.now(),
  totalClaims: 0,
  lastIncomeAt: Date.now(),
  lastProductionAt: Date.now(),
  lastAIAt: Date.now(),
  minePool: 80000000,
  lastEmissionDay: '',
  dayBudget: 0,
  dayAccrualAt: 0,
  dayDistributed: 0,
  totalEmitted: 0,
  nonces: {},
  depositTxs: {},
  pendingTransfers: {},
  paymentTxs: {},
  paymentPending: {},
  recruitPending: {},
  birthPending: {},
  confirmPending: {},
  syncPending: {},
  burnPayouts: {},
};
const sseClients = new Set();
const claimAt = new Map();
const attackAt = new Map();
const ipHits = new Map();
let lastOnline = '';
let lastTickLog = 0;

async function load() {
  try {
    const raw = await storage.loadState();
    if (!raw || typeof raw !== 'object') return;
    state.version = Math.max(1, Number(raw.version) || 1);
    state.seed = Number(raw.seed) || WORLD_SEED;
    state.manifest = raw.manifest || null;
    state.owners = raw.owners && typeof raw.owners === 'object' ? raw.owners : {};
    state.players = raw.players && typeof raw.players === 'object' ? raw.players : {};
    state.battles = Array.isArray(raw.battles) ? raw.battles : [];
    state.listings = Array.isArray(raw.listings) ? raw.listings : [];
    state.births = Array.isArray(raw.births) ? raw.births : [];
    state.results = Array.isArray(raw.results) ? raw.results : [];
    state.garrisons = raw.garrisons && typeof raw.garrisons === 'object' ? raw.garrisons : {};
    state.forts = raw.forts && typeof raw.forts === 'object' ? raw.forts : {};
    state.vaults = raw.vaults && typeof raw.vaults === 'object' ? raw.vaults : {};
    state.minePool = Number(raw.minePool) || 80000000;
    state.lastEmissionDay = raw.lastEmissionDay || '';
    state.dayBudget = Number(raw.dayBudget) || 0;
    state.dayAccrualAt = Number(raw.dayAccrualAt) || 0;
    state.dayDistributed = Number(raw.dayDistributed) || 0;
    state.totalEmitted = Number(raw.totalEmitted) || 0;
    state.pool = raw.pool && typeof raw.pool === 'object' ? { ore: Number(raw.pool.ore) || 0, shares: Number(raw.pool.shares) || 0 } : { ore: 0, shares: 0 };
    state.nextSoldierId = Number(raw.nextSoldierId) || 1;
    state.events = Array.isArray(raw.events) ? raw.events.slice(-80) : [];
    state.defenses = raw.defenses && typeof raw.defenses === 'object' ? raw.defenses : {};
    state.totalClaims = Number(raw.totalClaims) || 0;
    state.nonces = raw.nonces && typeof raw.nonces === 'object' ? raw.nonces : {};
    state.depositTxs = raw.depositTxs && typeof raw.depositTxs === 'object' ? raw.depositTxs : {};
    state.pendingTransfers = raw.pendingTransfers && typeof raw.pendingTransfers === 'object' ? raw.pendingTransfers : {};
    state.paymentTxs = raw.paymentTxs && typeof raw.paymentTxs === 'object' ? raw.paymentTxs : {};
    state.paymentPending = {};
    state.recruitPending = raw.recruitPending && typeof raw.recruitPending === 'object' ? raw.recruitPending : {};
    state.birthPending = raw.birthPending && typeof raw.birthPending === 'object' ? raw.birthPending : {};
    state.confirmPending = {};
    state.syncPending = {};
    state.burnPayouts = raw.burnPayouts && typeof raw.burnPayouts === 'object' ? raw.burnPayouts : {};
    normalizePlayers();
    quarantineUnminted();
    console.log('[world] loaded', Object.keys(state.owners).length, 'tiles,', Object.keys(state.players).length, 'players');
  } catch (e) { console.error('[world] load failed', e.message); }
}
let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    storage.saveState(state).catch((e) => console.error('[world] save failed', e.message));
  }, 220);
}
function audit(kind, body) {
  storage.audit(kind, body).catch(() => {});
}
function corsHeaders(res) {
  const origin = (res && res._corsOrigin) || '';
  const h = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };
  if (origin) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  }, corsHeaders(res)));
  res.end(body);
}
function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 64);
}
function authPlayer(body) {
  const p = state.players[clean(body.playerId || body.id, 80)];
  if (!p) return { error: 'not joined' };
  if (!body.token || body.token !== p.token) return { error: 'bad session token' };
  return { player: p };
}
function nowOnline(p) {
  return p && p.lastSeen && (Date.now() - Number(p.lastSeen) < OFFLINE_MS);
}
function powerOf(p) {
  return Math.floor(p.troops + p.captures * 25 + p.kills * 10);
}
function publicPlayer(p) {
  return {
    id: p.id, name: p.name, clan: p.clan, ore: Math.floor(p.ore),
    troops: p.troops, power: p.power, kills: p.kills, captures: p.captures,
    nft: p.nft || 0, nftTokenIds: p.nftTokenIds || [], chainOre: p.chainOre == null ? null : Math.round(p.chainOre * 1e6) / 1e6, withdrawable: Math.round((p.withdrawable || 0) * 1e6) / 1e6, roster: p.roster || [], lpShares: p.lpShares || 0,
    online: nowOnline(p), joinedAt: p.joinedAt,
  };
}
function onlinePlayers() {
  return Object.values(state.players).filter(nowOnline).map(publicPlayer);
}
function economySnapshot() {
  let gameOre = 0, pockets = 0, vaults = 0;
  for (const p of Object.values(state.players)) {
    gameOre += Number(p.ore) || 0;
    for (const s of (p.roster || [])) pockets += Number(s.pocket) || 0;
  }
  for (const v of Object.values(state.vaults || {})) vaults += Number(v) || 0;
  return {
    gameOre: Math.round(gameOre), pockets: Math.round(pockets), vaults: Math.round(vaults),
    poolOre: Math.round(state.pool?.ore || 0), poolShares: Math.round(state.pool?.shares || 0),
    minePool: Math.round(state.minePool), emitted: Math.round(state.totalEmitted),
    listings: state.listings.length, players: Object.keys(state.players).length,
  };
}
function totalOwnedWeight() {
  if (!state.manifest) return 1;
  const owned = state.manifest.zones.filter((z) => z.kind === 'mine' && state.owners[String(z.id)]);
  return owned.reduce((a, z) => a + (Number(z.weight) || 1), 0) || 1;
}
function dailyBudget() { return Math.max(0, state.dayBudget || state.minePool * 0.01); }
function dailyRatePerMin(z) {
  if (!state.manifest || z.kind !== 'mine' || !state.owners[String(z.id)]) return 0;
  return dailyBudget() * (Number(z.weight) || 1) / totalOwnedWeight() / 1440;
}
function snapshot() {
  const online = onlinePlayers();
  return {
    type: 'state', version: state.version, seed: state.seed,
    owners: state.owners, defenses: state.defenses,
    garrisonCount: Object.fromEntries((state.manifest ? state.manifest.zones : []).map((z) => [String(z.id), (state.garrisons[String(z.id)] || []).length])),
    zoneStats: Object.fromEntries((state.manifest ? state.manifest.zones : []).map((z) => { const gp = garrisonPower(z.id); return [String(z.id), { rate: Number(dailyRatePerMin(z).toFixed(4)), garrison: (state.garrisons[String(z.id)] || []).length, garrisonPower: gp, vault: Number((state.vaults[String(z.id)] || 0).toFixed(2)), defense: (state.defenses[String(z.id)] || 12) + gp + Number(state.forts[String(z.id)] || 0) * 12 }]; })),
    garrisonPower: Object.fromEntries((state.manifest ? state.manifest.zones : []).map((z) => [String(z.id), garrisonPower(z.id)])),
    defensePower: Object.fromEntries((state.manifest ? state.manifest.zones : []).map((z) => [String(z.id), (state.defenses[String(z.id)] || 12) + garrisonPower(z.id) + Number(state.forts[String(z.id)] || 0) * 12])),
    garrisons: state.garrisons, forts: state.forts, vaults: state.vaults,
    listings: state.listings, births: state.births, results: state.results.slice(-20), pool: state.pool,
    players: online.sort((a, b) => b.power - a.power),
    battles: state.battles,
    economy: economySnapshot(),
    online: online.length, serverTime: Date.now(),
    totalClaims: state.totalClaims,
    events: state.events.slice(-24),
  };
}
function broadcast() {
  const payload = 'data: ' + JSON.stringify(snapshot()) + '\n\n';
  for (const res of sseClients) {
    try { res.write(payload); } catch (e) { sseClients.delete(res); }
  }
}
function addEvent(type, player, code, text) {
  state.events.push({
    id: crypto.randomBytes(6).toString('hex'),
    type, clan: player ? player.clan : null,
    player: player ? player.name : null,
    code: code || '', text: clean(text || '', 160), t: Date.now(),
  });
  if (state.events.length > 80) state.events = state.events.slice(-80);
}
function manifestHash(m) {
  if (!m || !Array.isArray(m.zones)) return '';
  return crypto.createHash('sha256').update(JSON.stringify(m.zones)).digest('hex');
}
function normalizeManifest(m) {
  if (!m || !Array.isArray(m.zones) || m.zones.length !== 240) return null;
  const zones = [];
  const seen = new Set();
  for (const z of m.zones) {
    const id = Number(z.id);
    if (!Number.isInteger(id) || id < 0 || id >= 240 || seen.has(id)) return null;
    if (!['base', 'mine'].includes(z.kind)) return null;
    const nb = Array.isArray(z.nb) ? [...new Set(z.nb.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 240 && n !== id))] : [];
    zones.push({
      id, code: clean(z.code, 8), kind: z.kind,
      home: ['tide', 'ember', 'dune'].includes(z.home) ? z.home : 'ember',
      weight: Math.max(0.1, Math.min(20, Number(z.weight) || 1)),
      pos: Array.isArray(z.pos) && z.pos.length === 3 ? z.pos.map((x) => Number(x) || 0) : null,
      nb: nb.slice(0, 12),
    });
  }
  return { zones };
}
function initOwners(manifest) {
  state.owners = {};
  state.defenses = {};
  state.garrisons = {};
  state.forts = {};
  state.vaults = {};
  for (const z of manifest.zones) {
    state.owners[String(z.id)] = z.home;
    state.defenses[String(z.id)] = z.kind === 'base' ? 9999 : 12 + (z.id % 5);
  }
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 256 * 1024) { reject(new Error('body too large')); req.destroy(); return; }
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}
function zoneOf(id) {
  return state.manifest && state.manifest.zones.find((x) => String(x.id) === String(id));
}
function canAttackFrom(player, zone, owners) {
  // Attacks must border territory owned by the player's faction.
  return zone.nb.some((n) => owners[String(n)] === player.clan);
}

const CLASSES = [
  { key: 'vanguard', name: 'Vanguard', atk: 10, def: 2, spd: 4 },
  { key: 'raider', name: 'Raider', atk: 4, def: 0, spd: 13 },
  { key: 'guard', name: 'Guard', atk: 0, def: 15, spd: -2 },
  { key: 'archer', name: 'Archer', atk: 8, def: 2, spd: 6 },
  { key: 'warlock', name: 'Warlock', atk: 6, def: 6, spd: 3 },
];
const SURNAMES = ['Tie', 'Shuang', 'Jin', 'Sha', 'Shi', 'Feng', 'Lang', 'Ya', 'Chi', 'Cang', 'Xuan', 'Bai', 'Ye', 'Lei', 'Hui', 'Jin', 'He', 'Shan', 'Lan', 'Huang', 'Tong', 'Gu', 'Yan', 'Hei'];
const GIVEN_M = ['Pojun', 'Yan', 'Jin', 'Feng', 'Lie', 'Xiao', 'Shuo', 'Yue', 'Chuan', 'Shou', 'Ye', 'Ge', 'Kai', 'Wujiu', 'Changgeng', 'Duanyue', 'Liaoyuan', 'Chenzhou', 'Beiwang', 'Gucheng', 'Tieyi', 'Zhuri', 'Jinglei', 'Shuangren', 'Taxue', 'Fenfeng'];
const GIVEN_F = ['Yeying', 'Shuang', 'Yue', 'Lan', 'Sha', 'Ling', 'Yan', 'Ling', 'Xing', 'Li', 'Fei', 'Xue', 'Yuan', 'Tang', 'Wu', 'Lan', 'Ning', 'Jinyu', 'Qingya', 'Zhaoye', 'Liuying', 'Hansu', 'Shiguang', 'Guiyan', 'Yinzhu', 'Muyun'];
const TIER_W = [0.44, 0.30, 0.15, 0.085, 0.025];
const E = { gestation: 45000, breedCooldown: 86400000, fertilityMin: 3, fertilityMax: 5, marryCost: 30 };
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function tierRoll() { let r = Math.random(), a = 0; for (let i = 0; i < TIER_W.length; i++) { a += TIER_W[i]; if (r <= a) return i; } return 0; }
function makeSoldier(ownerId, opts) {
  opts = opts || {};
  const tier = opts.tier != null ? opts.tier : tierRoll();
  const cls = CLASSES.find((x) => x.key === opts.cls) || pick(CLASSES);
  const mult = 1 + tier * 0.085;
  const rnd = () => Math.random() * 26;
  const gender = opts.gender || (Math.random() < 0.5 ? 'm' : 'f');
  const surname = opts.surname || pick(SURNAMES);
  const given = opts.given || pick(gender === 'm' ? GIVEN_M : GIVEN_F);
  const clamp = (v) => Math.max(18, Math.min(99, Math.round(v)));
  return {
    id: 's' + (state.nextSoldierId++), owner: ownerId, nftId: opts.nftId || null,
    name: opts.name || (surname + '·' + given), surname, gender,
    cls: cls.key, clsName: cls.name, tier, gen: opts.gen || 1,
    atk: opts.atk != null ? Math.round(opts.atk) : clamp((40 + rnd() + cls.atk) * mult),
    def: opts.def != null ? Math.round(opts.def) : clamp((38 + rnd() + cls.def) * mult),
    spd: opts.spd != null ? Math.round(opts.spd) : clamp((40 + rnd() + cls.spd) * mult),
    status: 'idle', pocket: 0, zoneId: null, dueAt: 0, fatherId: null, motherId: null,
    spouse: null, children: [], childCount: 0,
    fertility: E.fertilityMin + Math.floor(Math.random() * (E.fertilityMax - E.fertilityMin + 1)),
    parents: opts.parents || [], ancestors: opts.ancestors || [], seed: opts.seed || Math.floor(Math.random() * 2147483646),
    bornAt: Date.now(), cdUntil: 0, pregnant: false, birthId: null, created: Date.now(),
  };
}
function makeInitialRoster(p, nft, ids) {
  const list = [];
  const n = Math.min(10, Math.max(0, Number(nft) || 0));
  for (let i = 0; i < n; i++) list.push(makeSoldier(p.id, { nftId: (ids && ids[i]) || (i + 1), gender: n >= 2 ? (i === 0 ? 'm' : i === 1 ? 'f' : undefined) : undefined }));
  return list;
}
function syncRoster(p) {
  if (!Array.isArray(p.roster)) p.roster = [];
  p.roster = (p.roster || []).filter(Boolean);
  p.troops = p.roster.filter((x) => x.status === 'idle').length;
  p.power = powerOf(p);
}
function soldierOf(p, id) { return (p.roster || []).find((x) => x.id === id); }
function garrisonSoldiers(zoneId) {
  const out = [];
  for (const p of Object.values(state.players)) {
    for (const x of (p.roster || [])) if (x.status === 'garrison' && Number(x.zoneId) === Number(zoneId)) out.push({ p, x });
  }
  return out;
}
function garrisonPower(zoneId) {
  return garrisonSoldiers(zoneId).reduce((a, g) => a + Math.round((g.x.atk + g.x.def + g.x.spd) / 4), 0);
}
function removeGarrison(zoneId) {
  const list = garrisonSoldiers(zoneId);
  for (const g of list) {
    g.x.status = 'dead'; g.x.zoneId = null; g.x.reviveAt = Date.now() + 10 * 60 * 1000;
    syncRoster(g.p);
  }
  if (state.garrisons[String(zoneId)]) delete state.garrisons[String(zoneId)];
}

function related(a, b) {
  if (!a || !b || a.id === b.id) return true;
  const sa = new Set([a.id, ...(a.parents || []), ...(a.ancestors || [])]);
  const sb = new Set([b.id, ...(b.parents || []), ...(b.ancestors || [])]);
  for (const x of sa) if (sb.has(x)) return true;
  return false;
}
function soldierPower(x) { return Math.round(x.atk + x.def + x.spd); }
function rosterStats(list) {
  const n = Math.max(1, list.length);
  return { atk: list.reduce((a, x) => a + (Number(x.atk) || 0), 0) / n, def: list.reduce((a, x) => a + (Number(x.def) || 0), 0) / n, spd: list.reduce((a, x) => a + (Number(x.spd) || 0), 0) / n };
}
function canMarry(a, b) {
  if (!a || !b) return 'select two soldiers';
  if (a.gender === b.gender) return 'need one male and one female';
  if (a.spouse || b.spouse) return 'already married';
  if (a.status !== 'idle' || b.status !== 'idle') return 'both must be idle';
  if (a.pregnant || b.pregnant) return 'pregnant soldiers cannot marry';
  if (related(a, b)) return 'blood relation too close';
  if (a.childCount >= a.fertility && b.childCount >= b.fertility) return 'fertility exhausted';
  return '';
}
function canBreed(a, b) {
  if (!a || !b) return 'select a married pair';
  if (a.spouse !== b.id || b.spouse !== a.id) return 'marry first';
  if (a.status !== 'idle' || b.status !== 'idle') return 'both must be idle';
  if (a.pregnant || b.pregnant) return 'already pregnant';
  if (Math.max(a.cdUntil || 0, b.cdUntil || 0) > Date.now()) return 'breeding cooldown';
  if (a.childCount >= a.fertility || b.childCount >= b.fertility) return 'fertility exhausted';
  return '';
}
function childSpec(father, mother) {
  let tier = Math.max(father.tier, mother.tier);
  const roll = Math.random();
  if (roll < 0.16) tier = Math.min(4, tier + 1);
  else if (roll < 0.52) tier = Math.max(0, tier - 1);
  else if (roll < 0.7) tier = Math.max(0, tier - 2);
  const cls = Math.random() < 0.6 ? (Math.random() < 0.5 ? father.cls : mother.cls) : pick(CLASSES).key;
  const gender = Math.random() < 0.5 ? 'm' : 'f';
  const given = pick(gender === 'm' ? GIVEN_M : GIVEN_F);
  const ancestors = Array.from(new Set([...(father.parents || []), ...(mother.parents || []), ...(father.ancestors || []), ...(mother.ancestors || []), father.id, mother.id])).slice(0, 12);
  const factor = 1 + Math.random() * 0.2;
  const inherit = (x, y) => Math.round((x + y) * factor);
  return {
    name: father.surname + '·' + given, surname: father.surname, gender, tier, cls,
    atk: inherit(father.atk, mother.atk), def: inherit(father.def, mother.def), spd: inherit(father.spd, mother.spd),
    pocket: 0, parents: [father.id, mother.id], ancestors, gen: Math.max(father.gen, mother.gen) + 1, factor: Math.round(factor * 1000),
    fertility: E.fertilityMin + Math.floor(Math.random() * (E.fertilityMax - E.fertilityMin + 1)),
    seed: Math.floor(Math.random() * 2147483646),
  };
}
const nftCache = new Map();
const oreCache = new Map();
async function nftBalance(address, fresh) {
  if (NFT_MOCK_COUNT != null) return Math.max(0, Math.floor(NFT_MOCK_COUNT));
  const key = String(address).toLowerCase();
  if (fresh) nftCache.delete(key);
  const hit = nftCache.get(key);
  if (hit && Date.now() - hit.at < 60000) return hit.value;
  const data = '0x70a08231' + key.replace(/^0x/, '').padStart(64, '0');
  try {
    const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT, data }, 'latest']);
    const value = Number(BigInt(result || '0x0'));
    nftCache.set(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    if (hit) return hit.value;
    throw new Error('NFT RPC unavailable: ' + e.message);
  }
}
async function nftTokenIds(address, fresh) {
  if (NFT_MOCK_IDS) return NFT_MOCK_IDS.slice(0, 10);
  const key = String(address).toLowerCase();
  if (fresh) nftCache.delete('ids:' + key);
  const hit = nftCache.get('ids:' + key);
  if (hit && Date.now() - hit.at < 60000) return hit.value;
  if (!ethers) return [];
  const iface = new ethers.Interface(['function tokensOfOwner(address wallet) view returns (uint256[] memory ids)']);
  const data = iface.encodeFunctionData('tokensOfOwner', [key]);
  try {
    const result = await rpcCall('eth_call', [{ to: NFT_CONTRACT, data }, 'latest']);
    const decoded = iface.decodeFunctionResult('tokensOfOwner', result || '0x');
    const ids = Array.from(decoded[0]).map((x) => String(x));
    nftCache.set('ids:' + key, { at: Date.now(), value: ids });
    return ids;
  } catch (e) {
    if (hit) return hit.value;
    throw new Error('NFT RPC unavailable: ' + e.message);
  }
}
async function chainOreBalance(address) {
  const key = String(address).toLowerCase();
  const hit = oreCache.get(key);
  if (hit && Date.now() - hit.at < 30000) return hit.value;
  const data = '0x70a08231' + key.replace(/^0x/, '').padStart(64, '0');
  try {
    const result = await rpcCall('eth_call', [{ to: ORE_TOKEN, data }, 'latest']);
    const value = Number(BigInt(result || '0x0')) / 1e18;
    oreCache.set(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    if (hit) return hit.value;
    return null;
  }
}
function loginMessage(address, nonce) {
  return '矿域 multiplayer login\nAddress: ' + address + '\nNonce: ' + nonce + '\nThis signature does not send a transaction.';
}
async function handleNonce(req, res) {
  const body = req.method === 'POST' ? await readBody(req) : Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const address = clean(body.address, 64).toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) return json(res, 400, { ok: false, error: 'invalid address' });
  const nonce = crypto.randomBytes(16).toString('hex');
  const message = loginMessage(address, nonce);
  state.nonces[address] = { nonce, message, expires: Date.now() + NONCE_TTL };
  for (const [k, v] of Object.entries(state.nonces)) if (!v.expires || v.expires < Date.now()) delete state.nonces[k];
  save();
  json(res, 200, { ok: true, address, nonce, message, expires: state.nonces[address].expires });
}
async function handleLogin(req, res) {
  if (!ethers) return json(res, 503, { ok: false, error: 'ethers not installed on the server' });
  const body = await readBody(req);
  const address = clean(body.address, 64).toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) return json(res, 400, { ok: false, error: 'invalid address' });
  const n = state.nonces[address];
  if (!n || n.expires < Date.now()) return json(res, 401, { ok: false, error: 'nonce expired' });
  let signer = '';
  try { signer = ethers.verifyMessage(n.message, String(body.signature || '')).toLowerCase(); } catch (e) { return json(res, 401, { ok: false, error: 'bad signature' }); }
  if (signer !== address) return json(res, 401, { ok: false, error: 'signature address mismatch' });
  delete state.nonces[address];
  const clan = ['tide', 'ember', 'dune'].includes(body.clan) ? body.clan : null;
  if (!clan) return json(res, 400, { ok: false, error: 'choose a faction first' });
  if (body.seed && Number(body.seed) !== state.seed) return json(res, 409, { ok: false, error: 'world seed mismatch', seed: state.seed });
  const m = normalizeManifest(body.manifest);
  if (!state.manifest) {
    if (!m) return json(res, 400, { ok: false, error: 'first player must provide the 240-zone manifest' });
    if (MAP_HASH && MAP_HASH !== '*' && manifestHash(m) !== MAP_HASH) return json(res, 400, { ok: false, error: 'map manifest mismatch' });
    state.manifest = m; initOwners(m); state.version++;
  }
  let nft = 0, chainOre = null, nftIds = [];
  try {
    const [n, o, ids] = await Promise.all([nftBalance(address), chainOreBalance(address), nftTokenIds(address)]);
    nft = n; chainOre = o; nftIds = ids;
  } catch (e) { return json(res, 503, { ok: false, error: e.message }); }
  const pid = 'w:' + address;
  const old = state.players[pid];
  const offlineMs = old && old.lastSeen ? Math.max(0, Date.now() - Number(old.lastSeen)) : 0;
  if (old && old.clan && old.clan !== clan) return json(res, 409, { ok: false, error: 'faction cannot be changed' });
  const now = Date.now();
  const p = old || {
    id: pid, name: clean(body.name, 32) || ('Commander-' + address.slice(2, 6)), clan,
    ore: START_ORE, withdrawable: 0, troops: 0, kills: 0, captures: 0, power: 0,
    joinedAt: now, lastAttackAt: 0, lastClaimAt: 0, wallet: address, nft: 0, roster: [],
  };
  p.name = clean(body.name, 32) || p.name;
  p.clan = clan; p.wallet = address; p.nft = nft; p.chainOre = chainOre; p.nftTokenIds = nftIds;
  p.lastSeen = now; p.token = crypto.randomBytes(18).toString('hex');
  p.lastIncomeAt = p.lastIncomeAt || now;
  if (!old) {
    p.troops = Math.min(10, Math.max(0, nft));
    p.roster = makeInitialRoster(p, nft, nftIds);
    addEvent('join', p, '', p.name + ' joined');
  }
  p.power = powerOf(p);
  state.players[pid] = p;
  storage.setPresence(pid, OFFLINE_MS);
  storage.setSession(pid, p.token, OFFLINE_MS * 2);
  state.version++;
  audit('login', { address, clan, nft });
  save();
  json(res, 200, Object.assign({ ok: true, player: publicPlayer(p), token: p.token, nft, nftIds, chainOre, nftRequired: true, offlineMs }, snapshot()));
  broadcast();
}
async function handleJoin(req, res) {
  const body = await readBody(req);
  const id = clean(body.id, 80);
  if (!id || id.length < 4) return json(res, 400, { ok: false, error: 'missing player id' });
  const clan = ['tide', 'ember', 'dune'].includes(body.clan) ? body.clan : null;
  if (!clan) return json(res, 400, { ok: false, error: 'choose a faction first' });
  if (body.seed && Number(body.seed) !== state.seed) return json(res, 409, { ok: false, error: 'world seed mismatch', seed: state.seed });
  const m = normalizeManifest(body.manifest);
  if (!state.manifest) {
    if (!m) return json(res, 400, { ok: false, error: 'first player must provide the 240-zone manifest' });
    state.manifest = m;
    initOwners(m);
    state.version++;
    console.log('[world] initialized map', Object.keys(state.owners).length, 'tiles');
  }
  const old = state.players[id];
  if (old && old.clan && old.clan !== clan) return json(res, 409, { ok: false, error: 'faction cannot be changed' });
  const now = Date.now();
  const p = old || {
    id, name: clean(body.name, 32) || ('Commander-' + id.slice(-4)), clan,
    ore: START_ORE, troops: START_TROOPS, kills: 0, captures: 0, power: 0,
    joinedAt: now, wallet: '',
  };
  p.name = clean(body.name, 32) || p.name;
  p.clan = clan;
  p.wallet = clean(body.wallet, 64);
  p.lastSeen = now;
  p.token = crypto.randomBytes(18).toString('hex');
  p.lastIncomeAt = p.lastIncomeAt || now;
  p.power = powerOf(p);
  state.players[id] = p;
  if (!old) addEvent('join', p, '', p.name + ' joined');
  state.version++;
  save();
  json(res, 200, Object.assign({ ok: true, player: publicPlayer(p), token: p.token }, snapshot()));
  broadcast();
}
async function handleHeartbeat(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  p.lastSeen = Date.now();
  storage.setPresence(p.id, OFFLINE_MS);
  json(res, 200, { ok: true, online: onlinePlayers().length });
}
async function handleClaim(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  const z = zoneOf(body.zoneId);
  if (!z) return json(res, 404, { ok: false, error: 'unknown tile' });
  if (z.kind === 'base') return json(res, 400, { ok: false, error: 'base is unattackable' });
  if (state.owners[String(z.id)] === p.clan) return json(res, 409, { ok: false, error: 'already owned by your faction' });
  const last = Math.max(Number(p.lastClaimAt) || 0, claimAt.get(p.id) || 0);
  if (Date.now() - last < CLAIM_COOLDOWN_MS) return json(res, 429, { ok: false, error: 'claim too fast' });
  if (!canAttackFrom(p, z, state.owners)) return json(res, 403, { ok: false, error: 'tile is not adjacent to your faction' });
  state.owners[String(z.id)] = p.clan;
  state.defenses[String(z.id)] = 8 + (z.id % 4);
  state.totalClaims++;
  state.version++;
  claimAt.set(p.id, Date.now()); p.lastClaimAt = Date.now();
  p.lastSeen = Date.now();
  addEvent('capture', p, z.code, p.name + ' captured ' + z.code);
  save();
  json(res, 200, Object.assign({ ok: true }, snapshot()));
  broadcast();
}
function zoneDistance(a, b) {
  if (!a || !b || !a.pos || !b.pos) return Math.PI / 4;
  const dot = Math.max(-1, Math.min(1, a.pos[0] * b.pos[0] + a.pos[1] * b.pos[1] + a.pos[2] * b.pos[2]));
  return Math.acos(dot);
}
function nearestOwnZone(p, target) {
  if (!state.manifest) return null;
  let best = null, bestD = Math.PI;
  for (const z of state.manifest.zones) {
    if (z.kind !== 'mine' || state.owners[String(z.id)] !== p.clan || !z.pos) continue;
    const d = zoneDistance(z, target);
    if (d < bestD) { bestD = d; best = z; }
  }
  return best;
}
function travelMsFor(p, target) {
  if (!state.manifest) return 8000;
  let best = Math.PI;
  for (const z of state.manifest.zones) {
    if (z.kind !== 'mine' || state.owners[String(z.id)] !== p.clan || !z.pos) continue;
    const d = zoneDistance(z, target);
    if (d < best) best = d;
  }
  return 6000 + Math.round(24000 * Math.min(1, best / (Math.PI / 2)));
}
function classCounts(list) {
  const out = {};
  for (const x of list) out[x.cls] = (out[x.cls] || 0) + 1;
  return out;
}
async function handleAttack(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  if (!nowOnline(p)) return json(res, 403, { ok: false, error: 'stale session' });
  const z = zoneOf(body.zoneId);
  if (!z) return json(res, 404, { ok: false, error: 'unknown tile' });
  if (z.kind === 'base') return json(res, 400, { ok: false, error: 'base is unattackable' });
  if (state.owners[String(z.id)] === p.clan) return json(res, 409, { ok: false, error: 'already your faction' });
  if (!canAttackFrom(p, z, state.owners)) return json(res, 403, { ok: false, error: 'tile is not adjacent to your faction' });
  const last = Math.max(Number(p.lastAttackAt) || 0, attackAt.get(p.id) || 0);
  if (Date.now() - last < ATTACK_COOLDOWN_MS) return json(res, 429, { ok: false, error: 'attack too fast' });
  const troops = Math.floor(Number(body.troops) || 0);
  if (troops < 1) return json(res, 400, { ok: false, error: 'send at least 1 soldier' });
  const idle = (p.roster || []).filter((x) => x.status === 'idle').sort((a, b) => (b.atk + b.def + b.spd) - (a.atk + a.def + a.spd));
  if (troops > idle.length) return json(res, 400, { ok: false, error: 'not enough idle soldiers' });
  if (state.battles.some((b) => b.playerId === p.id)) return json(res, 409, { ok: false, error: 'you already have an active attack' });
  const chosen = idle.slice(0, troops);
  for (const s of chosen) s.status = 'attacking';
  syncRoster(p);
  p.lastSeen = Date.now();
  const stats = rosterStats(chosen);
  const battle = {
    id: crypto.randomBytes(5).toString('hex'),
    playerId: p.id, name: p.name, clan: p.clan,
    zoneId: z.id, fromZoneId: (nearestOwnZone(p, z) || z).id, code: z.code, troops, soldierIds: chosen.map((x) => x.id),
    atk: Math.round(stats.atk * 10) / 10, defense: (state.defenses[String(z.id)] || 12) + garrisonPower(z.id) + Number(state.forts[String(z.id)] || 0) * 12,
    atkClasses: classCounts(chosen), defClasses: classCounts(garrisonSoldiers(z.id).map((g) => g.x)),
    startedAt: Date.now(), arriveAt: 0, resolveAt: 0,
  };
  battle.arriveAt = Date.now() + travelMsFor(p, z);
  battle.resolveAt = battle.arriveAt + BATTLE_MS;
  state.battles.push(battle);
  state.version++;
  attackAt.set(p.id, Date.now()); p.lastAttackAt = Date.now();
  addEvent('attack', p, z.code, p.name + ' attacks ' + z.code);
  save();
  json(res, 200, Object.assign({ ok: true, battle }, snapshot()));
  broadcast();
}
async function handleStation(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  const z = zoneOf(body.zoneId);
  if (!z || z.kind === 'base') return json(res, 400, { ok: false, error: 'invalid tile' });
  if (state.owners[String(z.id)] !== p.clan) return json(res, 400, { ok: false, error: 'station only on your faction territory' });
  const count = Math.max(1, Math.floor(Number(body.count) || 0));
  const idle = (p.roster || []).filter((x) => x.status === 'idle').slice(0, count);
  if (!idle.length) return json(res, 400, { ok: false, error: 'no idle soldiers' });
  for (const so of idle) { so.status = 'garrison'; so.zoneId = z.id; }
  state.garrisons[String(z.id)] = Array.from(new Set([...(state.garrisons[String(z.id)] || []), ...idle.map((x) => x.id)]));
  syncRoster(p); state.version++; save();
  addEvent('station', p, z.code, p.name + ' stationed ' + idle.length);
  json(res, 200, Object.assign({ ok: true, count: idle.length }, snapshot())); broadcast();
}
async function handleZoneWithdraw(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  const z = zoneOf(body.zoneId);
  if (!z) return json(res, 400, { ok: false, error: 'invalid tile' });
  const count = Math.max(1, Math.floor(Number(body.count) || 1));
  const list = (p.roster || []).filter((x) => x.status === 'garrison' && Number(x.zoneId) === Number(z.id)).slice(0, count);
  if (!list.length) return json(res, 400, { ok: false, error: 'no garrisoned soldiers here' });
  for (const so of list) { so.status = 'idle'; so.zoneId = null; }
  const remain = (state.garrisons[String(z.id)] || []).filter((id) => !list.some((x) => x.id === id));
  if (remain.length) state.garrisons[String(z.id)] = remain; else delete state.garrisons[String(z.id)];
  syncRoster(p); state.version++; save();
  addEvent('withdraw', p, z.code, p.name + ' withdrew ' + list.length);
  json(res, 200, Object.assign({ ok: true, count: list.length }, snapshot())); broadcast();
}
async function handleFortify(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  const z = zoneOf(body.zoneId);
  if (!z || z.kind === 'base') return json(res, 400, { ok: false, error: 'invalid tile' });
  if (state.owners[String(z.id)] !== p.clan) return json(res, 400, { ok: false, error: 'fortify only your faction territory' });
  const level = Number(state.forts[String(z.id)] || 0);
  if (level >= 5) return json(res, 400, { ok: false, error: 'max fortification' });
  const costs = [0, 60, 140, 260, 420, 640];
  const cost = costs[level + 1] || 640;
  if (p.ore < cost) return json(res, 400, { ok: false, error: 'not enough ORE' });
  p.ore -= cost; state.forts[String(z.id)] = level + 1; state.defenses[String(z.id)] = (state.defenses[String(z.id)] || 12) + 28;
  syncRoster(p); state.version++; save();
  addEvent('fort', p, z.code, p.name + ' fortified ' + z.code);
  json(res, 200, Object.assign({ ok: true, cost, level: level + 1 }, snapshot())); broadcast();
}
async function verifyOrePayment(hash, from, minimum, recipient) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(hash || ''))) throw new Error('payment tx hash required');
  if (state.paymentTxs[hash]) throw new Error('payment tx already used');
  if (state.paymentPending[hash]) throw new Error('payment tx is being processed');
  state.paymentPending[hash] = Date.now();
  try {
  let receipt = null;
  for (let i = 0; i < 5; i++) {
    receipt = await rpcCall('eth_getTransactionReceipt', [hash]);
    if (receipt) break;
    await new Promise((r) => setTimeout(r, 1200));
  }
  if (!receipt) throw new Error('payment tx not confirmed yet');
  if (String(receipt.status) !== '0x1' && Number(receipt.status) !== 1) throw new Error('payment tx reverted');
  const iface = new ethers.Interface(['event Transfer(address indexed from,address indexed to,uint256 value)']);
  const topic = iface.getEvent('Transfer').topicHash;
  const wallet = String(from).toLowerCase(), vault = String(recipient || DEAD_ADDRESS).toLowerCase();
  let paid = 0;
  for (const log of receipt.logs || []) {
    if (String(log.address).toLowerCase() !== ORE_TOKEN) continue;
    if (!log.topics || log.topics[0] !== topic || log.topics.length < 3) continue;
    const f = '0x' + String(log.topics[1]).slice(26).toLowerCase();
    const t = '0x' + String(log.topics[2]).slice(26).toLowerCase();
    if (f !== wallet || t !== vault) continue;
    paid += Number(ethers.formatEther(BigInt(log.data)));
  }
  if (!(paid + 1e-9 >= minimum)) throw new Error('payment amount too low');
  return paid;
  } catch (e) { delete state.paymentPending[hash]; throw e; }
}
function finishPayment(hash, player, amount) {
  delete state.paymentPending[hash];
  state.paymentTxs[hash] = { player, amount, at: Date.now() };
}
function releasePayment(hash) { delete state.paymentPending[hash]; }
async function handleMarry(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  const x = soldierOf(p, body.aId), y = soldierOf(p, body.bId);
  const err = canMarry(x, y);
  if (err) return json(res, 400, { ok: false, error: err });
  let paid;
  try { paid = await verifyOrePayment(body.txHash, p.wallet, E.marryCost, DEAD_ADDRESS); }
  catch (e) { return json(res, 400, { ok: false, error: e.message }); }
  x.spouse = y.id; y.spouse = x.id;
  finishPayment(body.txHash, p.id, paid);
  state.version++; save(); addEvent('marry', p, '', p.name + ' married two soldiers');
  json(res, 200, Object.assign({ ok: true, paid }, snapshot())); broadcast();
}
async function handleBreed(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  const x = soldierOf(p, body.fatherId || body.aId), y = soldierOf(p, body.motherId || body.bId);
  const err = canBreed(x, y);
  if (err) return json(res, 400, { ok: false, error: err });
  const father = x.gender === 'f' ? y : x, mother = x.gender === 'f' ? x : y;
  const cost = Math.max(1, Math.ceil(soldierPower(father) + soldierPower(mother)));
  const spec = childSpec(father, mother);
  const due = Date.now() + E.gestation;
  father.cdUntil = Date.now() + E.breedCooldown; mother.cdUntil = Date.now() + E.breedCooldown;
  father.childCount++; mother.childCount++;
  mother.pregnant = true; mother.status = 'pregnant'; mother.dueAt = due;
  const birth = { id: crypto.randomBytes(5).toString('hex'), playerId: p.id, fatherId: father.id, motherId: mother.id, dueAt: due, breedAt: Date.now(), fee: cost, child: spec };
  state.births.push(birth); mother.birthId = birth.id;
  syncRoster(p); state.version++; save(); addEvent('breed', p, '', p.name + ' is breeding');
  json(res, 200, Object.assign({ ok: true, cost, due }, snapshot())); broadcast();
}
async function handleOnchainLock(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player, so = soldierOf(p, body.soldierId);
  if (!so || so.status !== 'idle' || so.spouse) return json(res, 400, { ok: false, error: 'soldier must be idle and unmarried' });
  so.status = 'listed'; so.onchain = true; syncRoster(p); state.version++; save();
  json(res, 200, Object.assign({ ok: true }, snapshot())); broadcast();
}
async function handleOnchainUnlock(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player, so = soldierOf(p, body.soldierId);
  if (!so) return json(res, 404, { ok: false, error: 'soldier missing' });
  so.status = 'idle'; so.onchain = false; syncRoster(p); state.version++; save();
  json(res, 200, Object.assign({ ok: true }, snapshot())); broadcast();
}
async function handleMarketList(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player, so = soldierOf(p, body.soldierId);
  if (!so || so.status !== 'idle' || so.spouse) return json(res, 400, { ok: false, error: 'soldier must be idle and unmarried' });
  if (state.listings.some((l) => l.soldierId === so.id)) return json(res, 409, { ok: false, error: 'already listed' });
  const price = Math.max(1, Math.min(1000000, Math.floor(Number(body.price) || 0)));
  if (!price) return json(res, 400, { ok: false, error: 'invalid price' });
  so.status = 'listed'; syncRoster(p);
  const listing = { id: crypto.randomBytes(5).toString('hex'), sellerId: p.id, sellerName: p.name, soldierId: so.id, soldier: so, price, createdAt: Date.now(), expiresAt: Date.now() + 24 * 3600 * 1000 };
  state.listings.push(listing); state.version++; save();
  json(res, 200, Object.assign({ ok: true, listing }, snapshot())); broadcast();
}
async function handleMarketCancel(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player, idx = state.listings.findIndex((l) => l.id === body.listingId && l.sellerId === p.id);
  if (idx < 0) return json(res, 404, { ok: false, error: 'listing not found' });
  const l = state.listings[idx], so = soldierOf(p, l.soldierId); if (so) so.status = 'idle';
  state.listings.splice(idx, 1); syncRoster(p); state.version++; save();
  json(res, 200, Object.assign({ ok: true }, snapshot())); broadcast();
}
async function handleMarketBuy(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const buyer = a.player, idx = state.listings.findIndex((l) => l.id === body.listingId);
  if (idx < 0) return json(res, 404, { ok: false, error: 'listing not found' });
  const l = state.listings[idx];
  if (l.sellerId === buyer.id) return json(res, 400, { ok: false, error: 'cannot buy your own listing' });
  if (buyer.ore < l.price) return json(res, 400, { ok: false, error: 'not enough ORE' });
  const seller = state.players[l.sellerId], so = seller && soldierOf(seller, l.soldierId);
  if (!so) { state.listings.splice(idx, 1); return json(res, 409, { ok: false, error: 'soldier missing' }); }
  const fee = Math.floor(l.price * 0.05);
  buyer.ore -= l.price; seller.ore += l.price - fee;
  state.pool.ore += fee;
  // Transfer/sale burns the soldier's off-chain pocket. It is not refunded
  // to either side and is not credited back to the mine pool.
  so.pocket = 0;
  so.owner = buyer.id; so.status = 'idle'; so.zoneId = null; so.spouse = null;
  seller.roster = seller.roster.filter((x) => x.id !== so.id); syncRoster(seller);
  buyer.roster.push(so); syncRoster(buyer);
  state.listings.splice(idx, 1); state.version++; save();
  addEvent('market', buyer, '', buyer.name + ' bought a soldier');
  json(res, 200, Object.assign({ ok: true }, snapshot())); broadcast();
}
async function handlePoolAdd(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player, amount = Math.floor(Number(body.amount) || 0);
  if (amount < 1 || p.ore < amount) return json(res, 400, { ok: false, error: 'invalid amount' });
  const shares = state.pool.shares === 0 ? amount : Math.floor(amount * state.pool.shares / Math.max(1, state.pool.ore));
  p.ore -= amount; p.lpShares = (p.lpShares || 0) + shares;
  state.pool.ore += amount; state.pool.shares += shares;
  state.version++; save(); json(res, 200, Object.assign({ ok: true }, snapshot())); broadcast();
}
async function handlePoolRemove(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player, shares = Math.floor(Number(body.shares) || 0);
  if (shares < 1 || shares > (p.lpShares || 0)) return json(res, 400, { ok: false, error: 'invalid shares' });
  const amount = Math.floor(shares * state.pool.ore / Math.max(1, state.pool.shares));
  p.lpShares -= shares; p.ore += amount;
  state.pool.shares -= shares; state.pool.ore = Math.max(0, state.pool.ore - amount);
  state.version++; save(); json(res, 200, Object.assign({ ok: true }, snapshot())); broadcast();
}
async function handleVaultInfo(req, res) {
  let signer = '';
  try { signer = getVaultSigner().address; } catch (e) {}
  json(res, 200, { ok: true, vault: ORE_VAULT, ore: ORE_TOKEN, nft: NFT_CONTRACT, burner: ORE_BURNER, market: ORE_MARKET, burn: DEAD_ADDRESS, chainId: CHAIN_ID, signer });
}
async function handleDeposit(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  const hash = clean(body.txHash, 80);
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return json(res, 400, { ok: false, error: 'invalid tx hash' });
  if (state.depositTxs[hash]) return json(res, 409, { ok: false, error: 'tx already credited' });
  let receipt = null;
  for (let i = 0; i < 5; i++) {
    receipt = await rpcCall('eth_getTransactionReceipt', [hash]);
    if (receipt) break;
    await new Promise((r) => setTimeout(r, 1200));
  }
  if (!receipt) return json(res, 404, { ok: false, error: 'tx not confirmed yet' });
  if (String(receipt.status) !== '0x1' && Number(receipt.status) !== 1) return json(res, 400, { ok: false, error: 'tx reverted' });
  const iface = new ethers.Interface(['event Deposited(address indexed player,uint256 amount)']);
  const topic = iface.getEvent('Deposited').topicHash;
  const log = (receipt.logs || []).find((l) => String(l.address).toLowerCase() === ORE_VAULT && l.topics && l.topics[0] === topic);
  if (!log) return json(res, 400, { ok: false, error: 'no OreVault deposit event' });
  const parsed = iface.parseLog({ topics: log.topics, data: log.data });
  const from = String(parsed.args[0]).toLowerCase();
  if (from !== String(p.wallet).toLowerCase()) return json(res, 403, { ok: false, error: 'deposit not from logged-in wallet' });
  const amount = Number(ethers.formatEther(parsed.args[1]));
  if (!(amount > 0)) return json(res, 400, { ok: false, error: 'zero deposit' });
  state.depositTxs[hash] = { player: p.id, amount, at: Date.now() };
  p.ore += amount; p.withdrawable = (p.withdrawable || 0) + amount;
  state.version++; save(); audit('deposit', { player: p.id, amount, hash });
  json(res, 200, Object.assign({ ok: true, credited: amount }, snapshot())); broadcast();
}
async function handleVaultWithdraw(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  const amount = Math.floor(Number(body.amount) * 1e6) / 1e6;
  if (!(amount > 0)) return json(res, 400, { ok: false, error: 'invalid amount' });
  if (p.ore < amount) return json(res, 400, { ok: false, error: 'not enough ORE' });
  if ((p.withdrawable || 0) < amount) return json(res, 400, { ok: false, error: 'only deposited ORE is withdrawable' });
  let signer;
  try { signer = getVaultSigner(); } catch (e) { return json(res, 503, { ok: false, error: 'signer unavailable' }); }
  const nonce = Number(p.withdrawNonce || 0) + 1;
  const deadline = Math.floor(Date.now() / 1000) + 900;
  const value = ethers.parseEther(String(amount));
  const domain = { name: 'OreVault', version: '1', chainId: CHAIN_ID, verifyingContract: ORE_VAULT };
  const types = { Claim: [{ name: 'player', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] };
  const signature = await signer.signTypedData(domain, types, { player: p.wallet, amount: value, nonce, deadline });
  p.ore -= amount; p.withdrawable = Math.max(0, (p.withdrawable || 0) - amount); p.withdrawNonce = nonce;
  state.version++; save(); audit('withdraw', { player: p.id, amount, nonce });
  json(res, 200, { ok: true, amount, amountWei: value.toString(), nonce, deadline, signature, vault: ORE_VAULT, chainId: CHAIN_ID });
}
async function handleBurnPayout(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const hash = clean(body.txHash, 80);
  const rec = state.burnPayouts[hash];
  if (!rec || rec.playerId !== a.player.id) return json(res, 404, { ok: false, error: 'no pending burn payout' });
  if (rec.payout.deadline < Math.floor(Date.now() / 1000)) { delete state.burnPayouts[hash]; save(); return json(res, 410, { ok: false, error: 'payout expired' }); }
  json(res, 200, { ok: true, payout: rec.payout });
}
async function handleBurn(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  const hash = clean(body.txHash, 80);
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return json(res, 400, { ok: false, error: 'burn transaction hash required' });
  if (state.depositTxs[hash]) return json(res, 409, { ok: false, error: 'tx already used' });
  let receipt = null;
  for (let i = 0; i < 5; i++) {
    receipt = await rpcCall('eth_getTransactionReceipt', [hash]);
    if (receipt) break;
    await new Promise((r) => setTimeout(r, 1200));
  }
  if (!receipt) return json(res, 404, { ok: false, error: 'burn tx not confirmed yet' });
  if (String(receipt.status) !== '0x1' && Number(receipt.status) !== 1) return json(res, 400, { ok: false, error: 'burn tx reverted' });
  const iface = new ethers.Interface(['event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)']);
  const topic = iface.getEvent('Transfer').topicHash;
  const wallet = String(p.wallet).toLowerCase();
  const burned = [];
  for (const log of (receipt.logs || [])) {
    if (String(log.address).toLowerCase() !== NFT_CONTRACT) continue;
    if (!log.topics || log.topics[0] !== topic || log.topics.length < 4) continue;
    const from = '0x' + String(log.topics[1]).slice(26).toLowerCase();
    const to = '0x' + String(log.topics[2]).slice(26).toLowerCase();
    if (from !== wallet || to !== DEAD_ADDRESS) continue;
    burned.push(String(BigInt(log.topics[3])));
  }
  if (!burned.length) return json(res, 400, { ok: false, error: 'no NFT burn to dead address from this wallet' });
  const soldiers = (p.roster || []).filter((x) => burned.includes(String(x.nftId)));
  if (!soldiers.length) return json(res, 400, { ok: false, error: 'no matching soldiers in roster' });
  let pocket = 0;
  for (const so of soldiers) { pocket += Number(so.pocket) || 0; so.status = 'burned'; }
  p.roster = p.roster.filter((x) => x.status !== 'burned');
  for (const k of Object.keys(state.garrisons || {})) state.garrisons[k] = state.garrisons[k].filter((id) => !burned.includes(String(id)));
  p.nft = Math.max(0, (p.nft || 0) - soldiers.length);
  p.nftTokenIds = (p.nftTokenIds || []).filter((id) => !burned.includes(String(id)));
  state.depositTxs[hash] = { player: p.id, burned, at: Date.now() };
  let payout = null;
  if (pocket > 0.000001) {
    const signer = getVaultSigner();
    const value = ethers.parseEther(pocket.toFixed(6));
    const nonce = BigInt('0x' + crypto.randomBytes(16).toString('hex'));
    const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    const domain = { name: 'OreMinePoolV2', version: '1', chainId: 97, verifyingContract: ORE_MINE_POOL };
    const types = { Claim: [{ name: 'player', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] };
    const signature = await signer.signTypedData(domain, types, { player: p.wallet, amount: value, nonce, deadline });
    payout = { pool: ORE_MINE_POOL, amount: value.toString(), nonce: nonce.toString(), deadline, signature };
    state.burnPayouts[hash] = { playerId: p.id, payout, at: Date.now() };
  }
  syncRoster(p); state.version++; save();
  audit('burn', { player: p.id, burned, pocket, payout: !!payout });
  addEvent('burn', p, '', p.name + ' burned ' + soldiers.length);
  json(res, 200, Object.assign({ ok: true, burned, pocket, payout, payoutTo: p.wallet }, snapshot())); broadcast();
}
async function v3HasAttrs(id) {
  try {
    const iface = new ethers.Interface(['function soldiers(uint256) view returns(uint16 atk,uint16 def,uint16 spd,uint16 gen,uint16 power,uint32 fatherId,uint32 motherId,uint16 factor,uint64 bornAt,string cls)']);
    const data = iface.encodeFunctionData('soldiers', [BigInt(id)]);
    const out = await rpcCall('eth_call', [{ to: NFT_CONTRACT, data }, 'latest']);
    const v = iface.decodeFunctionResult('soldiers', out || '0x');
    return Number(v.atk) > 0;
  } catch (e) { return false; }
}
function beginConfirm(hash) {
  if (state.depositTxs[hash] || state.confirmPending[hash]) return false;
  state.confirmPending[hash] = Date.now();
  return true;
}
function endConfirm(hash) { delete state.confirmPending[hash]; }
async function handleSync(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  if (state.syncPending[p.id]) return json(res, 409, { ok: false, error: 'sync in progress' });
  state.syncPending[p.id] = Date.now();
  try {
  let ids, nft;
  try { [ids, nft] = await Promise.all([nftTokenIds(p.wallet, true), nftBalance(p.wallet, true)]); }
  catch (e) { return json(res, 503, { ok: false, error: 'NFT RPC unavailable' }); }
  ids = [...new Set((ids || []).map(String))];
  p.nft = Number(nft) || ids.length;
  p.nftTokenIds = ids;
  const have = new Set((p.roster || []).map((x) => String(x.nftId)));
  const moved = [];
  for (const id of ids) {
    if (have.has(id)) continue;
    let candidate = state.pendingTransfers[id] && state.pendingTransfers[id].soldier;
    if (!candidate) {
      for (const q of Object.values(state.players)) {
        if (q.id === p.id) continue;
        const so = (q.roster || []).find((x) => String(x.nftId) === id);
        if (!so) continue;
        q.roster = q.roster.filter((x) => x.id !== so.id);
        so.pocket = 0;
        q.nft = Math.max(0, (q.nft || 0) - 1);
        q.nftTokenIds = (q.nftTokenIds || []).filter((x) => String(x) !== id);
        for (const key of Object.keys(state.garrisons || {})) state.garrisons[key] = state.garrisons[key].filter((sid) => sid !== so.id);
        state.listings = state.listings.filter((l) => l.soldierId !== so.id);
        so.pocket = 0; so.status = 'idle'; so.zoneId = null; so.spouse = null; so.pregnant = false; so.birthId = null; so.dueAt = 0;
        candidate = so; moved.push({ id, from: q.id });
        syncRoster(q);
        break;
      }
    }
    if (candidate) {
      candidate.owner = p.id; candidate.nftId = String(id); candidate.pocket = 0; candidate.status = 'idle'; candidate.zoneId = null;
      p.roster.push(candidate); delete state.pendingTransfers[id]; have.add(id);
    } else {
      // Public V3 mint() has no attributes. Only game-minted/migrated tokens
      // (atk > 0 in the V3 soldiers mapping) may become game soldiers.
      if (!(await v3HasAttrs(id))) continue;
      p.roster.push(makeSoldier(p.id, { nftId: id, status: 'idle' }));
      have.add(id);
    }
  }
  // A player who transferred an NFT away can get it back; only revive soldiers
  // marked dead specifically because sync could not find their NFT.
  for (const so of (p.roster || [])) {
    if (so.nftMissingDead && ids.includes(String(so.nftId))) {
      so.status = 'idle'; so.zoneId = null; so.reviveAt = 0; so.nftMissingDead = false;
    }
  }
  const removedIds = new Set();

  for (const so of (p.roster || [])) {
    if (so.nftId && !ids.includes(String(so.nftId)) && so.status !== 'dead') {
      if (!state.pendingTransfers[String(so.nftId)]) state.pendingTransfers[String(so.nftId)] = { soldier: so, from: p.id, at: Date.now() };
      so.pocket = 0;
      so.status = 'dead'; so.reviveAt = 0; so.zoneId = null; so.nftMissingDead = true;
      removedIds.add(so.id);
    }
  }
  if (removedIds.size) {
    for (const k of Object.keys(state.garrisons || {})) {
      state.garrisons[k] = state.garrisons[k].filter((id) => !removedIds.has(id));
    }
    state.listings = state.listings.filter((l) => !removedIds.has(l.soldierId));
  }
  syncRoster(p); state.version++; save();
  addEvent('sync', p, '', p.name + ' synced ' + ids.length + ' NFTs');
  json(res, 200, Object.assign({ ok: true, nft: p.nft, nftTokenIds: ids, moved }, snapshot())); broadcast();
  } finally { delete state.syncPending[p.id]; }
}
async function handleRecruitBatchPrepare(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  const count = Math.max(1, Math.min(20, Math.floor(Number(body.count) || 1)));
  if ((p.nft || 0) + count > 10000) return json(res, 400, { ok: false, error: 'wallet NFT limit' });
  const specs = Array.from({ length: count }, () => makeSoldier(p.id, {}));
  const data = specs.map((so) => recruitData(so));
  const nonce = crypto.randomBytes(16).toString('hex');
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const c = new ethers.Contract(NFT_CONTRACT, V4_RECRUIT_ABI, getReadProvider());
  let hash;
  try { hash = await c.recruitBatchHash(p.wallet, data, BigInt('0x' + nonce), deadline); }
  catch (e) { return json(res, 502, { ok: false, error: 'batch quote failed: ' + (e.shortMessage || e.message) }); }
  const signature = await getVaultSigner().signMessage(ethers.getBytes(hash));
  state.recruitPending[nonce] = { playerId: p.id, specs, data, count, deadline, createdAt: Date.now(), batch: true };
  save();
  json(res, 200, { ok: true, nft: NFT_CONTRACT, fee: String(100000000 * count), unitFee: '100000000', count, data, nonce, deadline, signature });
}
async function handleRecruitBatchConfirm(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  const hash = clean(body.txHash, 80);
  const nonce = clean(body.nonce, 64);
  const pending = state.recruitPending[nonce];
  if (!pending || pending.playerId !== p.id || !pending.batch) return json(res, 400, { ok: false, error: 'batch quote not found' });
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return json(res, 400, { ok: false, error: 'mint tx hash required' });
  if (state.depositTxs[hash]) return json(res, 409, { ok: false, error: 'tx already used' });
  if (!beginConfirm(hash)) return json(res, 409, { ok: false, error: 'confirmation in progress' });
  try {
  let receipt = null;
  for (let i = 0; i < 8; i++) { receipt = await rpcCall('eth_getTransactionReceipt', [hash]); if (receipt) break; await new Promise((r) => setTimeout(r, 1200)); }
  if (!receipt) return json(res, 404, { ok: false, error: 'mint tx not confirmed' });
  if (String(receipt.status) !== '0x1' && Number(receipt.status) !== 1) return json(res, 400, { ok: false, error: 'mint tx reverted' });
  const iface = new ethers.Interface(['event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)']);
  const topic = iface.getEvent('Transfer').topicHash; const zero = '0x' + '0'.repeat(64); const wallet = String(p.wallet).toLowerCase();
  const ids = [];
  for (const log of receipt.logs || []) {
    if (String(log.address).toLowerCase() !== NFT_CONTRACT) continue;
    if (!log.topics || log.topics[0] !== topic || log.topics.length < 4) continue;
    if (String(log.topics[1]).toLowerCase() !== zero) continue;
    if ('0x' + String(log.topics[2]).slice(26).toLowerCase() !== wallet) continue;
    ids.push(String(BigInt(log.topics[3])));
  }
  if (ids.length !== pending.count) return json(res, 400, { ok: false, error: 'minted count mismatch' });
  for (const id of ids) { if (!(await v3HasAttrs(id))) return json(res, 400, { ok: false, error: 'NFT has no game attributes' }); }
  for (let i = 0; i < ids.length; i++) {
    const so = makeSoldier(p.id, Object.assign({}, pending.specs[i], { nftId: ids[i], status: 'idle' }));
    p.roster.push(so);
    p.nftTokenIds = Array.from(new Set([...(p.nftTokenIds || []), ids[i]]));
  }
  p.nft = (p.nft || 0) + ids.length;
  delete state.recruitPending[nonce];
  state.depositTxs[hash] = { player: p.id, minted: ids, at: Date.now() };
  syncRoster(p); state.version++; save();
  addEvent('recruit', p, '', p.name + ' recruited ' + ids.length);
  json(res, 200, Object.assign({ ok: true, minted: ids }, snapshot())); broadcast();
  } finally { endConfirm(hash); }
}
async function signRecruitQuote(p, so) {
  const data = recruitData(so);
  const nonce = crypto.randomBytes(16).toString('hex');
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const c = new ethers.Contract(NFT_CONTRACT, V4_RECRUIT_ABI, getReadProvider());
  const hash = await c.recruitHash(p.wallet, data, BigInt('0x' + nonce), deadline);
  const signature = await getVaultSigner().signMessage(ethers.getBytes(hash));
  return { nft: NFT_CONTRACT, fee: '100000000', data, nonce, deadline, signature };
}
async function handleBirthMint(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  const birth = state.births.find((b) => b.id === body.birthId && b.playerId === p.id);
  if (!birth || !birth.ready || !birth.child) return json(res, 400, { ok: false, error: 'birth not ready' });
  if (birth._minting || state.birthPending[body.birthId]) return json(res, 409, { ok: false, error: 'birth mint already prepared' });
  const father = soldierOf(p, birth.fatherId), mother = soldierOf(p, birth.motherId);
  if (!father || !mother) return json(res, 400, { ok: false, error: 'parents missing' });
  const birthFee = Math.max(0, Number(birth.fee) || 0);
  if (birthFee > 0) {
    try { await verifyOrePayment(body.txHash, p.wallet, birthFee, DEAD_ADDRESS); }
    catch (e) { return json(res, 400, { ok: false, error: e.message }); }
  }
  const child = makeSoldier(p.id, Object.assign({}, birth.child, { status: 'idle' }));
  const data = recruitData(child, father.nftId, mother.nftId);
  const nonce = crypto.randomBytes(16).toString('hex');
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const c = new ethers.Contract(NFT_CONTRACT, V4_RECRUIT_ABI, getReadProvider());
  let hash;
  try { hash = await c.recruitHash(p.wallet, data, BigInt('0x' + nonce), deadline); }
  catch (e) { if (birthFee > 0) releasePayment(body.txHash); return json(res, 502, { ok: false, error: 'birth quote failed: ' + (e.shortMessage || e.message) }); }
  const signature = await getVaultSigner().signMessage(ethers.getBytes(hash));
  state.birthPending[body.birthId] = { playerId: p.id, birthId: body.birthId, child, data, nonce, deadline, signature, paymentHash: body.txHash || '', at: Date.now() };
  save();
  json(res, 200, { ok: true, nft: NFT_CONTRACT, fee: '0', data, nonce, deadline, signature, birthId: body.birthId });
}
async function handleBirthPending(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const q = state.birthPending[body.birthId];
  if (!q || q.playerId !== a.player.id) return json(res, 404, { ok: false, error: 'no pending birth quote' });
  if (q.deadline < Math.floor(Date.now() / 1000)) {
    const data = q.data;
    const nonce = crypto.randomBytes(16).toString('hex');
    const deadline = Math.floor(Date.now() / 1000) + 600;
    const c = new ethers.Contract(NFT_CONTRACT, V4_RECRUIT_ABI, getReadProvider());
    const hash = await c.recruitHash(a.player.wallet, data, BigInt('0x' + nonce), deadline);
    q.signature = await getVaultSigner().signMessage(ethers.getBytes(hash));
    q.nonce = nonce; q.deadline = deadline; save();
  }
  json(res, 200, { ok: true, nft: NFT_CONTRACT, fee: '0', data: q.data, nonce: q.nonce, deadline: q.deadline, signature: q.signature, birthId: body.birthId });
}
async function handleBirthConfirm(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  const q = state.birthPending[body.birthId];
  if (!q || q.playerId !== p.id) return json(res, 400, { ok: false, error: 'birth quote not found' });
  const birth = state.births.find((b) => b.id === body.birthId && b.playerId === p.id);
  if (!birth) return json(res, 400, { ok: false, error: 'birth missing' });
  const hash = clean(body.txHash, 80);
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return json(res, 400, { ok: false, error: 'mint tx hash required' });
  if (state.depositTxs[hash]) return json(res, 409, { ok: false, error: 'tx already used' });
  if (!beginConfirm(hash)) return json(res, 409, { ok: false, error: 'confirmation in progress' });
  try {
  let receipt = null;
  for (let i = 0; i < 8; i++) { receipt = await rpcCall('eth_getTransactionReceipt', [hash]); if (receipt) break; await new Promise((r) => setTimeout(r, 1200)); }
  if (!receipt) return json(res, 404, { ok: false, error: 'mint tx not confirmed' });
  if (String(receipt.status) !== '0x1' && Number(receipt.status) !== 1) return json(res, 400, { ok: false, error: 'mint tx reverted' });
  const iface = new ethers.Interface(['event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)']);
  const topic = iface.getEvent('Transfer').topicHash; const zero = '0x' + '0'.repeat(64); const wallet = String(p.wallet).toLowerCase();
  let tokenId = null;
  for (const log of receipt.logs || []) {
    if (String(log.address).toLowerCase() !== NFT_CONTRACT) continue;
    if (!log.topics || log.topics[0] !== topic || log.topics.length < 4) continue;
    if (String(log.topics[1]).toLowerCase() !== zero) continue;
    if ('0x' + String(log.topics[2]).slice(26).toLowerCase() !== wallet) continue;
    tokenId = String(BigInt(log.topics[3])); break;
  }
  if (!tokenId) return json(res, 400, { ok: false, error: 'no NFT minted to player in tx' });
  if (!(await v3HasAttrs(tokenId))) return json(res, 400, { ok: false, error: 'NFT has no game attributes' });
  const father = soldierOf(p, birth.fatherId), mother = soldierOf(p, birth.motherId);
  if (!father || !mother) return json(res, 400, { ok: false, error: 'parents missing' });
  const child = makeSoldier(p.id, Object.assign({}, q.child, { nftId: tokenId, status: 'idle' }));
  p.roster.push(child); p.nft = (p.nft || 0) + 1; p.nftTokenIds = Array.from(new Set([...(p.nftTokenIds || []), tokenId]));
  if (!father.children) father.children = []; if (!mother.children) mother.children = [];
  father.children.push(child.id); mother.children.push(child.id);
  state.births = state.births.filter((b) => b.id !== birth.id);
  delete state.birthPending[body.birthId];
  state.depositTxs[hash] = { player: p.id, minted: [tokenId], at: Date.now() };
  if (q.paymentHash) finishPayment(q.paymentHash, p.id, Math.max(0, Number(birth.fee) || 0));
  syncRoster(p); state.version++; save();
  addEvent('birth', p, '', p.name + ' child #' + tokenId + ' minted');
  json(res, 200, Object.assign({ ok: true, tokenId, child }, snapshot())); broadcast();
  } finally { endConfirm(hash); }
}
const V4_RECRUIT_ABI = new ethers.Interface([
  'function recruitHash(address,(uint16,uint16,uint16,uint16,uint16,uint32,uint32,uint16,uint64,string),uint256,uint256) view returns (bytes32)',
  'function recruitBatchHash(address,(uint16,uint16,uint16,uint16,uint16,uint32,uint32,uint16,uint64,string)[],uint256,uint256) view returns (bytes32)',
]);
function recruitData(so, fatherNft, motherNft) {
  return [
    Math.max(1, Math.min(65535, Math.round(Number(so.atk) || 1))),
    Math.max(1, Math.min(65535, Math.round(Number(so.def) || 1))),
    Math.max(1, Math.min(65535, Math.round(Number(so.spd) || 1))),
    Math.max(1, Math.min(65535, Math.round(Number(so.gen) || 1))),
    Math.max(1, Math.min(65535, Math.round(Number(so.power) || (so.atk + so.def + so.spd) || 1))),
    Number(fatherNft || 0) >>> 0, Number(motherNft || 0) >>> 0, 1000, Math.floor(Date.now() / 1000), String(so.cls || 'vanguard'),
  ];
}
async function handleRecruitPrepare(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  if ((p.nft || 0) >= 10000) return json(res, 400, { ok: false, error: 'wallet NFT limit' });
  const so = makeSoldier(p.id, {});
  const data = recruitData(so);
  const nonce = crypto.randomBytes(16).toString('hex');
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const c = new ethers.Contract(NFT_CONTRACT, V4_RECRUIT_ABI, getReadProvider());
  let hash;
  try { hash = await c.recruitHash(p.wallet, data, BigInt('0x' + nonce), deadline); }
  catch (e) { return json(res, 502, { ok: false, error: 'recruit quote failed: ' + (e.shortMessage || e.message) }); }
  const signer = getVaultSigner();
  const signature = await signer.signMessage(ethers.getBytes(hash));
  state.recruitPending[nonce] = { playerId: p.id, data, so, deadline, createdAt: Date.now() };
  save();
  json(res, 200, { ok: true, nft: NFT_CONTRACT, fee: '100000000', data, nonce, deadline, signature });
}
async function handleRecruitConfirm(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  const hash = clean(body.txHash, 80);
  const nonce = clean(body.nonce, 64);
  const pending = state.recruitPending[nonce];
  if (!pending || pending.playerId !== p.id) return json(res, 400, { ok: false, error: 'recruit quote not found' });
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return json(res, 400, { ok: false, error: 'mint tx hash required' });
  if (state.depositTxs[hash]) return json(res, 409, { ok: false, error: 'tx already used' });
  if (!beginConfirm(hash)) return json(res, 409, { ok: false, error: 'confirmation in progress' });
  try {
  let receipt = null;
  for (let i = 0; i < 8; i++) {
    receipt = await rpcCall('eth_getTransactionReceipt', [hash]);
    if (receipt) break;
    await new Promise((r) => setTimeout(r, 1200));
  }
  if (!receipt) return json(res, 404, { ok: false, error: 'mint tx not confirmed' });
  if (String(receipt.status) !== '0x1' && Number(receipt.status) !== 1) return json(res, 400, { ok: false, error: 'mint tx reverted' });
  const iface = new ethers.Interface(['event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)']);
  const topic = iface.getEvent('Transfer').topicHash;
  const zero = '0x' + '0'.repeat(64); const wallet = String(p.wallet).toLowerCase();
  let tokenId = null;
  for (const log of receipt.logs || []) {
    if (String(log.address).toLowerCase() !== NFT_CONTRACT) continue;
    if (!log.topics || log.topics[0] !== topic || log.topics.length < 4) continue;
    if (String(log.topics[1]).toLowerCase() !== zero) continue;
    if ('0x' + String(log.topics[2]).slice(26).toLowerCase() !== wallet) continue;
    tokenId = String(BigInt(log.topics[3])); break;
  }
  if (!tokenId) return json(res, 400, { ok: false, error: 'no NFT minted to player in tx' });
  if (!(await v3HasAttrs(tokenId))) return json(res, 400, { ok: false, error: 'NFT has no game attributes' });
  const so = makeSoldier(p.id, Object.assign({}, pending.so, { nftId: tokenId, status: 'idle' }));
  p.roster.push(so);
  p.nft = (p.nft || 0) + 1;
  p.nftTokenIds = Array.from(new Set([...(p.nftTokenIds || []), tokenId]));
  delete state.recruitPending[nonce];
  state.depositTxs[hash] = { player: p.id, minted: [tokenId], at: Date.now() };
  syncRoster(p); state.version++; save();
  addEvent('recruit', p, '', p.name + ' recruited #' + tokenId);
  json(res, 200, Object.assign({ ok: true, minted: [tokenId] }, snapshot())); broadcast();
  } finally { endConfirm(hash); }
}
const V3_ABI = [
  'function mintTo(address,(uint16,uint16,uint16,uint16,uint16,uint32,uint32,uint16,uint64,string)) returns (uint256)',
  'function mintChild(address,(uint16,uint16,uint16,uint16,uint16,uint32,uint32,uint16,uint64,string)) returns (uint256)',
  'event SoldierMinted(uint256 indexed tokenId,address indexed to,uint16 atk,uint16 def,uint16 spd,uint16 gen,uint16 power,uint32 fatherId,uint32 motherId,uint16 factor)',
];
async function mintSoldierV3Now(player, so, fatherNft, motherNft) {
  const signer = getVaultSigner().connect(getReadProvider());
  const c = new ethers.Contract(NFT_CONTRACT, V3_ABI, signer);
  const d = [
    Math.max(1, Math.min(65535, Math.round(Number(so.atk) || 1))),
    Math.max(1, Math.min(65535, Math.round(Number(so.def) || 1))),
    Math.max(1, Math.min(65535, Math.round(Number(so.spd) || 1))),
    Math.max(1, Math.min(65535, Math.round(Number(so.gen) || 1))),
    Math.max(1, Math.min(65535, Math.round(Number(so.power) || (so.atk + so.def + so.spd) || 1))),
    Number(fatherNft || 0) >>> 0,
    Number(motherNft || 0) >>> 0,
    Math.round(Number(so.factor) || 1100),
    BigInt(Math.floor(Date.now() / 1000)),
    String(so.cls || 'vanguard'),
  ];
  const tx = fatherNft ? await c.mintChild(player.wallet, d) : await c.mintTo(player.wallet, d);
  const rec = await tx.wait();
  const iface = new ethers.Interface(V3_ABI);
  for (const log of rec.logs || []) {
    try {
      const ev = iface.parseLog(log);
      if (ev && ev.name === 'SoldierMinted') return String(ev.args.tokenId);
    } catch (e) {}
  }
  throw new Error('NFT minted but SoldierMinted event missing');
}
async function handleRecruit(req, res) {
  const body = await readBody(req);
  const a = authPlayer(body);
  if (a.error) return json(res, 401, { ok: false, error: a.error });
  const p = a.player;
  if ((p.nft || 0) >= 10000) return json(res, 400, { ok: false, error: 'wallet NFT limit' });
  const so = makeSoldier(p.id, {});
  let tokenId;
  try { tokenId = await mintSoldierV3(p, so, 0, 0); }
  catch (e) { return json(res, 502, { ok: false, error: 'NFT mint failed: ' + (e.shortMessage || e.message) }); }
  so.nftId = tokenId;
  p.roster.push(so);
  p.nft = (p.nft || 0) + 1;
  p.nftTokenIds = Array.from(new Set([...(p.nftTokenIds || []), tokenId]));
  syncRoster(p); state.version++; save();
  audit('mint_recruit', { player: p.id, tokenId });
  addEvent('recruit', p, '', p.name + ' recruited soldier #' + tokenId);
  json(res, 200, Object.assign({ ok: true, minted: [tokenId] }, snapshot())); broadcast();
}
function resolveBattles() {
  if (!state.battles.length) return;
  const now = Date.now();
  let changed = false;
  const keep = [];
  for (const b of state.battles) {
    if (b.resolveAt > now) { keep.push(b); continue; }
    const p = state.players[b.playerId];
    const z = zoneOf(b.zoneId);
    changed = true;
    if (!p || !z) { b.result = 'cancelled'; continue; }
    const owner = state.owners[String(b.zoneId)];
    const back = (p.roster || []).filter((x) => b.soldierIds.includes(x.id) && x.status === 'attacking');
    if (owner === p.clan) {
      for (const s of back) s.status = 'idle';
      syncRoster(p);
      addEvent('cancel', p, b.code, p.name + ' reached ' + b.code);
      continue;
    }
    const atk = Math.max(1, Math.floor(b.troops * (1 + (Number(b.atk) || 0) / 30) * (0.9 + Math.random() * 0.25)));
    const def = Math.max(1, (Number(state.defenses[String(b.zoneId)]) || 12) + garrisonPower(b.zoneId) + Number(state.forts[String(b.zoneId)] || 0) * 12);
    if (atk > def) {
      const loot = state.vaults[String(b.zoneId)] || 0;
      const defenderClan = owner;
      const defenderDead = garrisonSoldiers(b.zoneId).length;
      removeGarrison(b.zoneId);
      state.owners[String(b.zoneId)] = p.clan;
      state.defenses[String(b.zoneId)] = Math.max(8, Math.floor(atk * 0.32));
      p.captures++;
      p.kills += Math.max(0, Math.floor(def / 3));
      state.vaults[String(b.zoneId)] = 0;
      const keep = Math.max(1, Math.floor(b.troops * 0.6));
      const survivors = [];
      back.forEach((s, i) => {
        if (i < keep) { s.status = 'garrison'; s.zoneId = b.zoneId; survivors.push(s.id); }
        else { s.status = 'dead'; s.zoneId = null; s.reviveAt = Date.now() + 10 * 60 * 1000; }
      });
      state.garrisons[String(b.zoneId)] = survivors;
      const survivorSols = back.filter((x) => x.status === 'garrison');
      const lootPower = survivorSols.reduce((a, x) => a + Math.max(1, x.atk + x.def + x.spd), 0);
      if (loot > 0 && lootPower > 0) {
        for (const so of survivorSols) so.pocket = (so.pocket || 0) + loot * Math.max(1, so.atk + so.def + so.spd) / lootPower;
      } else if (loot > 0) {
        p.ore += loot;
      }
      syncRoster(p);
      state.results.push({ zoneId: b.zoneId, playerId: p.id, attacker: p.clan, attackerDead: back.filter((x) => x.status === 'dead').length, defender: defenderClan, defenderDead, loot, t: Date.now() });
      if (state.results.length > 20) state.results = state.results.slice(-20);
      addEvent('capture', p, b.code, p.name + ' captured ' + b.code);
      state.totalClaims++;
    } else {
      state.defenses[String(b.zoneId)] = Math.max(4, def - Math.max(1, Math.floor(b.troops * 0.28)));
      p.kills += Math.max(0, Math.floor(b.troops * 0.2));
      for (const s of back) { s.status = 'dead'; s.reviveAt = Date.now() + 10 * 60 * 1000; }
      syncRoster(p);
      state.results.push({ zoneId: b.zoneId, playerId: p.id, attacker: p.clan, attackerDead: back.length, defender: owner, defenderDead: 0, loot: 0, t: Date.now() });
      if (state.results.length > 20) state.results = state.results.slice(-20);
      addEvent('defeat', p, b.code, p.name + ' failed at ' + b.code);
    }
    save();
  }
  state.battles = keep;
  if (changed) { state.version++; broadcast(); }
}
function distributeDailyBudget(amount) {
  const mines = (state.manifest && state.manifest.zones || []).filter((z) => z.kind === 'mine' && state.owners[String(z.id)]);
  const total = mines.reduce((a, z) => a + (Number(z.weight) || 1), 0) || 1;
  for (const z of mines) {
    const share = amount * (Number(z.weight) || 1) / total;
    const vaultShare = share * 0.2;
    const pocketShare = share * 0.8;
    const gs = garrisonSoldiers(z.id);
    state.vaults[String(z.id)] = (state.vaults[String(z.id)] || 0) + vaultShare;
    if (gs.length) {
      const power = gs.reduce((a, g) => a + Math.max(1, g.x.atk + g.x.def + g.x.spd), 0);
      for (const g of gs) g.x.pocket = (g.x.pocket || 0) + pocketShare * Math.max(1, g.x.atk + g.x.def + g.x.spd) / power;
    } else {
      state.vaults[String(z.id)] += pocketShare;
    }
  }
}
function dailyEmission() {
  if (!state.manifest) return;
  const now = Date.now();
  const day = new Date().toISOString().slice(0, 10);
  if (state.lastEmissionDay !== day) {
    // Finalize any unaccrued part of the previous day before opening a new one.
    const leftover = Math.max(0, (Number(state.dayBudget) || 0) - (Number(state.dayDistributed) || 0));
    if (leftover > 0) distributeDailyBudget(leftover);
    state.lastEmissionDay = day;
    state.dayBudget = Math.floor(state.minePool * 0.01);
    state.minePool -= state.dayBudget;
    state.totalEmitted += state.dayBudget;
    state.dayAccrualAt = now;
    state.dayDistributed = 0;
    addEvent('emission', { clan: null, name: 'system' }, '', 'daily budget ' + state.dayBudget);
    state.version++; save(); broadcast();
    return;
  }
  if (!state.dayAccrualAt) { state.dayAccrualAt = now; save(); return; }
  const elapsed = Math.max(0, Math.min(now - state.dayAccrualAt, 60 * 60 * 1000));
  if (elapsed < 1000) return;
  const remaining = Math.max(0, state.dayBudget - state.dayDistributed);
  const amount = Math.min(remaining, state.dayBudget * elapsed / 86400000);
  if (amount <= 0) { state.dayAccrualAt = now; return; }
  state.dayAccrualAt = now;
  state.dayDistributed += amount;
  distributeDailyBudget(amount);
  state.version++; save(); broadcast();
}
function processBirths() {
  if (!state.births.length) return;
  let changed = false;
  const now = Date.now();
  for (const b of state.births) {
    if (b.dueAt > now || b.ready) continue;
    const p = state.players[b.playerId];
    if (!p || !b.child) { b.ready = true; b.readyAt = now; changed = true; continue; }
    const father = soldierOf(p, b.fatherId), mother = soldierOf(p, b.motherId);
    if (!father || !mother) { b.ready = true; b.readyAt = now; changed = true; continue; }
    b.ready = true; b.readyAt = now;
    mother.pregnant = false; mother.birthId = null; mother.status = 'idle'; mother.dueAt = 0;
    const cd = (b.breedAt || now) + E.breedCooldown;
    if ((father.cdUntil || 0) < cd) father.cdUntil = cd;
    if ((mother.cdUntil || 0) < cd) mother.cdUntil = cd;
    syncRoster(p);
    addEvent('birth', p, '', p.name + ' child ready; mint NFT');
    changed = true;
  }
  if (changed) { state.version++; save(); broadcast(); }
}
function processRevives() {
  const now = Date.now();
  let changed = false;
  for (const p of Object.values(state.players)) {
    let pc = false;
    for (const so of (p.roster || [])) {
      if (so.status === 'dead' && so.reviveAt && so.reviveAt <= now) { so.status = 'idle'; so.zoneId = null; so.reviveAt = 0; pc = changed = true; }
    }
    if (pc) syncRoster(p);
  }
  if (changed) { state.version++; save(); broadcast(); }
}
const V3_META_ABI = new ethers.Interface(['function soldiers(uint256) view returns(uint16 atk,uint16 def,uint16 spd,uint16 gen,uint16 power,uint32 fatherId,uint32 motherId,uint16 factor,uint64 bornAt,string cls)']);
const nftMetaCache = new Map();
async function readV3Soldier(id) {
  const now = Date.now();
  const hit = nftMetaCache.get(String(id));
  if (hit && now - hit.at < 60000) return hit.value;
  const data = V3_META_ABI.encodeFunctionData('soldiers', [BigInt(id)]);
  const out = await rpcCall('eth_call', [{ to: NFT_CONTRACT, data }, 'latest']);
  const v = V3_META_ABI.decodeFunctionResult('soldiers', out || '0x');
  const value = { atk: Number(v.atk), def: Number(v.def), spd: Number(v.spd), gen: Number(v.gen), power: Number(v.power), fatherId: Number(v.fatherId), motherId: Number(v.motherId), factor: Number(v.factor), bornAt: Number(v.bornAt), cls: String(v.cls || '') };
  nftMetaCache.set(String(id), { at: now, value });
  return value;
}
function metaBase(req) {
  const env = String(process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  if (env) return env;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0] || 'http';
  return proto + '://' + (req.headers.host || '127.0.0.1:8091');
}
function escXml(x) { return String(x).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c])); }
function soldierSvg(id, s) {
  const cls = s.cls || 'soldier';
  const color = cls === 'archer' ? '#5ba8ff' : cls === 'warlock' ? '#b98cff' : cls === 'guard' ? '#f2ce4b' : '#ff5b45';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">'
    + '<defs><radialGradient id="g" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="#1c2420"/><stop offset="1" stop-color="#070a09"/></radialGradient></defs>'
    + '<rect width="600" height="600" fill="url(#g)"/>'
    + '<circle cx="300" cy="230" r="120" fill="' + color + '" opacity="0.14"/>'
    + '<circle cx="300" cy="230" r="108" fill="none" stroke="' + color + '" stroke-width="2" opacity="0.55"/>'
    + '<text x="300" y="205" text-anchor="middle" fill="' + color + '" font-family="monospace" font-size="22" letter-spacing="6">矿域</text>'
    + '<text x="300" y="260" text-anchor="middle" fill="#f4f1e8" font-family="serif" font-size="54" font-weight="bold">#' + id + '</text>'
    + '<text x="300" y="305" text-anchor="middle" fill="' + color + '" font-family="monospace" font-size="18" letter-spacing="4">' + escXml(String(cls).toUpperCase()) + '</text>'
    + '<g font-family="monospace" font-size="16" fill="#cfd6cd">'
    + '<text x="150" y="430">ATK ' + s.atk + '</text><text x="300" y="430">DEF ' + s.def + '</text><text x="450" y="430">SPD ' + s.spd + '</text>'
    + '<text x="150" y="470">GEN ' + s.gen + '</text><text x="300" y="470">POWER ' + s.power + '</text><text x="450" y="470">FACTOR ' + s.factor + '</text>'
    + '</g><rect x="40" y="520" width="520" height="1" fill="' + color + '" opacity="0.35"/>'
    + '<text x="300" y="555" text-anchor="middle" fill="#7e887f" font-family="monospace" font-size="12" letter-spacing="3">ON-CHAIN SOLDIER · BSC TESTNET</text>'
    + '</svg>';
}
function nftMetadata(req, id, s) {
  const base = metaBase(req);
  return {
    name: 'Ore Soldier #' + id,
    description: '矿域 on-chain soldier. Attributes are read from the OreSoldierV3 soldiers mapping.',
    image: base + '/nft/' + id + '.svg',
    external_url: base + '/index.html',
    attributes: [
      { trait_type: 'ATK', value: s.atk }, { trait_type: 'DEF', value: s.def }, { trait_type: 'SPD', value: s.spd },
      { trait_type: 'GEN', value: s.gen }, { trait_type: 'POWER', value: s.power }, { trait_type: 'CLASS', value: s.cls },
      { trait_type: 'FATHER', value: s.fatherId }, { trait_type: 'MOTHER', value: s.motherId }, { trait_type: 'FACTOR', value: s.factor },
    ],
  };
}
function nftJson(req, res, id) {
  readV3Soldier(id).then((s) => {
    if (!s.atk) { res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }); return res.end('{"error":"not found"}'); }
    const body = JSON.stringify(nftMetadata(req, id, s));
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'public, max-age=60', 'Access-Control-Allow-Origin': '*' });
    res.end(body);
  }).catch(() => { res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }); res.end('{"error":"rpc"}'); });
}
function nftImage(res, id) {
  readV3Soldier(id).then((s) => {
    if (!s.atk) { res.writeHead(404); return res.end('not found'); }
    const body = soldierSvg(id, s);
    res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' });
    res.end(body);
  }).catch(() => { res.writeHead(502); res.end('rpc'); });
}
const server = http.createServer(async (req, res) => {
  res._corsOrigin = corsOrigin(req);
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let hit = ipHits.get(ip);
  if (!hit || now - hit.at > 60000) { hit = { at: now, n: 0 }; ipHits.set(ip, hit); }
  hit.n++;
  if (hit.n > 240) return json(res, 429, { ok: false, error: 'rate limit' });
  if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(res)); return res.end(); }
  const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const nm = u.pathname.match(/^\/nft\/([0-9]+)(\.svg)?$/);
  if (req.method === 'GET' && nm) {
    const id = Number(nm[1]);
    if (!Number.isInteger(id) || id < 1 || id > 10000) { res.writeHead(400, { 'Access-Control-Allow-Origin': '*' }); return res.end('bad id'); }
    return nm[2] ? nftImage(res, id) : nftJson(req, res, id);
  }
  if (req.method === 'GET' && u.pathname === '/health') {
    return json(res, 200, { ok: true, online: onlinePlayers().length, players: Object.keys(state.players).length, seed: state.seed, version: state.version, totalClaims: state.totalClaims, battles: state.battles.length, manifest: !!state.manifest, storage: storage.mode });
  }
  if (req.method === 'GET' && u.pathname === '/state') return json(res, 200, Object.assign({ ok: true }, snapshot()));
  if (req.method === 'GET' && u.pathname === '/vault/info') { try { return await handleVaultInfo(req, res); } catch (e) { return json(res, 500, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/vault/deposit') return json(res, 410, { ok: false, error: 'deposit disabled' });
  if (req.method === 'POST' && u.pathname === '/vault/withdraw') return json(res, 410, { ok: false, error: 'withdraw disabled' });
  if (req.method === 'GET' && u.pathname === '/who') {
    const address = clean(u.searchParams.get('address'), 64).toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(address)) return json(res, 400, { ok: false, error: 'invalid address' });
    const p = state.players['w:' + address];
    return json(res, 200, p ? { ok: true, exists: true, clan: p.clan, name: p.name, nft: p.nft || 0 } : { ok: true, exists: false });
  }
  if (req.method === 'GET' && u.pathname === '/map-hash') return json(res, 200, { ok: true, hash: state.manifest ? manifestHash(state.manifest) : null });
  if (req.method === 'GET' && u.pathname === '/wallet') {
    const a = clean(u.searchParams.get('address'), 64).toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(a)) return json(res, 400, { ok: false, error: 'invalid address' });
    const ore = await chainOreBalance(a);
    return json(res, 200, { ok: true, address: a, ore, rpc: !!ore });
  }
  if (req.method === 'GET' && u.pathname === '/nonce') { try { return await handleNonce(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/nonce') { try { return await handleNonce(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/login') { try { return await handleLogin(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/join') return json(res, 410, { ok: false, error: 'wallet login required; use /login' });
  if (req.method === 'POST' && u.pathname === '/heartbeat') { try { return await handleHeartbeat(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/marry') { try { return await handleMarry(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/station') { try { return await handleStation(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/withdraw') { try { return await handleZoneWithdraw(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/fortify') { try { return await handleFortify(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/birth/pending') { try { return await handleBirthPending(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/birth/confirm') { try { return await handleBirthConfirm(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/birth/mint') { try { return await handleBirthMint(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/breed') { try { return await handleBreed(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/market/onchain-lock') { try { return await handleOnchainLock(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/market/onchain-unlock') { try { return await handleOnchainUnlock(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (process.env.TEST_ADMIN === '1' && req.method === 'POST' && u.pathname === '/test/add-birth') {
    try {
      const b = await readBody(req); const a = authPlayer(b);
      if (a.error) return json(res, 401, { ok: false, error: a.error });
      const f = soldierOf(a.player, b.fatherId), m = soldierOf(a.player, b.motherId);
      if (!f || !m) return json(res, 404, { ok: false, error: 'parents missing' });
      const child = makeSoldier(a.player.id, { gender: 'f', atk: 100, def: 100, spd: 100, gen: 2, parents: [f.id, m.id], ancestors: [f.id, m.id] });
      const birth = { id: 'test-' + crypto.randomBytes(4).toString('hex'), playerId: a.player.id, fatherId: f.id, motherId: m.id, dueAt: Date.now() - 1000, breedAt: Date.now() - 60000, fee: Number(b.fee) || 300, ready: true, readyAt: Date.now(), child };
      state.births.push(birth); state.version++; save();
      return json(res, 200, Object.assign({ ok: true, birthId: birth.id }, snapshot()));
    } catch (e) { return json(res, 400, { ok: false, error: e.message }); }
  }
  if (process.env.TEST_ADMIN === '1' && req.method === 'POST' && u.pathname === '/test/repair-roster') {
    try {
      const b = await readBody(req); const a = authPlayer(b);
      if (a.error) return json(res, 401, { ok: false, error: a.error });
      for (const so of a.player.roster || []) { if (so.status === 'dead' && String(so.nftId) !== '10') { so.status = 'idle'; so.zoneId = null; so.reviveAt = 0; so.nftMissingDead = false; } }
      syncRoster(a.player); state.version++; save();
      return json(res, 200, Object.assign({ ok: true }, snapshot()));
    } catch (e) { return json(res, 400, { ok: false, error: e.message }); }
  }
  if (process.env.TEST_ADMIN === '1' && req.method === 'POST' && u.pathname === '/test/set-pocket') {
    try {
      const b = await readBody(req); const a = authPlayer(b);
      if (a.error) return json(res, 401, { ok: false, error: a.error });
      const so = soldierOf(a.player, b.soldierId);
      if (!so) return json(res, 404, { ok: false, error: 'soldier missing' });
      so.pocket = Math.max(0, Number(b.pocket) || 0); syncRoster(a.player); state.version++; save();
      return json(res, 200, Object.assign({ ok: true }, snapshot()));
    } catch (e) { return json(res, 400, { ok: false, error: e.message }); }
  }
  if (req.method === 'POST' && u.pathname === '/market/list') { try { return await handleMarketList(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/market/cancel') { try { return await handleMarketCancel(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/market/buy') { try { return await handleMarketBuy(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/pool/add') return json(res, 410, { ok: false, error: 'liquidity disabled' });
  if (req.method === 'POST' && u.pathname === '/pool/remove') return json(res, 410, { ok: false, error: 'liquidity disabled' });
  if (req.method === 'POST' && u.pathname === '/claim') return json(res, 410, { ok: false, error: 'use /attack' });
  if (req.method === 'POST' && u.pathname === '/attack') { try { return await handleAttack(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/burn/payout') { try { return await handleBurnPayout(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/burn') { try { return await handleBurn(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/sync') { try { return await handleSync(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/recruit/batch/prepare') { try { return await handleRecruitBatchPrepare(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/recruit/batch/confirm') { try { return await handleRecruitBatchConfirm(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/recruit/prepare') { try { return await handleRecruitPrepare(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/recruit/confirm') { try { return await handleRecruitConfirm(req, res); } catch (e) { return json(res, 400, { ok: false, error: e.message }); } }
  if (req.method === 'POST' && u.pathname === '/recruit') return json(res, 410, { ok: false, error: 'use /recruit/prepare + /recruit/confirm' });
  if (req.method === 'GET' && u.pathname === '/events') {
    res.writeHead(200, Object.assign({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' }, corsHeaders(res)));
    res.write('retry: 2000\n\n');
    sseClients.add(res);
    res.write('data: ' + JSON.stringify(snapshot()) + '\n\n');
    const beat = setInterval(() => {
      try { res.write(': keepalive\n\n'); } catch (e) { clearInterval(beat); sseClients.delete(res); }
    }, 15000);
    req.on('close', () => { clearInterval(beat); sseClients.delete(res); });
    return;
  }
  json(res, 404, { ok: false, error: 'not found' });
});
(async () => {
  await storage.init();
  await load();
  setInterval(() => { resolveBattles(); dailyEmission(); processBirths(); processRevives(); }, TICK_MS);
setInterval(() => {
  const online = onlinePlayers();
  const sig = online.map((p) => p.id).sort().join(',');
  if (sig !== lastOnline) { lastOnline = sig; broadcast(); }
}, 5000);
setInterval(() => { try { save(); } catch (e) {} }, 10000);
  server.listen(PORT, HOST, () => {
    console.log('[world] 矿域 world server on http://' + HOST + ':' + PORT + ' (seed ' + state.seed + ')');
  });
})();
process.on('SIGTERM', () => { save(); storage.close(); setTimeout(() => process.exit(0), 50); });
process.on('SIGINT', () => { save(); storage.close(); setTimeout(() => process.exit(0), 50); });
