/* 矿域 ORE.ZONE — game state, war, bloodline, market and the loop */
(function () {
'use strict';
const ORE = (window.ORE = window.ORE || {});
const U = ORE.util, D = ORE.data, E = D.ECON, EC = ORE.econ;

const SAVE_KEY = 'orezone.save.v10';
const NFT_CONTRACT = '0x400e42D03dCf80D31fE45B57Daf3E0504a9dA240';
const TOKENS_OF_OWNER = '0x8462151c';
const NFT_TRANSFER = '0x23b872dd';
const ORE_BURNER = '0x3d66d3B0dbFA860eAC039F5d62E2a3DABf20Ba5f';
const BURN_BATCH = '0xe4623c1b';
const APPROVE_ONE = '0x095ea7b3';   // approve(address,uint256) 单 token 授权
const GET_APPROVED = '0x081812fc';  // getApproved(uint256)
const IS_APPROVED_ALL = '0xe985e9c5';
const SET_APPROVAL_ALL = '0xa22cb465'; // setApprovalForAll(address,bool) // 已弃用：不再用 setApprovalForAll
const NFT_OWNER = '0x6352211e';
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const OFFLINE_MAX = 8 * 3600000;
const BATTLE_MS = 30000;
const REVIVE_MS = 10 * 60 * 1000;

let SERVER_EPOCH = null;
let SERVER_PERF = null;
function now() {
  if (SERVER_EPOCH != null && typeof performance !== 'undefined' && performance.now) {
    return SERVER_EPOCH + (performance.now() - SERVER_PERF);
  }
  return Date.now();
}
function rand(a, b) { return a + Math.random() * (b - a); }
function irand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

const G = {
  state: null,
  world: null,
  SAVE_KEY,
  clockNow: () => now(),

  /* ---------------- server clock ---------------- */
  timeApi() {
    const host = (typeof location !== 'undefined' && location.hostname) ? location.hostname : '127.0.0.1';
    return 'http://' + host + ':8090/time';
  },
  async syncServerTime() {
    try {
      const r = await fetch(this.timeApi(), { cache: 'no-store' });
      if (!r.ok) return false;
      const j = await r.json();
      if (!j || !j.now) return false;
      // Anchor to server epoch + monotonic page time. Changing the OS clock
      // after this point does not move the game clock.
      SERVER_EPOCH = Number(j.now);
      SERVER_PERF = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
      return true;
    } catch (e) { return false; }
  },

  /* ---------------- boot ---------------- */
  boot() {
    let saved = null;
    try { saved = U.storageGet(SAVE_KEY, null); } catch (e) { saved = null; }
    if (saved && !saved.version) saved = null;
    if (saved && saved.version !== 9) saved = null;
    const mp = (typeof window !== 'undefined') ? window.ORE_MP_CONFIG : null;
    if (mp && mp.enabled) {
      // A shared world must use one seed for every client. Existing solo saves
      // with another seed are reset when entering multiplayer mode.
      if (saved && Number(saved.worldSeed) !== Number(mp.seed)) {
        saved = null;
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
      }
      // Multiplayer always starts at faction selection. Even if a previous
      // local save was in the 'playing' phase, do not hydrate it into the shared
      // world; the server remains authoritative and the wallet session handles
      // re-entry. This guarantees the player chooses a faction first.
      saved = null;
    }
    const seed = (mp && mp.enabled) ? Number(mp.seed) : (saved && saved.worldSeed ? saved.worldSeed : (Math.floor(Math.random() * 900000000) + 100000000));
    this.world = ORE.world.generate(seed);
    if (saved) {
      try { this.hydrate(saved); return { resumed: true }; } catch (e) {
        console.error('存档损坏，已开新局', e);
      }
    }
    this.lobby();
    return { resumed: false };
  },

  lobby() {
    const w = this.world;
    const n = now();
    const ai = {};
    for (const c of D.CLANS) {
      const zs = w.cells.filter((z) => z.owner === c.key && z.kind === 'mine').length;
      ai[c.key] = { troops: 333 - zs * E.aiGarrison - 12, chest: 0, pocket: 0, nextAction: n + 15000, nextBreed: n + 20000 };
    }
    this.state = {
      version: 9,
      worldSeed: w.seed,
      phase: 'lobby',
      clan: null,
      commander: null,
      createdAt: n,
      lastSeen: n,
      lastTick: n,
      graceUntil: 0,
      totalWeight: w.totalWeight,
      player: { ore: 0, eth: 0, chest: 0, lp: 0 },
      econ: EC.initEcon(),
      ai,
      soldiers: [],
      dead: [],
      zones: w.cells,
      births: [],
      marches: [],
      battles: [],
      market: { listings: [], nextAi: n + 12000, nextBuy: n + 16000, nextNpcSale: n + 22000 },
      feed: [
        { t: n - 9000, type: 'world', icon: '◈', text: '三族陈兵，<b>三座基地</b>在球面上互相等距。', clan: null, mine: false },
        { t: n - 5000, type: 'world', icon: '◇', text: '链上军团尚未召唤：连接 BSC Testnet 钱包，铸造 NFT 后士兵才会进入游戏。', clan: null, mine: false },
      ],
      stats: { extracted: 0, burned: 0, born: 0, captured: 0, lost: 0, sold: 0, bought: 0, volume: 0, betrayed: 0, killed: 0 },
      params: { emission: 1, extraction: 1, breed: 1, fee: E.marketFee, terrainMode: '3d' },
      nextId: 1,
      onchainBound: [],
      selected: null,
      hints: {},
      _feedVersion: 0,
    };
    this.rebuildIndex();
    this.recalcWeights();
    this.syncMap();
  },

  enlist(clanKey) {
    const s = this.state;
    if (!s || s.phase !== 'lobby') return;
    const clan = D.CLAN[clanKey];
    if (!clan) return;
    const n = now();
    s.phase = 'playing';
    s.clan = clanKey;
    s.commander = this.makeCommander(clanKey);
    s.createdAt = n;
    s.lastTick = n;
    s.graceUntil = n + E.graceMs;
    s.player = { ore: E.startOre, eth: E.startEth, chest: 0, lp: 0 };
    s.econ = EC.initEcon();
    s.econ.treasuryOre = Math.max(0, s.econ.treasuryOre - E.startOre);
    s.econ.priceHist = [
      { t: n - 30000, p: EC.price(s), s: EC.supply(s), lp: s.econ.poolEth * 2, chest: 0 },
      { t: n, p: EC.price(s), s: EC.supply(s), lp: s.econ.poolEth * 2, chest: 0 },
    ];
    s.soldiers = [];
    s.dead = [];
    s.births = [];
    s.marches = [];
    s.battles = [];
    s.market = { listings: [], nextAi: n + 9000, nextBuy: n + 12000, nextNpcSale: n + 18000 };
    s.stats = { extracted: 0, burned: 0, born: 0, captured: 0, lost: 0, sold: 0, bought: 0, volume: 0, betrayed: 0, killed: 0 };
    s.feed = [];
    s.nextId = 1;
    s.onchainBound = [];
    s.hints = s.hints || {};
    delete s.ai[clanKey];

    // reset the player's mining zones and home base
    for (const z of s.zones) {
      if (z.owner === clanKey && (z.kind === 'mine' || z.kind === 'base')) { z.garrison = 0; z.garrisonIds = []; z.fort = 0; z.capturedAt = n; }
    }
    // No free player army: soldiers are summoned from on-chain NFT ownership.
    const owned = s.zones.filter((z) => z.owner === clanKey && z.kind === 'mine');
    const homeBase = s.zones.find((z) => z.kind === 'base' && z.owner === clanKey);
    if (homeBase) homeBase.owner = homeBase.home = clanKey;
    let aiTroops = 333 - owned.length * E.aiGarrison - 12;
    for (const c of D.CLANS) {
      if (c.key === clanKey) continue;
      s.ai[c.key] = { troops: aiTroops, chest: 0, pocket: 0, nextAction: n + 12000 + Math.random() * 8000, nextBreed: n + 22000 };
    }
    this.rebuildIndex();
    this.recalcWeights();
    this.seedMarket(5);
    this.pushFeed({ type: 'welcome', icon: clan.en[0], clan: clanKey, mine: true, text: '你以 <b>' + clan.name + '</b> 之名入伍，接管了 <b>' + owned.length + '</b> 块矿脉、<b>1</b> 座基地与 <b>' + U.fmt(E.startOre, 0) + ' ORE</b> 军饷。<b>初始军团为 0</b>，链上铸造 NFT 后自动召唤。' });
    this.pushFeed({ type: 'world', icon: '◇', text: '两族 AI 军团各 <b>333</b> 人；你的军团由 BSC Testnet 上的士兵 NFT 决定。' });
    this.save();
    this.syncMap();
    if (ORE.ui) ORE.ui.onEnlist();
    if (ORE.ui && ORE.ui.walletProvider) setTimeout(() => this.syncChainArmy(), 60);
  },

  /* ---------------- on-chain army ---------------- */
  decodeTokenIds(out) {
    if (!out || out === '0x') return [];
    const hex = out.slice(2);
    if (hex.length < 128) return [];
    const off = Number(BigInt('0x' + hex.slice(0, 64))) * 2;
    if (off + 64 > hex.length) return [];
    const len = Number(BigInt('0x' + hex.slice(off, off + 64)));
    const ids = [];
    for (let i = 0; i < len; i++) {
      const a = off + 64 + i * 64;
      if (a + 64 > hex.length) break;
      ids.push(Number(BigInt('0x' + hex.slice(a, a + 64))));
    }
    return ids;
  },
  async syncChainArmy() {
    const s = this.state;
    const ui = ORE.ui;
    if (!s || s.phase !== 'playing' || !ui || !ui.walletProvider || !ui.wallet || !ui.wallet.address) {
      return { ok: false, error: '未连接钱包' };
    }
    if (this._chainSyncPromise) return this._chainSyncPromise;
    this._chainSyncPromise = (async () => {
      try {
        const provider = ui.walletProvider;
        const chain = String(await provider.request({ method: 'eth_chainId' })).toLowerCase();
        if (chain !== '0x61') return { ok: false, error: '请切换到 BSC Testnet' };
        const account = ui.wallet.address;
        const data = TOKENS_OF_OWNER + account.toLowerCase().replace(/^0x/, '').padStart(64, '0');
        const out = await provider.request({
          method: 'eth_call',
          params: [{ to: NFT_CONTRACT, data }, 'latest'],
        });
        const ids = this.decodeTokenIds(out);
        return this.applyChainTokens(ids);
      } catch (e) {
        return { ok: false, error: e.shortMessage || e.message || '链上读取失败' };
      } finally {
        this._chainSyncPromise = null;
      }
    })();
    return this._chainSyncPromise;
  },
  migrateChainIds() {
    const s = this.state;
    if (!s) return;
    const map = new Map();
    const all = [
      ...(s.soldiers || []),
      ...((s.dead || []).map((d) => d.soldier).filter(Boolean)),
      ...((s.market && s.market.listings) || []).map((l) => l.soldier).filter(Boolean),
    ];
    for (const so of all) {
      if (so && so.nft != null && String(so.id) !== String(so.nft)) map.set(String(so.id), String(so.nft));
    }
    if (!map.size) return;
    const remap = (id) => (id == null ? id : (map.get(String(id)) || id));
    for (const so of (s.soldiers || [])) {
      so.id = remap(so.id);
      so.spouse = remap(so.spouse);
      so.parents = (so.parents || []).map(remap);
      so.ancestors = (so.ancestors || []).map(remap);
      so.children = (so.children || []).map(remap);
    }
    for (const d of (s.dead || [])) {
      if (!d.soldier) continue;
      d.soldier.id = remap(d.soldier.id);
      d.soldier.spouse = remap(d.soldier.spouse);
      d.soldier.parents = (d.soldier.parents || []).map(remap);
      d.soldier.ancestors = (d.soldier.ancestors || []).map(remap);
      d.soldier.children = (d.soldier.children || []).map(remap);
    }
    for (const z of (s.zones || [])) z.garrisonIds = (z.garrisonIds || []).map(remap);
    for (const b of (s.births || [])) { b.fatherId = remap(b.fatherId); b.motherId = remap(b.motherId); }
    for (const m of (s.marches || [])) m.ids = (m.ids || []).map(remap);
    for (const b of (s.battles || [])) b.ids = (b.ids || []).map(remap);
    for (const l of ((s.market && s.market.listings) || [])) {
      l.soldierId = remap(l.soldierId);
      if (l.soldier) l.soldier.id = remap(l.soldier.id);
    }
    this.rebuildIndex();
  },
  applyChainTokens(ids) {
    const s = this.state;
    const wanted = new Set(ids.map((n) => String(n)));
    const bound = new Set((s.onchainBound || []).map(String));
    for (const so of s.soldiers) if (so.nft != null) bound.add(String(so.nft));
    for (const d of (s.dead || [])) if (d.soldier && d.soldier.nft != null) bound.add(String(d.soldier.nft));
    s.dead = (s.dead || []).filter((d) => d.soldier && (d.soldier.nft == null || wanted.has(String(d.soldier.nft))));
    for (const b of [...bound]) if (!wanted.has(b)) bound.delete(b);
    let removed = 0, added = 0;
    for (const so of s.soldiers.slice()) {
      if (so.nft == null) continue;
      if (wanted.has(String(so.nft))) continue;
      // Do not pull a unit out of an active march/battle underneath the player.
      if (so.status === 'marching' || so.status === 'inBattle') continue;
      if (so.zone != null) {
        const z = this.zone(so.zone);
        if (z) { z.garrisonIds = z.garrisonIds.filter((id) => id !== so.id); z.garrison = z.garrisonIds.length; }
      }
      for (const other of s.soldiers) if (other.spouse === so.id) other.spouse = null;
      s.births = s.births.filter((b) => b.mother !== so.id);
      s.market.listings = s.market.listings.filter((l) => l.soldierId !== so.id && (!l.soldier || l.soldier.id !== so.id));
      s.player.ore += so.pocket || 0;
      s.soldiers = s.soldiers.filter((x) => x.id !== so.id);
      bound.delete(String(so.nft));
      removed++;
    }
    // Account for both active soldiers and soldiers waiting to revive. A token
    // that is owned but represented by neither is stale (e.g. a soldier lost
    // before revival existed), so summon it instead of leaving the army short.
    const existing = new Set([
      ...s.soldiers.filter((x) => x.nft != null).map((x) => String(x.nft)),
      ...(s.dead || []).filter((d) => d.soldier && d.soldier.nft != null).map((d) => String(d.soldier.nft)),
    ]);
    for (const id of ids) {
      if (existing.has(String(id))) continue;
      const rng = U.makeRng(s.worldSeed + Number(id) * 104729 + 19);
      const so = this.makeSoldier(rng, s.clan, { gender: rng.chance(0.5) ? 'm' : 'f', gen: 0 });
      so.id = String(id);
      so.nft = Number(id);
      so.name = '链誓·' + so.name.split('·').slice(-1)[0];
      so.status = 'idle';
      so.zone = null;
      so.pocket = 0;
      so.bornAt = now();
      s.soldiers.push(so);
      existing.add(String(id));
      bound.add(String(id));
      added++;
    }
    s.onchainBound = Array.from(bound);
    if (removed || added) {
      this.pushFeed({
        type: 'chain', icon: '◈', mine: true,
        text: '链上军团同步：新增 <b>' + added + '</b> 人，撤出 <b>' + removed + '</b> 人（以钱包当前 NFT 为准）。',
      });
      this.rebuildIndex();
      this.recalcWeights();
      this.syncMap();
      if (ORE.ui) ORE.ui.refreshAll();
      this.save();
    }
    return { ok: true, ids, added, removed, total: ids.length };
  },

  makeCommander(clanKey) {
    const rng = U.makeRng(this.state.worldSeed + 424242);
    const sur = rng.pick(D.SURNAMES);
    const given = rng.pick(rng.chance(0.5) ? D.GIVEN_M : D.GIVEN_F);
    return sur + '·' + given;
  },

  makeSoldier(rng, clanKey, opts) {
    opts = opts || {};
    let roll = rng(), tier = 0, acc = 0;
    for (let i = 0; i < D.TIER_W.length; i++) { acc += D.TIER_W[i]; if (roll <= acc) { tier = i; break; } }
    if (opts.tier != null) tier = opts.tier;
    const cls = opts.cls || rng.pick(D.CLASSES);
    const mult = 1 + tier * 0.085;
    const atk = U.clamp(Math.round((40 + rng() * 28 + (cls.atk || 0)) * mult), 18, 99);
    const def = U.clamp(Math.round((38 + rng() * 26 + (cls.def || 0)) * mult), 18, 99);
    const spd = U.clamp(Math.round((40 + rng() * 26 + (cls.spd || 0)) * mult), 18, 99);
    const gender = opts.gender || (rng.chance(0.5) ? 'm' : 'f');
    const sur = opts.surname || rng.pick(D.SURNAMES);
    const given = rng.pick(gender === 'm' ? D.GIVEN_M : D.GIVEN_F);
    const id = 's' + (this.state ? this.state.nextId++ : Math.floor(Math.random() * 1e9));
    return {
      id, name: sur + '·' + given, surname: sur, gender, clan: clanKey,
      tier, cls: cls.key, clsName: cls.name,
      atk, def, spd, gen: opts.gen || 0,
      parents: opts.parents || [], ancestors: opts.ancestors || [],
      children: [], childCount: 0, fertility: opts.fertility || (E.fertilityMin + irand(0, E.fertilityMax - E.fertilityMin)),
      spouse: null, status: 'idle', zone: null, march: null, pocket: 0,
      seed: Math.floor(rng() * 2147483646) + 1,
      bornAt: opts.bornAt || now(),
      cdUntil: 0, pregnant: false, birthId: null,
    };
  },

  rebuildIndex() {
    const s = this.state;
    if (!s) return;
    s._idx = new Map();
    for (const so of s.soldiers) s._idx.set(so.id, so);
    s._zoneIdx = new Map();
    for (const z of s.zones) s._zoneIdx.set(z.id, z);
  },
  soldier(id) { const s = this.state; return s && s._idx ? s._idx.get(id) : null; },
  zone(id) { const s = this.state; return s && s._zoneIdx ? s._zoneIdx.get(id) : null; },

  /* ---------------- persistence ---------------- */
  save() {
    const s = this.state;
    if (!s) return;
    s.lastSeen = now();
    const out = {
      version: 9, worldSeed: s.worldSeed, phase: s.phase, clan: s.clan, commander: s.commander,
      createdAt: s.createdAt, lastSeen: s.lastSeen, graceUntil: s.graceUntil,
      player: s.player, econ: s.econ, ai: s.ai, soldiers: s.soldiers, dead: s.dead || [],
      zones: s.zones.map((z) => ({ id: z.id, owner: z.owner, fort: z.fort, garrison: z.garrison, garrisonIds: z.garrisonIds, capturedAt: z.capturedAt, militia: z.militia, vault: z.vault || 0 })),
      births: s.births, marches: s.marches, battles: s.battles, market: s.market,
      feed: s.feed.slice(0, 24), stats: s.stats, params: s.params, nextId: s.nextId, hints: s.hints, onchainBound: s.onchainBound || [], lastExtractTx: s.lastExtractTx || null, lastOreTx: s.lastOreTx || null,
    };
    out.econ.priceHist = (out.econ.priceHist || []).slice(-120);
    try { U.storageSet(SAVE_KEY, out); } catch (e) { console.warn('save failed', e); }
  },

  hydrate(saved) {
    const s = saved;
    const w = this.world;
    const savedZones = saved.zones || [];
    s.zones = w.cells;
    const byId = new Map();
    for (const z of s.zones) byId.set(z.id, z);
    for (const z of savedZones) {
      const t = byId.get(z.id);
      if (!t) continue;
      t.owner = z.owner || null;
      t.fort = z.fort || 0;
      t.garrison = z.garrison || 0;
      t.garrisonIds = z.garrisonIds || [];
      t.capturedAt = z.capturedAt || 0;
      t.vault = z.vault || 0;
      if (z.militia != null) t.militia = z.militia;
    }
    s.totalWeight = w.totalWeight;
    s.phase = s.phase || 'lobby';
    s.params = Object.assign({ emission: 1, extraction: 1, breed: 1, fee: E.marketFee, terrainMode: '3d' }, s.params || {});
    s.econ = Object.assign(EC.initEcon(), s.econ || {});
    s.econ.fees = Object.assign({ lp: 0, burn: 0, treasury: 0, total: 0, lpOre: 0, burnedOre: 0 }, s.econ.fees || {});
    s.econ.flow = Object.assign(EC.initEcon().flow, s.econ.flow || {});
    s.player = Object.assign({ ore: 0, eth: 0, chest: 0, lp: 0 }, s.player || {});
    s.player.chest = 0;
    s.ai = s.ai || {};
    for (const k of Object.keys(s.ai)) { if (s.ai[k].pocket == null) s.ai[k].pocket = 0; }
    s.soldiers = (s.soldiers || []).map((so) => Object.assign({
      spouse: null, status: 'idle', zone: null, pocket: 0, children: [], childCount: 0,
      ancestors: [], parents: [], pregnant: false, cdUntil: 0,
    }, so));
    s.births = s.births || [];
    s.dead = (s.dead || []).filter((d) => d && d.soldier && d.reviveAt);
    s.marches = s.marches || [];
    s.battles = s.battles || [];
    s.market = Object.assign({ listings: [], nextAi: now() + 8000, nextBuy: now() + 10000, nextNpcSale: now() + 16000 }, s.market || {});
    s.feed = s.feed || [];
    s.hints = s.hints || {};
    delete s.ai[s.clan];
    s.stats = Object.assign({ extracted: 0, burned: 0, born: 0, captured: 0, lost: 0, sold: 0, bought: 0, volume: 0, killed: 0 }, s.stats || {});
    s.nextId = s.nextId || (s.soldiers.length + 1);
    s.onchainBound = s.onchainBound || [];
    s.lastExtractTx = s.lastExtractTx || null;
    s.lastOreTx = s.lastOreTx || null;
    for (const so of s.soldiers) if (so.nft != null && !s.onchainBound.includes(String(so.nft))) s.onchainBound.push(String(so.nft));
    for (const d of (s.dead || [])) if (d.soldier && d.soldier.nft != null && !s.onchainBound.includes(String(d.soldier.nft))) s.onchainBound.push(String(d.soldier.nft));
    s.lastTick = now();
    s.selected = null;
    s._feedVersion = 1;
    this.state = s;
    this.rebuildIndex();
    this.migrateChainIds();

    // clean dangling state
    const ids = new Set(s.soldiers.map((x) => x.id));
    for (const so of s.soldiers) {
      if (so.spouse && !ids.has(so.spouse)) so.spouse = null;
      if (so.status === 'marching') {
        const inMarch = s.marches.some((m) => (m.ids || []).includes(so.id));
        const inBattle = s.battles.some((b) => (b.ids || []).includes(so.id));
        if (!inMarch && !inBattle) { so.status = so.zone ? 'garrison' : 'idle'; so.march = null; so.battle = null; }
      }
      if (so.status === 'listed' && !(s.market.listings || []).some((l) => l.soldierId === so.id)) so.status = 'idle';
      if (so.pregnant && !s.births.some((b) => b.motherId === so.id)) { so.pregnant = false; so.status = 'idle'; }
      if (so.status === 'garrison') {
        const gz = s.zones.find((z) => z.id === so.zone);
        if (!gz || gz.owner !== s.clan) { so.status = 'idle'; so.zone = null; }
      }
    }
    for (const z of s.zones) {
      z.garrisonIds = (z.garrisonIds || []).filter((id) => ids.has(id));
    }
    // recover city rosters from soldier.zone (fixes old v7 saves whose
    // garrisonIds were lost by the pre-fix hydrate order)
    const zoneById = new Map(s.zones.map((z) => [z.id, z]));
    for (const so of s.soldiers) {
      if (so.status !== 'garrison' || so.zone == null) continue;
      const z = zoneById.get(so.zone);
      if (!z || z.owner !== s.clan) continue;
      if (!z.garrisonIds.includes(so.id)) z.garrisonIds.push(so.id);
    }
    for (const z of s.zones) {
      if (z.kind === 'base') {
        z.owner = z.home;
        z.fort = 0;
        z.garrison = z.owner === s.clan ? z.garrisonIds.length : 12;
      }
    }
    this.recalcWeights();

    const elapsed = U.clamp(now() - (s.lastSeen || now()), 0, OFFLINE_MAX);
    const before = s.soldiers.reduce((a, x) => a + (x.pocket || 0), 0);
    if (s.phase === 'playing' && elapsed > 4000) {
      EC.produce(s, elapsed, now());
      this.deliverBirths(now());
      this.resolveMarches(now());
      const gained = s.soldiers.reduce((a, x) => a + (x.pocket || 0), 0) - before;
      if (gained > 0.001) {
        this.pushFeed({ type: 'offline', icon: '☾', mine: true, text: '离线 <b>' + U.clock(elapsed) + '</b>，士兵口袋注入 <b>' + U.fmt(gained, 2) + ' ORE</b>。' });
        setTimeout(() => { if (ORE.ui) ORE.ui.toast('离线口袋 +' + U.fmt(gained, 2) + ' ORE', 'gold'); }, 600);
      }
    }
    for (const c of Object.keys(s.ai || {})) {
      s.ai[c].nextAction = now() + rand(10000, 24000);
      s.ai[c].nextBreed = now() + rand(16000, 30000);
    }
    s.market.nextAi = now() + 7000;
    s.market.nextBuy = now() + 9000;
    s.market.nextNpcSale = now() + 13000;
    if (!s.econ.priceHist || s.econ.priceHist.length < 2) {
      s.econ.priceHist = [
        { t: now() - 30000, p: EC.price(s), s: EC.supply(s), lp: s.econ.poolEth * 2, chest: s.soldiers.reduce((a, x) => a + (x.pocket || 0), 0) },
        { t: now(), p: EC.price(s), s: EC.supply(s), lp: s.econ.poolEth * 2, chest: s.soldiers.reduce((a, x) => a + (x.pocket || 0), 0) },
      ];
    }
    s.lastTick = now();
    this.syncMap();
    this.save();
  },

  exportSave() { return JSON.stringify(this.state, (k, v) => (k === '_idx' || k === '_zoneIdx' ? undefined : v)); },

  importSave(text) {
    const data = JSON.parse(text);
    if (!data || data.version !== 9) throw new Error('存档版本不匹配');
    U.storageSet(SAVE_KEY, data);
    location.reload();
  },

  reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    location.reload();
  },

  /* ---------------- tick ---------------- */
  tick() {
    // Shared world: server owns the map and economy. Never let the local
    // AI/simulation mutate a multiplayer world.
    if (window.ORE_MP_CONFIG && ORE_MP_CONFIG.enabled) return;
    const s = this.state;
    if (!s || s.phase !== 'playing') { this.syncMap(); return; }
    const wallT = now();
    const perfNow = (typeof performance !== 'undefined' && performance.now) ? performance.now() : wallT;
    const wallDt = wallT - (s.lastTick || wallT);
    const perfDt = this._lastPerf == null ? null : (perfNow - this._lastPerf);
    this._lastPerf = perfNow;
    // If the wall clock jumps forward while the page is open, do not let
    // revives, marches, births or day rolls jump with it.
    let t = wallT;
    if (perfDt != null && !document.hidden && wallDt > perfDt + 5000) {
      t = (s.lastTick || wallT) + Math.max(0, perfDt);
    }
    let dt = t - (s.lastTick || t);
    if (!(dt > 0)) dt = 0;
    s.lastTick = t;
    this.reviveDead(t);
    this.recalcWeights();
    if (dt > 60000) {
      const before = s.soldiers.reduce((a, x) => a + (x.pocket || 0), 0);
      EC.produce(s, Math.min(dt, OFFLINE_MAX), t);
      this.deliverBirths(t);
      this.resolveMarches(t);
      for (const c of Object.keys(s.ai || {})) s.ai[c].nextAction = t + rand(9000, 18000);
      s.market.nextAi = t + 8000;
      const gained = s.soldiers.reduce((a, x) => a + (x.pocket || 0), 0) - before;
      if (gained > 0.001) {
        this.pushFeed({ type: 'offline', icon: '☾', mine: true, text: '离开 <b>' + U.clock(dt) + '</b>，士兵口袋注入 <b>' + U.fmt(gained, 2) + ' ORE</b>。' });
        if (ORE.ui) ORE.ui.toast('回来啦，口袋 +' + U.fmt(gained, 2) + ' ORE', 'gold');
      }
    } else {
      EC.produce(s, dt, t);
      this.deliverBirths(t);
      this.resolveMarches(t);
      this.aiTick(t);
      this.marketTick(t);
    }
    this.expireListings(t);
    EC.sampleHistory(s, t);
    if (!this._lastMap || t - this._lastMap > 800) { this._lastMap = t; this.syncMap(); }
    if (ORE.ui) ORE.ui.tick();
  },

  /* ---------------- hex weights ---------------- */
  recalcWeights() {
    const s = this.state;
    if (!s || !s.zones || !s._zoneIdx) return;
    let total = 0;
    for (const z of s.zones) {
      z.borderBonus = 1;
      if (z.kind === 'base') {
        z.distBase = 0; z.relYield = 0; z.weight = 0.22; z.baseWeight = 0.22;
        total += z.weight;
        continue;
      }
      if (!z.owner) { z.weight = 0; z.distBase = 0; z.relYield = 0; continue; }
      const base = this.world.baseByClan[z.owner];
      if (!base) { z.weight = 0; continue; }
      const d = Math.acos(U.clamp(z.vCenter[0] * base.vCenter[0] + z.vCenter[1] * base.vCenter[1] + z.vCenter[2] * base.vCenter[2], -1, 1));
      const rel = U.clamp(d / (Math.PI / 2), 0, 1);
      z.distBase = d;
      z.relYield = rel;
      z.weight = 0.35 + 6.2 * Math.pow(rel, 1.2);
      z.baseWeight = z.weight;
      total += z.weight;
    }
    s.totalWeight = total || 1;
  },

  /* ---------------- production & counts ---------------- */
  playerRate() { return EC.playerRate(this.state); },
  zoneRate(id) { const z = this.zone(id); return z ? EC.zoneRate(this.state, z) : 0; },
  garrisonCount(z) {
    if (!z) return 0;
    return z.owner === this.state.clan ? z.garrisonIds.length : z.garrison || 0;
  },
  zoneDefense(z) {
    if (!z || z.kind !== 'mine') return 0;
    const base = 28 + z.weight * 7 + (z.fort || 0) * E.fortDef;
    if (!z.owner) return base + (z.militia || 0) * 42;
    if (z.owner === this.state.clan) {
      let d = 0;
      for (const id of z.garrisonIds) { const so = this.soldier(id); if (so) d += so.def * 1.15; }
      const bonus = this.state.clan === 'tide' ? 1.12 : 1;
      return base + d * bonus;
    }
    return base + (z.garrison || 0) * 58 * (z.owner === 'tide' ? 1.12 : 1);
  },
  totalPower() {
    const s = this.state;
    if (!s || !s.soldiers) return 0;
    return s.soldiers.reduce((a, so) => a + EC.soldierPower(so, s.clan), 0);
  },
  counts() {
    const s = this.state, out = { total: s.soldiers.length, dead: (s.dead || []).length, totalAll: s.soldiers.length + (s.dead || []).length, idle: 0, garrison: 0, marching: 0, listed: 0, pregnant: 0 };
    for (const so of s.soldiers) {
      if (so.status === 'idle') out.idle++;
      else if (so.status === 'garrison') out.garrison++;
      else if (so.status === 'marching') out.marching++;
      else if (so.status === 'listed') out.listed++;
      if (so.pregnant) out.pregnant++;
    }
    return out;
  },
  chestFull() { return false; },

  /* ---------------- zone selection & war ---------------- */
  canAttack(id) {
    const s = this.state;
    const z = this.zone(id);
    if (!z || z.kind !== 'mine' || z.owner === s.clan) return null;
    const mine = s.zones.filter((x) => x.owner === s.clan);
    if (!mine.length) return { id: z.id, name: '流亡军', c: z.c, exile: true };
    let origin = null, best = Infinity;
    for (const nb of z.nb) {
      const o = this.zone(nb);
      if (o && o.owner === s.clan) {
        const d = Math.hypot(o.c[0] - z.c[0], o.c[1] - z.c[1]);
        if (d < best) { best = d; origin = o; }
      }
    }
    return origin;
  },
  attackableIds() {
    const s = this.state;
    const out = [];
    if (!s || !s.clan) return out;
    for (const z of s.zones) {
      if (z.owner !== s.clan && this.canAttack(z.id)) out.push(z.id);
    }
    return out;
  },
  topIdle(n, mode) {
    const s = this.state;
    const arr = s.soldiers.filter((x) => x.status === 'idle').sort((a, b) =>
      EC.soldierPower(b, s.clan, mode || 'atk') - EC.soldierPower(a, s.clan, mode || 'atk'));
    return arr.slice(0, Math.max(0, Math.min(n, arr.length)));
  },
  estimateAttack(n) {
    const s = this.state;
    const id = s.selected;
    const z = id != null ? this.zone(id) : null;
    if (!z) return null;
    const avail = s.soldiers.filter((x) => x.status === 'idle').length;
    const pick = this.topIdle(Math.min(n, avail), 'atk');
    const power = pick.reduce((a, so) => a + EC.soldierPower(so, s.clan, 'atk'), 0);
    const def = this.zoneDefense(z);
    const chance = 1 / (1 + Math.exp(-2.9 * (power / Math.max(1, def) - 1)));
    const winLoss = U.clamp(0.06 + 0.17 * (def / Math.max(1, power)), 0.04, 0.45);
    const loseLoss = U.clamp(0.34 + 0.2 * (def / Math.max(1, power)), 0.2, 0.68);
    return { n: pick.length, avail, power: Math.round(power), def: Math.round(def), chance, winLoss, loseLoss, ids: pick.map((x) => x.id), origin: this.canAttack(id) };
  },
  attack(n) {
    const s = this.state;
    const id = s.selected;
    const z = id != null ? this.zone(id) : null;
    if (!z) return { ok: false, error: '未选择目标' };
    if (z.kind === 'base') return { ok: false, error: '基地不可被攻击' };
    const origin = this.canAttack(id);
    if (!origin) return { ok: false, error: '必须与己方地块相邻' };
    const pick = this.topIdle(Math.min(n, this.counts().idle), 'atk');
    if (!pick.length) return { ok: false, error: '没有待命士兵' };
    const dist = Math.acos(U.clamp(origin.vCenter[0] * z.vCenter[0] + origin.vCenter[1] * z.vCenter[1] + origin.vCenter[2] * z.vCenter[2], -1, 1));
    const travel = U.clamp(7000 + dist * 6500, 9000, 28000);
    const t = now();
    const march = {
      id: 'm' + Math.floor(Math.random() * 1e9),
      clan: s.clan, n: pick.length, ids: pick.map((x) => x.id),
      from: origin.id, to: z.id, departAt: t, arriveAt: t + travel, kind: 'attack', mine: true,
    };
    for (const so of pick) { so.status = 'marching'; so.march = march.id; so.zone = null; }
    s.marches.push(march);
    this.pushFeed({ type: 'march', icon: '➤', clan: s.clan, mine: true, zone: z.id, text: '你派出 <b>' + pick.length + '</b> 名士兵，进攻 <b>' + z.name + '</b>。' });
    this.save(); this.syncMap();
    return { ok: true, travel };
  },
  classCounts(ids, fallbackN) {
    const counts = {};
    let any = false;
    for (const id of ids || []) {
      const so = this.soldier(id);
      if (!so) continue;
      counts[so.cls] = (counts[so.cls] || 0) + 1;
      any = true;
    }
    if (!any && fallbackN > 0) return this.simulateClasses(fallbackN);
    return counts;
  },
  simulateClasses(n) {
    const out = {};
    const keys = D.CLASSES.map((c) => c.key);
    for (let i = 0; i < n; i++) {
      const k = keys[Math.floor(Math.random() * keys.length)];
      out[k] = (out[k] || 0) + 1;
    }
    return out;
  },
  resolveMarches(t) {
    const s = this.state;
    if (!s || (!s.marches.length && !s.battles.length)) return;
    let changed = false;

    // arrival -> 30 second siege
    const arriving = s.marches.filter((m) => m.arriveAt <= t);
    if (arriving.length) {
      s.marches = s.marches.filter((m) => m.arriveAt > t);
      for (const m of arriving) {
        const b = {
          id: 'b' + Math.floor(Math.random() * 1e9),
          marchId: m.id, from: m.from, to: m.to, clan: m.clan, n: m.n,
          ids: (m.ids || []).slice(), mine: m.mine,
          startAt: m.arriveAt, endAt: m.arriveAt + BATTLE_MS,
        };
        const defZ = this.zone(b.to);
        b.atkClasses = this.classCounts(b.ids, b.n);
        b.defClasses = defZ && defZ.owner === s.clan
          ? this.classCounts(defZ.garrisonIds, 0)
          : this.simulateClasses(defZ ? (defZ.garrison || 0) : 0);
        s.battles.push(b);
        for (const id of b.ids) {
          const so = this.soldier(id);
          if (so) { so.battle = b.id; so.march = null; }
        }
        const z = this.zone(b.to);
        if (b.mine) {
          this.pushFeed({ type: 'battle', icon: '⚔', clan: b.clan, mine: true, zone: b.to, text: '攻城开始：你正在攻打 <b>' + (z ? z.name : '目标') + '</b>，<b>30 秒</b>后结算。' });
        } else if (z && z.owner === s.clan) {
          this.pushFeed({ type: 'warning', icon: '!', clan: b.clan, mine: true, zone: b.to, text: '<b>' + D.CLAN[b.clan].name + '</b> 开始攻打 <b>' + z.name + '</b>，城墙与弓箭手正在迎战，<b>30 秒</b>后结算。' });
          if (ORE.ui) ORE.ui.toast(D.CLAN[b.clan].name + ' 正在攻城：' + z.name, 'bad');
        }
      }
      changed = true;
    }

    // siege end -> resolve
    const done = s.battles.filter((b) => b.endAt <= t);
    if (done.length) {
      s.battles = s.battles.filter((b) => b.endAt > t);
      for (const b of done) {
        const m = {
          id: b.marchId, clan: b.clan, n: b.n, ids: b.ids || [], from: b.from, to: b.to,
          departAt: b.startAt, arriveAt: b.endAt, kind: 'attack', mine: b.mine, battle: true,
        };
        if (b.mine) this.resolvePlayerAttack(m, t);
        else this.resolveAiAttack(m, t);
        for (const id of b.ids || []) {
          const so = this.soldier(id);
          if (so) so.battle = null;
        }
      }
      changed = true;
    }

    if (!changed) return;
    this.rebuildIndex();
    this.syncMap();
    this.save();
  },

  killSoldiers(ids, reason, opts) {
    const s = this.state;
    const set = new Set(ids);
    if (!set.size) return 0;
    let n = 0;
    const keep = [];
    const deadAt = now();
    s.dead = s.dead || [];
    for (const so of s.soldiers) {
      if (set.has(so.id)) {
        if (so.clan === s.clan && so.pocket > 0 && !(opts && opts.skipVault)) s.player.ore += so.pocket;
        if (reason === 'battle' && so.clan === s.clan) {
          const snap = JSON.parse(JSON.stringify(so));
          snap.pocket = 0;
          snap.status = 'dead';
          snap.zone = null;
          snap.march = null;
          snap.battle = null;
          snap.spouse = null;
          snap.pregnant = false;
          snap.birthId = null;
          s.dead.push({ soldier: snap, diedAt: deadAt, reviveAt: deadAt + REVIVE_MS });
          if (so.pregnant) s.births = (s.births || []).filter((b) => b.motherId !== so.id);
        }
        n++; continue;
      }
      if (so.spouse && set.has(so.spouse)) so.spouse = null;
      keep.push(so);
    }
    if (reason === 'battle' && n > 0) s.stats.killed = (s.stats.killed || 0) + n;
    s.soldiers = keep;
    for (const z of s.zones) if (z.garrisonIds && z.garrisonIds.length) z.garrisonIds = z.garrisonIds.filter((x) => !set.has(x));
    this.rebuildIndex();
    return n;
  },

  reviveDead(t) {
    const s = this.state;
    if (!s || !s.dead || !s.dead.length) return 0;
    const due = s.dead.filter((d) => d.reviveAt <= t);
    if (!due.length) return 0;
    const remain = s.dead.filter((d) => d.reviveAt > t);
    const base = s.zones.find((z) => z.kind === 'base' && z.owner === s.clan);
    let n = 0;
    for (const d of due) {
      const so = d.soldier;
      if (!so) continue;
      if (so.nft != null && !(s.onchainBound || []).includes(String(so.nft))) continue;
      so.status = base ? 'garrison' : 'idle';
      so.zone = base ? base.id : null;
      so.march = null; so.battle = null;
      so.pocket = 0;
      so.spouse = null;
      so.pregnant = false; so.birthId = null;
      s.soldiers.push(so);
      if (base) { base.garrisonIds = base.garrisonIds || []; base.garrisonIds.push(so.id); base.garrison = base.garrisonIds.length; }
      n++;
    }
    s.dead = remain;
    if (n > 0) {
      this.rebuildIndex();
      this.recalcWeights();
      this.syncMap();
      this.pushFeed({ type: 'revive', icon: '✚', mine: true, text: '<b>' + n + '</b> 名阵亡士兵在基地复活，已编入基地驻军。' });
      if (ORE.ui) ORE.ui.toast(n + ' 名士兵已在基地复活', 'good');
      this.save();
    }
    return n;
  },

  resolvePlayerAttack(m, t) {
    const s = this.state;
    const z = this.zone(m.to);
    const origin = this.zone(m.from);
    const troops = (m.ids || []).map((id) => this.soldier(id)).filter(Boolean);
    if (!troops.length || !z) return;
    if (z.owner === s.clan) {
      for (const so of troops) { so.status = 'idle'; so.march = null; }
      this.pushFeed({ type: 'march', icon: '↩', mine: true, text: '目标已被己方占领，部队返回待命。', zone: z.id });
      return;
    }
    const power = troops.reduce((a, so) => a + EC.soldierPower(so, s.clan, 'atk'), 0) * rand(0.93, 1.07);
    const def = this.zoneDefense(z);
    const chance = 1 / (1 + Math.exp(-2.9 * (power / Math.max(1, def) - 1)));
    const win = Math.random() < chance;
    if (ORE.world && ORE.world.map) ORE.world.map.battle(z.id, win ? D.CLAN[s.clan].color : D.CLAN[z.owner || 'ember'].color);
    if (win) {
      const lossN = Math.round(troops.length * U.clamp(0.05 + 0.17 * (def / Math.max(1, power)), 0.04, 0.4));
      const shuffled = troops.slice().sort(() => Math.random() - 0.5);
      const dead = shuffled.slice(0, lossN).map((x) => x.id);
      const survivors = troops.filter((x) => !dead.includes(x.id));
      const oldOwner = z.owner;
      const vault = Math.max(0, z.vault || 0);
      z.vault = 0;
      let sharePow = 0;
      for (const so of survivors) sharePow += EC.soldierPower(so, s.clan);
      if (vault > 0) {
        if (sharePow > 0) {
          for (const so of survivors) so.pocket = (so.pocket || 0) + vault * EC.soldierPower(so, s.clan) / sharePow;
        } else {
          s.player.ore += vault;
        }
        s.econ.flow.looted = (s.econ.flow.looted || 0) + vault;
      }
      this.killSoldiers(dead, 'battle');
      z.owner = s.clan;
      z.garrison = 0;
      z.militia = 0;
      z.fort = Math.max(0, (z.fort || 0) - 1);
      z.capturedAt = t;
      z.garrisonIds = survivors.map((x) => x.id);
      if (window.ORE_MP_CLIENT) {
        try { window.ORE_MP_CLIENT.onLocalCapture(z.id, s.clan); } catch (e) {}
      }
      for (const so of survivors) { so.status = 'garrison'; so.zone = z.id; so.march = null; }
      s.stats.captured++;
      this.pushFeed({ type: 'capture', icon: '⚔', clan: s.clan, mine: true, zone: z.id, text: '攻占 <b>' + z.name + '</b>' + (vault > 1 ? '，夺取地块金库 <b>' + U.fmt(vault, 0) + ' ORE</b> 并按战力分给存活士兵' : '') + (dead.length ? '；阵亡 <b>' + dead.length + '</b> 人，10 分钟后在基地复活' : '') + '。' });
      if (ORE.world && ORE.world.map) ORE.world.map.battleResult(z.id, { attacker: s.clan, attackerDead: dead.length, loot: vault });
      if (vault > 1 && ORE.ui) ORE.ui.toast('夺取地块金库 +' + U.fmt(vault, 0) + ' ORE', 'gold');
    } else {
      const lossN = Math.round(troops.length * U.clamp(0.36 + 0.18 * (def / Math.max(1, power)), 0.22, 0.7));
      const shuffled = troops.slice().sort(() => Math.random() - 0.5);
      const dead = shuffled.slice(0, lossN).map((x) => x.id);
      const survivors = troops.filter((x) => !dead.includes(x.id));
      this.killSoldiers(dead, 'battle');
      for (const so of survivors) { so.status = 'idle'; so.march = null; so.zone = null; }
      if (z.owner) z.garrison = Math.max(0, (z.garrison || 0) - Math.round((z.garrison || 0) * 0.25));
      else z.militia = Math.max(0, (z.militia || 0) - Math.round((z.militia || 0) * 0.25));
      this.pushFeed({ type: 'defeat', icon: '✕', clan: s.clan, mine: true, zone: z.id, text: '<b>' + z.name + '</b> 突袭失败，损失 <b>' + dead.length + '</b> 名士兵，10 分钟后在基地复活。' });
      if (ORE.world && ORE.world.map) ORE.world.map.battleResult(z.id, { attacker: s.clan, attackerDead: dead.length, loot: 0 });
      if (ORE.ui) ORE.ui.toast('突袭失败，损失 ' + dead.length + ' 人', 'bad');
    }
    this.recalcWeights();
    this.rebuildIndex();
  },

  resolveAiAttack(m, t) {
    const s = this.state;
    const z = this.zone(m.to);
    if (!z) return;
    const ai = s.ai[m.clan];
    if (!ai) return;
    if (z.owner === m.clan) { ai.troops += m.n; return; }
    const def = this.zoneDefense(z);
    const power = m.n * 69 * (m.clan === 'ember' ? 1.1 : 1) * rand(0.92, 1.08);
    const chance = 1 / (1 + Math.exp(-2.55 * (power / Math.max(1, def) - 1)));
    const win = Math.random() < chance;
    const clan = D.CLAN[m.clan];
    if (ORE.world && ORE.world.map) ORE.world.map.battle(z.id, clan.color);
    const wasPlayer = z.owner === s.clan;
    if (win) {
      const survivors = Math.max(2, Math.round(m.n * rand(0.45, 0.7)));
      if (wasPlayer) {
        const killN = Math.round(z.garrisonIds.length * rand(0.55, 0.78));
        const killed = z.garrisonIds.slice().sort(() => Math.random() - 0.5).slice(0, killN);
        this.killSoldiers(killed, 'battle');
        const retreat = z.garrisonIds.filter((x) => !killed.includes(x));
        for (const sid of retreat) { const so = this.soldier(sid); if (so) { so.status = 'idle'; so.zone = null; } }
        z.garrisonIds = [];
        const vault = Math.max(0, z.vault || 0); z.vault = 0; if (vault > 0) ai.pocket = (ai.pocket || 0) + vault;
        z.owner = m.clan;
        z.garrison = survivors;
        z.fort = Math.max(0, (z.fort || 0) - 1);
        z.capturedAt = t;
        s.stats.lost++;
        this.pushFeed({ type: 'lost', icon: '☠', clan: m.clan, zone: z.id, text: '<b>' + clan.name + '</b> 攻占你的 <b>' + z.name + '</b>' + (vault > 1 ? '，夺走地块金库 <b>' + U.fmt(vault, 0) + ' ORE</b>' : '') + (killed.length ? '；<b>阵亡 ' + killed.length + ' 名驻军</b>，10 分钟后在基地复活' : '') + (retreat.length ? '，' + retreat.length + ' 人撤回待命' : '') + '。' });
        if (ORE.world && ORE.world.map) ORE.world.map.battleResult(z.id, { attacker: m.clan, attackerDead: Math.max(1, m.n - survivors), defender: s.clan, defenderDead: killed.length, loot: vault });
        if (ORE.ui) ORE.ui.toast(clan.name + ' 攻占 ' + z.name + (killed.length ? '，阵亡 ' + killed.length : ''), 'bad');
      } else {
        if (z.owner) z.garrison = Math.max(0, Math.round((z.garrison || 0) * 0.55));
        else z.militia = 0;
        const vault2 = Math.max(0, z.vault || 0); z.vault = 0; if (vault2 > 0) ai.pocket = (ai.pocket || 0) + vault2;
        z.owner = m.clan;
        z.garrison = survivors;
        z.garrisonIds = [];
        z.fort = Math.max(0, (z.fort || 0) - 1);
        z.capturedAt = t;
        this.pushFeed({ type: 'aiCapture', icon: '⚑', clan: m.clan, zone: z.id, text: '<b>' + clan.name + '</b> 占领 <b>' + z.name + '</b>。' });
        if (ORE.world && ORE.world.map) ORE.world.map.battleResult(z.id, { attacker: m.clan, attackerDead: Math.max(0, m.n - survivors), loot: vault2 });
      }
    } else {
      const back = Math.max(1, Math.round(m.n * rand(0.45, 0.72)));
      ai.troops += back;
      if (wasPlayer) {
        const killN = Math.round(z.garrisonIds.length * rand(0.08, 0.2));
        const killed = z.garrisonIds.slice().sort(() => Math.random() - 0.5).slice(0, killN);
        this.killSoldiers(killed, 'battle');
        this.pushFeed({ type: 'defend', icon: '⛨', clan: s.clan, mine: true, zone: z.id, text: '你守住了 <b>' + z.name + '</b>，损失 <b>' + killed.length + '</b> 名驻军，10 分钟后在基地复活。' });
        if (ORE.world && ORE.world.map) ORE.world.map.battleResult(z.id, { attacker: m.clan, attackerDead: Math.max(0, m.n - back), defender: s.clan, defenderDead: killed.length, loot: 0 });
        if (ORE.ui) ORE.ui.toast('守住了 ' + z.name, 'good');
      } else {
        if (z.owner) z.garrison = Math.max(0, (z.garrison || 0) - Math.round((z.garrison || 0) * rand(0.1, 0.2)));
        else z.militia = Math.max(0, (z.militia || 0) - Math.round((z.militia || 0) * rand(0.1, 0.2)));
        if (ORE.world && ORE.world.map) ORE.world.map.battleResult(z.id, { attacker: m.clan, attackerDead: Math.max(1, m.n - back), loot: 0 });
      }
    }
    this.recalcWeights();
    this.rebuildIndex();
  },

  aiTick(t) {
    const s = this.state;
    for (const key of Object.keys(s.ai || {})) {
      const ai = s.ai[key];
      if (!ai) continue;
      if (t >= (ai.nextBreed || 0)) {
        ai.nextBreed = t + rand(24000, 42000);
        if (ai.troops < 345 && (ai.pocket || 0) >= 150) {
          ai.pocket -= 120;
          s.econ.burned += 84;
          s.econ.treasuryOre += 36;
          s.econ.flow.burnedOre += 84;
          ai.troops += 1;
        }
      }
      if (t < (ai.nextAction || 0)) continue;
      ai.nextAction = t + rand(13000, 27000);
      if (ai.troops < 10) continue;
      const border = [];
      for (const z of s.zones) {
        if (z.owner !== key) continue;
        for (const nb of z.nb) {
          const nz = this.zone(nb);
          if (!nz || nz.owner === key || nz.kind !== 'mine') continue;
          if (t < s.graceUntil && nz.owner === s.clan) continue;
          border.push({ from: z.id, to: nz.id, z: nz });
        }
      }
      if (!border.length) continue;
      const weights = border.map((b) => {
        const zz = b.z;
        let w = 0.7 + zz.weight * 0.5;
        if (!zz.owner) w *= 1.45;
        else if (zz.owner === s.clan) w *= 0.75;
        return w;
      });
      const total = weights.reduce((a, b) => a + b, 0);
      let roll = Math.random() * total, pick = border[0];
      for (let i = 0; i < border.length; i++) { roll -= weights[i]; if (roll <= 0) { pick = border[i]; break; } }
      const n = U.clamp(8 + Math.round(Math.random() * 13) + Math.round(pick.z.weight * 1.2), 8, Math.min(ai.troops, 38));
      const fromZ = this.zone(pick.from) || {};
      const dist = fromZ.vCenter ? Math.acos(U.clamp(fromZ.vCenter[0] * pick.z.vCenter[0] + fromZ.vCenter[1] * pick.z.vCenter[1] + fromZ.vCenter[2] * pick.z.vCenter[2], -1, 1)) : Math.PI / 2;
      const travel = U.clamp(9000 + dist * 6500, 9000, 28000);
      ai.troops -= n;
      const march = { id: 'm' + Math.floor(Math.random() * 1e9), clan: key, n, ids: [], from: pick.from, to: pick.to, departAt: t, arriveAt: t + travel, kind: 'attack', mine: false };
      s.marches.push(march);
      if (pick.z.owner === s.clan) {
        this.pushFeed({ type: 'warning', icon: '!', clan: key, zone: pick.to, text: '<b>' + D.CLAN[key].name + '</b> 的 <b>' + n + '</b> 名士兵正在进攻 <b>' + pick.z.name + '</b>，约 ' + Math.ceil(travel / 1000) + ' 秒后抵达。' });
        if (ORE.ui) ORE.ui.toast(D.CLAN[key].name + ' 来袭：' + pick.z.name, 'bad');
      }
    }
  },

  stationSoldier(id, zoneId) {
    const s = this.state;
    const so = this.soldier(id);
    const z = this.zone(zoneId);
    if (!so || so.status !== 'idle') return { ok: false, error: '该士兵不在待命' };
    if (!z || z.owner !== s.clan) return { ok: false, error: '这里不能驻军' };
    if (z.garrisonIds.length >= 80) return { ok: false, error: '该地块驻军已满' };
    so.status = 'garrison'; so.zone = z.id;
    z.garrisonIds.push(so.id);
    this.save(); this.syncMap();
    return { ok: true, soldier: so };
  },
  unstationSoldier(id) {
    const s = this.state;
    const so = this.soldier(id);
    if (!so || so.status !== 'garrison' || so.zone == null) return { ok: false, error: '该士兵不在驻防' };
    const z = this.zone(so.zone);
    if (z) z.garrisonIds = z.garrisonIds.filter((x) => x !== so.id);
    so.status = 'idle'; so.zone = null;
    this.save(); this.syncMap();
    return { ok: true, soldier: so };
  },

  station(zoneId, n) {
    const s = this.state;
    const z = this.zone(zoneId);
    if (!z || z.owner !== s.clan) return { ok: false, error: '这里不能驻军' };
    const cap = 80 - z.garrisonIds.length;
    const pick = this.topIdle(Math.min(n, cap), 'def');
    if (!pick.length) return { ok: false, error: '没有待命士兵' };
    for (const so of pick) { so.status = 'garrison'; so.zone = z.id; z.garrisonIds.push(so.id); }
    this.save(); this.syncMap();
    return { ok: true, n: pick.length };
  },
  withdraw(zoneId) {
    const s = this.state;
    const z = this.zone(zoneId);
    if (!z || z.owner !== s.clan) return { ok: false, error: '不是己方地块' };
    const n = z.garrisonIds.length;
    for (const id of z.garrisonIds) { const so = this.soldier(id); if (so) { so.status = 'idle'; so.zone = null; } }
    z.garrisonIds = [];
    this.save(); this.syncMap();
    return { ok: true, n };
  },
  fortify(zoneId) {
    const s = this.state;
    const z = this.zone(zoneId);
    if (!z || z.owner !== s.clan) return { ok: false, error: '不是己方地块' };
    if (z.kind === 'base') return { ok: false, error: '基地无需筑防' };
    if (z.kind !== 'mine') return { ok: false, error: '这里不能筑防' };
    if (z.fort >= E.fortMax) return { ok: false, error: '已达最高筑防等级' };
    const cost = E.fortCosts[z.fort + 1];
    if (!EC.spendOre(s, cost, 'fort')) return { ok: false, error: '钱包 ORE 不足（需 ' + cost + '）' };
    z.fort++;
    this.pushFeed({ type: 'fort', icon: '▤', clan: s.clan, mine: true, zone: z.id, text: '你加固了 <b>' + z.name + '</b>，筑防 +1，焚毁 <b>' + cost + ' ORE</b>。' });
    this.save(); this.syncMap();
    return { ok: true, cost };
  },

  /* ---------------- extraction ---------------- */
  extractionCandidates() {
    const s = this.state;
    return s.soldiers.filter((so) => !so.pregnant && so.status !== 'marching' && so.status !== 'listed' && so.status !== 'dead')
      .map((so) => ({ so, cap: so.pocket || 0 }));
  },
  recommendExtraction(includeGarrison) {
    const s = this.state;
    const cand = this.extractionCandidates().filter((x) => (includeGarrison || x.so.status === 'idle') && x.cap > 0.0001);
    cand.sort((a, b) => b.cap - a.cap);
    const need = cand.reduce((a, x) => a + x.cap, 0);
    const out = cand.map((x) => x.so.id);
    return { ids: out, total: need, wasted: 0, count: out.length, available: this.counts() };
  },
  // 系列级授权：只对「士兵 NFT 合约」这一个地址授权，其他 NFT 系列完全不受影响。
  // setApprovalForAll 的授权表在每个 ERC-721 合约内部，作用域只有这一个 collection。
  async ensureBurnApproval(provider, account) {
    const pad = (a) => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
    const out = await provider.request({ method: 'eth_call', params: [{ to: NFT_CONTRACT, data: IS_APPROVED_ALL + pad(account) + pad(ORE_BURNER) }, 'latest'] });
    if (out && out !== '0x' && BigInt(out) !== 0n) return { hash: null, already: true };
    const data = SET_APPROVAL_ALL + pad(ORE_BURNER) + '1'.padStart(64, '0');
    const tx = { from: account, to: NFT_CONTRACT, data, value: '0x0' };
    let gas = null;
    try {
      const est = await provider.request({ method: 'eth_estimateGas', params: [tx] });
      if (est) gas = '0x' + (BigInt(est) * 12n / 10n).toString(16);
    } catch (e) { /* 交给钱包估算 */ }
    const outTx = Object.assign({}, tx); if (gas) outTx.gas = gas;
    const hash = await provider.request({ method: 'eth_sendTransaction', params: [outTx] });
    for (let i = 0; i < 45; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const rec = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] });
      if (!rec) continue;
      const ok = rec.status === '0x1' || rec.status === 1 || rec.status === '0x01';
      if (ok) return { hash, already: false };
      if (rec.status === '0x0' || rec.status === 0 || rec.status === '0x00') throw new Error('NFT 授权交易 revert');
    }
    throw new Error('NFT 授权交易确认超时');
  },

  // 撤销对 OreBurner 的系列授权（把授权范围收回）
  async revokeBurnApproval() {
    const ui = ORE.ui;
    const provider = ui && ui.walletProvider;
    const account = ui && ui.wallet && ui.wallet.address;
    if (!provider || !account) return { ok: false, error: '需要先连接钱包' };
    try {
      const pad = (a) => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
      const data = SET_APPROVAL_ALL + pad(ORE_BURNER) + '0'.padStart(64, '0');
      const tx = { from: account, to: NFT_CONTRACT, data, value: '0x0' };
      const hash = await provider.request({ method: 'eth_sendTransaction', params: [tx] });
      for (let i = 0; i < 45; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const rec = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] });
        if (!rec) continue;
        const ok = rec.status === '0x1' || rec.status === 1 || rec.status === '0x01';
        return ok ? { ok: true, hash } : { ok: false, error: '撤销交易 revert', hash };
      }
      return { ok: false, error: '撤销交易确认超时', hash };
    } catch (e) {
      return { ok: false, error: e.shortMessage || e.message || '撤销失败' };
    }
  },

  // 查询是否已授权给 burner（用于界面提示）
  async burnApprovalState() {
    const ui = ORE.ui;
    const provider = ui && ui.walletProvider;
    const account = ui && ui.wallet && ui.wallet.address;
    if (!provider || !account) return null;
    try {
      const pad = (a) => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
      const out = await provider.request({ method: 'eth_call', params: [{ to: NFT_CONTRACT, data: IS_APPROVED_ALL + pad(account) + pad(ORE_BURNER) }, 'latest'] });
      return out && out !== '0x' ? BigInt(out) !== 0n : false;
    } catch (e) { return null; }
  },

  async burnBatchOnChain(chainTroops) {
    const ui = ORE.ui;
    const provider = ui && ui.walletProvider;
    const account = ui && ui.wallet && ui.wallet.address;
    if (!provider || !account) return { ok: false, error: '批量烧毁链上 NFT 需要先连接钱包' };
    if (!chainTroops.length) return { ok: true, hash: null, approved: null };
    if (chainTroops.length > 500) return { ok: false, error: '单笔最多批量销毁 500 个 NFT' };
    try {
      const chain = String(await provider.request({ method: 'eth_chainId' })).toLowerCase();
      if (chain !== '0x61') return { ok: false, error: '请先切换到 BSC Testnet' };
      // Verify every token is still owned before sending the batch.
      for (const so of chainTroops) {
        const tokenHex = BigInt(so.nft).toString(16).padStart(64, '0');
        const own = await provider.request({ method: 'eth_call', params: [{ to: NFT_CONTRACT, data: NFT_OWNER + tokenHex }, 'latest'] });
        const owner = own && own.length >= 42 ? '0x' + own.slice(-40) : '';
        if (!owner || owner.toLowerCase() !== account.toLowerCase()) return { ok: false, error: 'NFT #' + so.nft + ' 已不在当前钱包' };
      }
      const ap = await this.ensureBurnApproval(provider, account);
      const approveHashes = ap && ap.hash ? [ap.hash] : [];
      const ids = chainTroops.map((so) => BigInt(so.nft));
      let data = BURN_BATCH + '20'.padStart(64, '0') + ids.length.toString(16).padStart(64, '0');
      for (const id of ids) data += id.toString(16).padStart(64, '0');
      const tx = { from: account, to: ORE_BURNER, data, value: '0x0' };
      let gas = null;
      try {
        const est = await provider.request({ method: 'eth_estimateGas', params: [tx] });
        if (est) gas = '0x' + (BigInt(est) * 12n / 10n).toString(16);
      } catch (e) { return { ok: false, error: e.shortMessage || e.message || '批量烧毁交易预检失败' }; }
      if (gas) tx.gas = gas;
      const hash = await provider.request({ method: 'eth_sendTransaction', params: [tx] });
      for (let i = 0; i < 50; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const rec = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] });
        if (!rec) continue;
        const ok = rec.status === '0x1' || rec.status === 1 || rec.status === '0x01';
        if (ok) return { ok: true, hash, approveHashes };
        if (rec.status === '0x0' || rec.status === 0 || rec.status === '0x00') return { ok: false, error: '批量烧毁交易 revert', hash };
      }
      return { ok: false, error: '批量烧毁交易确认超时', hash };
    } catch (e) {
      return { ok: false, error: e.shortMessage || e.message || '批量烧毁失败' };
    }
  },

  // 烧兵后向签名服务请求「矿池直接打币到钱包」（NFT 已在链上销毁）
  async burnPayout(amount, burnTx) {
    const ui = ORE.ui;
    const account = ui && ui.wallet && ui.wallet.address;
    if (!ui || !account) return { ok: false, error: '钱包未连接' };
    try {
      const url = ui.oreBurnPayoutApi ? ui.oreBurnPayoutApi() : null;
      if (!url) return { ok: false, error: '签名服务地址缺失' };
      const body = JSON.stringify({ player: account, amount: String(Math.round(amount * 1e6)) + '0'.repeat(12), burnTx: burnTx || null });
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) return { ok: false, error: j.error || ('HTTP ' + r.status) };
      if (ui.walletRefresh) ui.walletRefresh(true);
      if (ui.chainRead) setTimeout(() => ui.chainRead(true), 2500);
      return { ok: true, txHash: j.txHash, amount: Number(BigInt(j.amount)) / 1e18, verified: !!j.burnVerified };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : '请求签名服务失败' };
    }
  },

  async extract(ids) {
    const s = this.state;
    const set = new Set(ids);
    const troops = s.soldiers.filter((so) => set.has(so.id) && !so.pregnant && so.status !== 'marching' && so.status !== 'listed');
    if (!troops.length) return { ok: false, error: '选择要退伍的士兵' };
    const amount = troops.reduce((a, so) => a + (so.pocket || 0), 0);
    if (amount <= 0.0001) return { ok: false, error: '这些士兵口袋里没有代币' };
    const chainTroops = troops.filter((so) => so.nft != null);
    if (chainTroops.length) {
      const br = await this.burnBatchOnChain(chainTroops);
      if (!br.ok) return { ok: false, error: br.error };
      for (const so of chainTroops) s.onchainBound = (s.onchainBound || []).filter((x) => String(x) !== String(so.nft));
      const all = troops.map((so) => so.id);
      // 链上销毁成功后，直接向矿池请求把 ORE 打到钱包地址
      const pay = await this.burnPayout(amount, br.hash);
      s.stats.extracted += amount;
      s.econ.flow.extracted += amount;
      s.econ.flow.soldiersBurned += all.length;
      this.killSoldiers(all, 'extract', { skipVault: pay.ok });
      s.lastExtractTx = { hash: br.hash, payoutTx: pay.ok ? pay.txHash : null, paidOnchain: pay.ok, payError: pay.ok ? null : pay.error, amount, at: now(), count: chainTroops.length };
      this.pushFeed({
        type: 'extract', icon: '⊕', clan: s.clan, mine: true,
        text: '你手动烧毁 <b>' + all.length + '</b> 名士兵，口袋代币 <b>' + U.fmt(amount, amount < 100 ? 2 : 0) + '</b> 已转入个人钱包。'
          + (br.hash ? ' 链上 <b>' + chainTroops.length + '</b> 个 NFT 已用 <b>一笔交易</b> 批量销毁：<a href="https://testnet.bscscan.com/tx/' + br.hash + '" target="_blank" rel="noreferrer">查看销毁 Tx</a>' : '')
          + (pay.ok
            ? ' · 矿池已直接把 <b>' + U.fmt(pay.amount, 2) + '</b> ORE 打入你的钱包：<a href="https://testnet.bscscan.com/tx/' + pay.txHash + '" target="_blank" rel="noreferrer">查看打币 Tx</a>'
            : ' · 矿池直付失败（' + (pay.error || '未知原因') + '），已回退到游戏内金库，可在链上资产面板手动提取'),
      });
      this.save(); this.syncMap();
      if (ORE.ui) ORE.ui.refreshAll();
      return { ok: true, amount, burned: all.length, wasted: 0, txs: [br.hash, pay.ok ? pay.txHash : null].filter(Boolean), nftBurned: chainTroops.length, approveHashes: br.approveHashes || [], payoutTx: pay.ok ? pay.txHash : null, paidOnchain: !!pay.ok };
    }
    // No on-chain NFTs: purely local soldiers can still be retired normally.
    const all = troops.map((so) => so.id);
    s.stats.extracted += amount;
    s.econ.flow.extracted += amount;
    s.econ.flow.soldiersBurned += all.length;
    this.killSoldiers(all, 'extract');
    this.pushFeed({ type: 'extract', icon: '⊕', clan: s.clan, mine: true, text: '你手动烧毁 <b>' + all.length + '</b> 名士兵，口袋代币 <b>' + U.fmt(amount, amount < 100 ? 2 : 0) + '</b> 已转入个人钱包。' });
    this.save(); this.syncMap();
    if (ORE.ui) ORE.ui.refreshAll();
    return { ok: true, amount, burned: all.length, wasted: 0, txs: [], nftBurned: 0 };
  },

  /* ---------------- bloodline ---------------- */
  related(a, b) {
    if (!a || !b) return true;
    if (a.id === b.id) return true;
    const sa = new Set([a.id, ...(a.parents || []), ...(a.ancestors || [])]);
    const sb = new Set([b.id, ...(b.parents || []), ...(b.ancestors || [])]);
    if (sa.has(b.id) || sb.has(a.id)) return true;
    for (const p of a.parents || []) if (sb.has(p)) return true;
    for (const p of b.parents || []) if (sa.has(p)) return true;
    for (const p of a.ancestors || []) if (sb.has(p)) return true;
    for (const p of b.ancestors || []) if (sa.has(p)) return true;
    return false;
  },
  canMarry(a, b) {
    if (!a || !b) return { ok: false, error: '请选择两名士兵' };
    if (a.gender === b.gender) return { ok: false, error: '需要一男一女' };
    if (a.spouse || b.spouse) return { ok: false, error: '其中一人已有伴侣' };
    if (a.status !== 'idle' || b.status !== 'idle') return { ok: false, error: '双方都必须待命' };
    if (a.pregnant || b.pregnant) return { ok: false, error: '孕育中的士兵不能结缘' };
    if (this.related(a, b)) return { ok: false, error: '血缘过近，不能结缘' };
    if (a.childCount >= a.fertility && b.childCount >= b.fertility) return { ok: false, error: '双方生育次数已满' };
    return { ok: true };
  },
  marry(aid, bid) {
    const s = this.state;
    const a = this.soldier(aid), b = this.soldier(bid);
    const chk = this.canMarry(a, b);
    if (!chk.ok) return chk;
    if (s.player.ore < E.marryCost) return { ok: false, error: '钱包 ORE 不足（需 ' + E.marryCost + '）' };
    EC.spendOre(s, E.marryCost, 'marry');
    a.spouse = b.id; b.spouse = a.id;
    a.status = b.status = 'idle';
    this.pushFeed({ type: 'marry', icon: '∞', clan: s.clan, mine: true, text: '<b>' + a.name + '</b> 与 <b>' + b.name + '</b> 结为伴侣。' });
    this.save();
    return { ok: true, cost: E.marryCost };
  },
  breedCost(a, b) {
    if (!a || !b) return 0;
    const clan = this.state.clan;
    return Math.round(EC.soldierPower(a, clan) + EC.soldierPower(b, clan));
  },
  canBreed(a, b) {
    if (!a || !b) return { ok: false, error: '请选择一对伴侣' };
    if (a.spouse !== b.id || b.spouse !== a.id) return { ok: false, error: '必须先结为伴侣' };
    if (a.status !== 'idle' || b.status !== 'idle') return { ok: false, error: '双方都必须待命' };
    if (a.pregnant || b.pregnant) return { ok: false, error: '正在孕育中' };
    const cd = Math.max(0, (a.cdUntil || 0) - now(), (b.cdUntil || 0) - now());
    if (cd > 0) return { ok: false, error: '繁衍冷却中，还需 ' + U.clock(cd) };
    if (a.childCount >= a.fertility || b.childCount >= b.fertility) return { ok: false, error: '生育次数已满' };
    if (this.state.player.ore < this.breedCost(a, b)) return { ok: false, error: '个人钱包 ORE 不足' };
    return { ok: true };
  },
  breed(aid, bid) {
    const s = this.state;
    const a = this.soldier(aid), b = this.soldier(bid);
    const chk = this.canBreed(a, b);
    if (!chk.ok) return chk;
    if (s.soldiers.length + (s.dead || []).length + s.births.length >= (s.onchainBound || []).length) {
      return { ok: false, error: '链上军团名额已满：先铸造/同步更多 NFT，或腾出一个士兵名额' };
    }
    const mother = a.gender === 'f' ? a : b;
    const father = a.gender === 'f' ? b : a;
    const cost = this.breedCost(a, b);
    if (!EC.spendOre(s, cost, 'breed')) return { ok: false, error: '个人钱包 ORE 不足' };
    const t = now();
    const child = this.makeChildSpec(father, mother);
    const due = t + E.gestation;
    // 父母各自锁定 24 小时；从本次繁衍开始计时，而不是生产后。
    father.cdUntil = t + E.breedCooldown;
    mother.cdUntil = t + E.breedCooldown;
    const birth = { id: 'b' + Math.floor(Math.random() * 1e9), fatherId: father.id, motherId: mother.id, fatherName: father.name, motherName: mother.name, dueAt: due, breedAt: t, clan: s.clan, child };
    s.births.push(birth);
    mother.pregnant = true;
    mother.birthId = birth.id;
    mother.status = 'pregnant';
    father.childCount++;
    mother.childCount++;
    this.pushFeed({ type: 'breed', icon: '❍', clan: s.clan, mine: true, text: '<b>' + father.name + '</b> 与 <b>' + mother.name + '</b> 正在孕育新兵，' + Math.round(E.gestation / 1000) + ' 秒后诞生。' });
    this.save();
    return { ok: true, cost, due };
  },
  makeChildSpec(father, mother) {
    const rng = U.makeRng(Math.floor(Math.random() * 2147483646));
    let tier = Math.max(father.tier, mother.tier);
    const roll = rng();
    if (roll < 0.16) tier = Math.min(4, tier + 1);
    else if (roll < 0.52) tier = Math.max(0, tier - 1);
    else if (roll < 0.7) tier = Math.max(0, tier - 2);
    const cls = rng.chance(0.6) ? (rng.chance(0.5) ? father.cls : mother.cls) : rng.pick(D.CLASSES).key;
    const gender = rng.chance(0.5) ? 'm' : 'f';
    const given = rng.pick(gender === 'm' ? D.GIVEN_M : D.GIVEN_F);
    const ancestors = Array.from(new Set([...(father.parents || []), ...(mother.parents || []), ...(father.ancestors || []), ...(mother.ancestors || []), father.id, mother.id])).slice(0, 12);
    // 新兵三维 = 父母对应属性相加 × 随机 1.0～1.2；三条属性独立浮动，不设 99 上限。
    const inherit = (x, y) => Math.round((x + y) * U.clamp(1 + rng.range(0, 0.2), 1.0, 1.2));
    return {
      name: father.surname + '·' + given, surname: father.surname, gender, tier, cls,
      atk: inherit(father.atk, mother.atk),
      def: inherit(father.def, mother.def),
      spd: inherit(father.spd, mother.spd),
      pocket: 0,
      parents: [father.id, mother.id], ancestors,
      gen: Math.max(father.gen, mother.gen) + 1,
      fertility: E.fertilityMin + rng.int(0, E.fertilityMax - E.fertilityMin),
      seed: Math.floor(rng() * 2147483646) + 1,
    };
  },

  deliverBirths(t) {
    const s = this.state;
    if (!s.births.length) return;
    const due = s.births.filter((b) => b.dueAt <= t);
    if (!due.length) return;
    s.births = s.births.filter((b) => b.dueAt > t);
    for (const b of due) {
      const spec = b.child;
      const child = {
        id: 's' + (s.nextId++), name: spec.name, surname: spec.surname, gender: spec.gender, clan: s.clan,
        tier: spec.tier, cls: spec.cls, clsName: (D.CLASS[spec.cls] || D.CLASSES[0]).name,
        atk: spec.atk, def: spec.def, spd: spec.spd, gen: spec.gen, pocket: 0,
        parents: spec.parents, ancestors: spec.ancestors, children: [], childCount: 0,
        fertility: spec.fertility, spouse: null, status: 'idle', zone: null, march: null,
        seed: spec.seed, bornAt: t, cdUntil: 0, pregnant: false, birthId: null,
      };
      s.soldiers.push(child);
      const father = this.soldier(b.fatherId), mother = this.soldier(b.motherId);
      if (father) father.children.push(child.id);
      if (mother) {
        mother.children.push(child.id);
        mother.pregnant = false;
        mother.birthId = null;
        mother.status = 'idle';
        const cdAt = (b.breedAt || t) + E.breedCooldown;
        if ((mother.cdUntil || 0) < cdAt) mother.cdUntil = cdAt;
      }
      if (father) {
        const cdAt = (b.breedAt || t) + E.breedCooldown;
        if ((father.cdUntil || 0) < cdAt) father.cdUntil = cdAt;
      }
      s.stats.born++;
      s.econ.flow.soldiersBorn++;
      if (ORE.world && ORE.world.map) ORE.world.map.birthPulse(s.clan);
      const tierName = D.TIERS[spec.tier].name;
      this.pushFeed({ type: 'birth', icon: '✦', clan: s.clan, mine: true, text: '<b>' + b.fatherName + '</b> 与 <b>' + b.motherName + '</b> 诞下 <b>' + tierName + ' ' + child.name + '</b>。' });
      if (ORE.ui) ORE.ui.toast('新生士兵 ' + child.name + ' · ' + tierName, 'good');
    }
    this.rebuildIndex();
    this.save();
  },

  /* ---------------- market ---------------- */
  fairValue(so) {
    const p = EC.soldierPower(so, so.clan || this.state.clan);
    return 0.004 + p * 0.000072 + (so.tier || 0) * 0.0045 + (so.gen || 0) * 0.0012;
  },
  listSoldier(id, price) {
    const s = this.state;
    const so = this.soldier(id);
    if (!so) return { ok: false, error: '士兵不存在' };
    if (so.status !== 'idle') return { ok: false, error: '只能挂牌待命士兵' };
    if (so.spouse) return { ok: false, error: '已婚士兵不能挂牌（先解除关系？暂不支持）' };
    if (so.pregnant) return { ok: false, error: '孕育中不能挂牌' };
    if ((so.pocket || 0) > 0.0001) return { ok: false, error: '该士兵口袋里有代币，需先销毁领取才能移除' };
    if (!(price > 0)) return { ok: false, error: '设置价格' };
    if (s.market.listings.filter((l) => l.seller === 'player').length >= 4) return { ok: false, error: '最多同时挂牌 4 人' };
    const listing = {
      id: 'l' + Math.floor(Math.random() * 1e9), seller: 'player', soldierId: id, price,
      at: now(), expiresAt: now() + 10 * 60000, fair: this.fairValue(so), clan: s.clan,
    };
    s.market.listings.push(listing);
    so.status = 'listed';
    this.pushFeed({ type: 'list', icon: '⌁', clan: s.clan, mine: true, text: '你把 <b>' + so.name + '</b> 挂牌出售，标价 <b>' + U.fmtEth(price) + ' ETH</b>。' });
    this.save();
    return { ok: true, listing };
  },
  cancelListing(id) {
    const s = this.state;
    const l = s.market.listings.find((x) => x.id === id && x.seller === 'player');
    if (!l) return { ok: false, error: '挂牌不存在' };
    s.market.listings = s.market.listings.filter((x) => x.id !== id);
    const so = this.soldier(l.soldierId);
    if (so) so.status = 'idle';
    this.save();
    return { ok: true };
  },
  buyListing(id) {
    const s = this.state;
    const l = s.market.listings.find((x) => x.id === id && x.seller === 'npc');
    if (!l) return { ok: false, error: '该挂牌已不在市场' };
    if (now() > l.expiresAt) return { ok: false, error: '该挂牌已过期' };
    if (s.soldiers.length + (s.dead || []).length >= (s.onchainBound || []).length) return { ok: false, error: '链上军团名额已满：先铸造/同步更多 NFT' };
    if (s.player.eth < l.price) return { ok: false, error: 'ETH 不足' };
    s.player.eth -= l.price;
    const sold = EC.sellSoldier(s, l.price, false);
    const so = l.soldier;
    so.id = 's' + (s.nextId++);
    so.clan = s.clan;
    so.status = 'idle';
    so.zone = null;
    so.spouse = null;
    so.pregnant = false;
    so.birthId = null;
    so.children = [];
    so.childCount = 0;
    s.soldiers.push(so);
    s.market.listings = s.market.listings.filter((x) => x.id !== id);
    s.stats.bought++;
    s.stats.volume += l.price;
    this.rebuildIndex();
    this.pushFeed({ type: 'buy', icon: '⇣', clan: s.clan, mine: true, text: '你从市场买入 <b>' + so.name + '</b>，花费 <b>' + U.fmtEth(l.price) + ' ETH</b>。' });
    this.save();
    return { ok: true, soldier: so, fee: sold.fee };
  },
  seedMarket(n) {
    const s = this.state;
    for (let i = 0; i < n; i++) this.addNpcListing(true);
  },
  addNpcListing(silent) {
    const s = this.state;
    if (!s || s.phase !== 'playing') return;
    if (s.market.listings.filter((l) => l.seller === 'npc').length >= 10) return;
    const rng = U.makeRng(Math.floor(Math.random() * 2147483646));
    const clans = D.CLANS.map((c) => c.key).filter((k) => k !== s.clan);
    const clan = rng.pick(clans);
    const tier = rng.chance(0.72) ? 0 : rng.chance(0.7) ? 1 : rng.chance(0.75) ? 2 : rng.chance(0.8) ? 3 : 4;
    const so = this.makeSoldier(rng, clan, { gen: rng.int(1, 3), tier });
    so.status = 'listed';
    so.spouse = null;
    const fair = this.fairValue(so);
    const price = Math.max(0.004, fair * rng.range(0.88, 1.24));
    s.market.listings.push({
      id: 'l' + Math.floor(Math.random() * 1e9), seller: 'npc', soldier: so, price: Math.round(price * 10000) / 10000,
      at: now(), expiresAt: now() + 12 * 60000, fair, clan,
    });
  },
  marketTick(t) {
    const s = this.state;
    if (!s.market) return;
    if (t >= (s.market.nextAi || 0)) {
      s.market.nextAi = t + rand(16000, 30000);
      this.addNpcListing();
    }
    if (t >= (s.market.nextBuy || 0)) {
      s.market.nextBuy = t + rand(8000, 12000);
      const mine = s.market.listings.filter((l) => l.seller === 'player');
      for (const l of mine) {
        if (t > l.expiresAt) continue;
        const ratio = l.price / Math.max(0.0001, l.fair);
        const p = ratio <= 0.85 ? 0.62 : ratio <= 1.02 ? 0.36 : ratio <= 1.2 ? 0.13 : 0.025;
        if (Math.random() < p) {
          this.sellPlayerListing(l.id);
          break;
        }
      }
    }
    if (t >= (s.market.nextNpcSale || 0)) {
      s.market.nextNpcSale = t + rand(15000, 28000);
      const npc = s.market.listings.filter((l) => l.seller === 'npc' && t - l.at > 6000);
      if (npc.length) {
        const l = npc[Math.floor(Math.random() * npc.length)];
        EC.sellSoldier(s, l.price, false);
        s.market.listings = s.market.listings.filter((x) => x.id !== l.id);
        if (Math.random() < 0.22) {
          this.pushFeed({ type: 'market', icon: 'Ξ', text: '市场成交：<b>' + U.esc(l.soldier.name) + '</b> 以 <b>' + U.fmtEth(l.price) + ' ETH</b> 易手，手续费注入流动性。' });
        }
      }
    }
  },
  sellPlayerListing(id) {
    const s = this.state;
    const l = s.market.listings.find((x) => x.id === id && x.seller === 'player');
    if (!l) return;
    const so = this.soldier(l.soldierId);
    s.market.listings = s.market.listings.filter((x) => x.id !== id);
    if (!so) return;
    const sold = EC.sellSoldier(s, l.price, true);
    s.stats.sold++;
    s.stats.volume += l.price;
    this.killSoldiers([so.id], 'sold');
    this.pushFeed({ type: 'sale', icon: 'Ξ', clan: s.clan, mine: true, text: '你售出 <b>' + so.name + '</b>，成交 <b>' + U.fmtEth(l.price) + ' ETH</b>，手续费 <b>' + U.fmtEth(sold.fee) + '</b> 已路由。' });
    if (ORE.ui) { ORE.ui.toast('售出 ' + so.name + ' · +' + U.fmtEth(sold.net) + ' ETH', 'good'); ORE.ui.refreshMarketLive(); }
    this.save();
  },
  expireListings(t) {
    const s = this.state;
    if (!s.market || !s.market.listings.length) return;
    const expired = s.market.listings.filter((l) => l.expiresAt <= t);
    if (!expired.length) return;
    s.market.listings = s.market.listings.filter((l) => l.expiresAt > t);
    for (const l of expired) {
      if (l.seller === 'player') {
        const so = this.soldier(l.soldierId);
        if (so) so.status = 'idle';
      }
    }
    this.save();
  },

  /* ---------------- swap wrappers ---------------- */
  swapSell(oreIn) {
    const r = EC.sellOre(this.state, oreIn);
    if (r.ok) { this.save(); if (ORE.ui) ORE.ui.toast('卖出 ' + U.fmt(oreIn, 0) + ' ORE → ' + U.fmtEth(r.out) + ' ETH', 'good'); }
    return r;
  },
  swapBuy(ethIn) {
    const r = EC.buyOre(this.state, ethIn);
    if (r.ok) { this.save(); if (ORE.ui) ORE.ui.toast('买入 ' + U.fmt(r.out, 0) + ' ORE', 'good'); }
    return r;
  },
  addLp(oreIn) {
    const r = EC.addLiquidity(this.state, oreIn);
    if (r.ok) { this.save(); if (ORE.ui) ORE.ui.toast('注入流动性 ' + U.fmt(oreIn, 0) + ' ORE + ' + U.fmtEth(r.ethIn) + ' ETH', 'good'); }
    return r;
  },
  removeLp(pct) {
    const r = EC.removeLiquidity(this.state, pct);
    if (r.ok) { this.save(); if (ORE.ui) ORE.ui.toast('撤出流动性，取回 ' + U.fmt(r.oreOut, 0) + ' ORE', 'gold'); }
    return r;
  },

  /* ---------------- map sync & helpers ---------------- */
  syncMap() {
    const s = this.state;
    if (!s || !ORE.world || !ORE.world.map) return;
    const atkByZone = new Map();
    const avatarByZone = new Map();
    const bestByZone = new Map();
    for (const so of s.soldiers) {
      if (so.status !== 'garrison' || so.zone == null) continue;
      atkByZone.set(so.zone, (atkByZone.get(so.zone) || 0) + EC.soldierPower(so, s.clan, 'atk'));
      const pow = EC.soldierPower(so, s.clan, 'def');
      if (pow > (bestByZone.get(so.zone) || -1)) {
        bestByZone.set(so.zone, pow);
        avatarByZone.set(so.zone, so.id);
      }
    }
    const rows = s.zones.map((z) => ({
      owner: z.owner, garrison: this.garrisonCount(z), def: Math.round(this.zoneDefense(z)), fort: z.fort, borderBonus: z.borderBonus,
      atk: Math.round(atkByZone.get(z.id) || 0), avatar: avatarByZone.get(z.id) || null, vault: z.vault || 0, terrain: z.terrainName || null,
    }));
    const rates = s.zones.map((z) => (z.owner ? EC.zoneRate(s, z) : 0));
    const marches = s.marches.map((m) => ({ id: m.id, clan: m.clan, n: m.n, from: m.from, to: m.to, departAt: m.departAt, arriveAt: m.arriveAt, mine: m.mine }));
    const battles = (s.battles || []).map((b) => ({ id: b.id, clan: b.clan, n: b.n, from: b.from, to: b.to, startAt: b.startAt, endAt: b.endAt, mine: b.mine, atkClasses: b.atkClasses || null, defClasses: b.defClasses || null }));
    const map = ORE.world.map;
    map.setMe(s.clan);
    map.setTerrainMode((s.params && s.params.terrainMode) || '3d');
    map.setZones(rows);
    map.setRates(rates);
    map.setMarches(marches);
    map.setBattles(battles);
    map.setSelected(s.selected);
    if (s.phase === 'playing') map.setTargets(new Set(this.attackableIds()));
    else map.setTargets(null);
  },
  selectZone(id) {
    const s = this.state;
    if (id == null || id < 0 || !this.zone(id)) { this.closeZone(); return; }
    s.selected = id;
    this.syncMap();
    if (ORE.world && ORE.world.map) ORE.world.map.focus(id, 1.1);
    if (ORE.ui) ORE.ui.showZone(id);
  },
  closeZone() {
    this.state.selected = null;
    this.syncMap();
    if (ORE.ui) ORE.ui.showCommand();
  },

  pushFeed(ev) {
    const s = this.state;
    if (!s) return;
    const item = Object.assign({ t: now(), type: 'world', icon: '·', clan: null, mine: false }, ev);
    s.feed.unshift(item);
    if (s.feed.length > 60) s.feed.length = 60;
    s._feedVersion = (s._feedVersion || 0) + 1;
  },

  setParam(k, v) {
    const s = this.state;
    if (!s.params) return;
    s.params[k] = v;
    this.save();
  },

  fmt: U.fmt,
};

ORE.game = G;
})();
