/* 矿域 ORE.ZONE — UI, panels, modals, feed */
(function () {
'use strict';
const ORE = (window.ORE = window.ORE || {});
const ORE_TOKEN = '0xa7a339C8E75B19669af2C9D3596C8B4f721c424d';
const ORE_VAULT = '0x7dEf540A66Bf6Ba6377cF43e4a31b1758d18c26c';
const ORE_MINE_POOL = '0x1C88b562556944FF9944eB58e69Ca21451aAA28a';
const ORE_CLAIM = '0x6548b7ae';
const ORE_DEPOSIT = '0xb6b55f25';
const ERC20_APPROVE = '0x095ea7b3';
const U = ORE.util, D = ORE.data, E = D.ECON, G = ORE.game, EC = ORE.econ;
const $$ = U.$$;

const KIND = { base: '基地', mine: '矿脉' };
const STATUS = { idle: '待命', garrison: '驻防', marching: '行军', listed: '挂牌', pregnant: '孕育' };
const FEED_COL = { capture: '#ff5b45', lost: '#ff5a4f', defend: '#3ddc84', birth: '#d6a7ff', sale: '#fec23e', buy: '#3ddc84', extract: '#fec23e', warning: '#ff5a4f', market: '#5ba8ff', core: '#fec23e', offline: '#5ba8ff' };

function el(id) { return document.getElementById(id); }
function esc(s) { return U.esc(s); }
function pct(n) { const v = n * 100; return (v > 0 && v < 1 ? v.toFixed(2) : v.toFixed(0)) + '%'; }
function ts(t) { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function cap(so) { return so.pocket || 0; }
function power(so) { return Math.round(EC.soldierPower(so, G.state.clan)); }
function genderIcon(g) { return g === 'f' ? '♀' : '♂'; }
function clanPill(key, extra) {
  const c = key ? D.CLAN[key] : null;
  return '<span class="cpill ' + (c ? '' : 'neutral') + '" style="--c:' + (c ? c.color : '#2a2a2a') + ';--f:#000">' + (c ? c.name : '中立') + (extra || '') + '</span>';
}
function tierBadge(t) {
  const d = D.TIERS[t] || D.TIERS[0];
  return '<span class="tier" style="--t:' + d.color + '">' + d.name + '</span>';
}
function statusChip(so) {
  const st = so.pregnant ? 'pregnant' : so.status;
  return '<span class="wc-status ' + st + '">' + (STATUS[st] || st) + '</span>';
}
function av(so) { return ORE.avatar.portrait(so); }
function empty(text) { return '<div class="empty">' + text + '</div>'; }
function bar(p, color) {
  return '<div class="bar"><i style="width:' + U.clamp(p * 100, 0, 100).toFixed(1) + '%;' + (color ? 'background:' + color : '') + '"></i></div>';
}
function sparkline(hist, key, color) {
  const arr = (hist || []).slice(-80).map((h) => h[key]).filter((x) => isFinite(x));
  if (arr.length < 2) return '<svg class="spark" viewBox="0 0 300 58" preserveAspectRatio="none"></svg>';
  const min = Math.min(...arr), max = Math.max(...arr), span = max - min || 1;
  const pts = arr.map((v, i) => [(i / (arr.length - 1)) * 300, 54 - ((v - min) / span) * 46 - 2]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ' L300 58 L0 58 Z';
  const id = 'sg' + Math.floor(Math.random() * 1e8);
  return '<svg class="spark" viewBox="0 0 300 58" preserveAspectRatio="none">'
    + '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="' + color + '" stop-opacity=".22"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>'
    + '<path d="' + area + '" fill="url(#' + id + ')"/>'
    + '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linejoin="round"/></svg>';
}
function zoneKind(z) {
  if (z.kind === 'base') return '基地 · 不可攻击 · 产矿最低';
  const deg = Math.round((z.distBase || 0) * 180 / Math.PI);
  return '距基地 ' + deg + '° · 权重 ' + (z.weight || 0).toFixed(1) + ' · ' + (deg < 18 ? '腹地' : deg > 62 ? '远疆' : '边境');
}
function fmtRate(n) { return (n >= 100 ? n.toFixed(0) : n.toFixed(1)) + '/分'; }

const UI = {
  modalType: null,
  tab: { army: 'all', breed: 'match', market: 'soldiers', eco: 'dash', help: 'play' },
  army: { page: 1, status: 'all', gender: 'all', sort: 'power' },
  breed: { m: null, f: null },
  extract: { includeGarrison: true, count: 0 },
  chain: { account: null, nft: 0, minted: 0, total: 0, ore: 0, vaultOre: 0, poolOre: 0, gas: 0, gasLoaded: false, oreLoaded: false, loaded: false, chainOk: false, busy: false, msg: '' },
  wallet: { address: null, chainId: null, balance: 0 },
  market: { swapDir: 'sell', amt: '', lpPct: 50, listId: null, price: '' },
  garrison: { n: 10 },
  listId: null,
  _zoneSig: '',
  _zoneOwner: null,
  _feedV: -1,
  _lastPanel: 0,
  _lastWar: 0,

  /* ============================================================
     BOOT
     ============================================================ */
  init() {
    this.cache();
    this.bindGlobal();
    const s = G.state;
    document.documentElement.dataset.clan = s && s.clan ? s.clan : '';
    if (s && s.phase === 'playing') this.showCommand();
    else this.showLobby();
    this.tick();
    this.walletInit();
    this.refreshMintSupply();
    if (ORE.world && ORE.world.map) ORE.world.map.onPick = (id) => {
      if (this.modalType) return;
      if (!G.state || G.state.phase !== 'playing') {
        this.toast('先选择一个势力入伍', 'gold');
        return;
      }
      if (id < 0) G.closeZone(); else G.selectZone(id);
    };
  },

  cache() {
    this.pHero = el('pHero'); this.pMe = el('pMe'); this.pZone = el('pZone');
    this.panel = el('panel'); this.feed = el('feed'); this.feedList = el('feedList');
    this.modals = el('modals'); this.toasts = el('toasts');
    this.zName = el('zName'); this.zSub = el('zSub'); this.zOwner = el('zOwner');
    this.zYield = el('zYield'); this.zDef = el('zDef'); this.zDefS = el('zDefS');
    this.zGuards = el('zGuards'); this.zMine = el('zMine');
    this.zOrder = el('zOrder'); this.zActs = el('zActs'); this.zHint = el('zHint');
    this.oRange = el('oRange'); this.oN = el('oN'); this.oEst = el('oEst'); this.oMsg = el('oMsg');
    this.oGo = el('oGo'); this.oGoT = el('oGoT'); this.oTitle = el('oTitle'); this.oSub = el('oSub');
  },

  bindGlobal() {
    el('btnHelp').onclick = () => this.openHelp();
    el('btnSettings').onclick = () => this.openSettings();
    el('btnFeed').onclick = () => this.toggleFeed(true);
    el('feedClose').onclick = () => this.toggleFeed(false);
    el('chipOre').onclick = () => { if (G.state.phase === 'playing') this.openExtract(); else this.openHelp(); };
    el('chipEth').onclick = () => { if (G.state.phase === 'playing') this.openMarket('swap'); else this.openHelp(); };
    el('chipWallet').onclick = () => this.walletClick();
    el('brand').onclick = (e) => { e.preventDefault(); if (ORE.world && ORE.world.map) ORE.world.map.fit(true); };
    el('heroRules').onclick = () => this.openHelp();
    el('clanPick').onclick = (e) => {
      const b = e.target.closest('[data-clan]');
      if (!b) return;
      const key = b.dataset.clan;
      this.confirmEnlist(key);
    };
    el('zBack').onclick = () => G.closeZone();
    el('zIn').onclick = () => ORE.world.map.zoomTo(1.25, innerWidth / 2, innerHeight / 2);
    el('zOut').onclick = () => ORE.world.map.zoomTo(1 / 1.25, innerWidth / 2, innerHeight / 2);
    el('zFit').onclick = () => ORE.world.map.fit(true);
    el('grab').onclick = () => { this.panel.classList.toggle('collapsed'); if (ORE.world && ORE.world.map) setTimeout(() => { ORE.world.map.refreshInsets(); ORE.world.map.resize(); }, 30); };

    el('btnExtract').onclick = () => this.openExtract();
    el('panel').onclick = (e) => {
      const b = e.target.closest('[data-open]');
      if (!b) return;
      const t = b.dataset.open;
      if (t === 'army') this.openArmy();
      else if (t === 'breed') this.openBreed();
      else if (t === 'market') this.openMarket();
      else if (t === 'economy') this.openEconomy();
      else if (t === 'chain') this.openChain();
    };
    el('oRange').oninput = () => this.updateOrder();
    el('oMinus').onclick = () => { this.oRange.value = Math.max(1, +this.oRange.value - 1); this.updateOrder(); };
    el('oPlus').onclick = () => { this.oRange.value = Math.min(+this.oRange.max, +this.oRange.value + 1); this.updateOrder(); };
    el('oNeed').onclick = () => this.setEnough();
    el('oGo').onclick = () => {
      const n = +this.oRange.value;
      const r = G.attack(n);
      if (!r.ok) { this.oMsg.textContent = r.error; return; }
      this.oMsg.textContent = '';
      this.toast('部队已出发，约 ' + Math.ceil(r.travel / 1000) + ' 秒后接战', 'gold');
      this.refreshZone(true);
    };
    $$('.o-q [data-q]').forEach((b) => {
      b.onclick = () => {
        const f = +b.dataset.q;
        const idle = G.counts().idle;
        this.oRange.value = Math.max(1, Math.round(idle * f));
        this.updateOrder();
      };
    });
    el('zActs').onclick = (e) => {
      const b = e.target.closest('[data-zact]');
      if (!b) return;
      const act = b.dataset.zact;
      if (act === 'garrison') this.openGarrison(G.state.selected);
      else if (act === 'withdraw') {
        const r = G.withdraw(G.state.selected);
        if (r.ok) { this.toast('已撤回 ' + r.n + ' 名驻军', 'good'); this.refreshZone(true); }
      } else if (act === 'fort') {
        const r = G.fortify(G.state.selected);
        if (!r.ok) this.toast(r.error, 'bad');
        else { this.toast('筑防完成，焚毁 ' + r.cost + ' ORE', 'gold'); this.refreshZone(true); }
      }
    };
    el('oGoT').onclick = null;
    el('zHint').onclick = null;

    this.modals.onclick = (e) => this.onModalClick(e);
    this.modals.oninput = (e) => this.onModalInput(e);
    this.modals.onchange = (e) => this.onModalInput(e);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.modalType) this.closeModal();
        else if (G.state && G.state.selected != null && G.state.phase === 'playing') G.closeZone();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) G.save();
    });
    window.addEventListener('resize', () => {
      if (ORE.world && ORE.world.map) { ORE.world.map.refreshInsets(); ORE.world.map.resize(); }
    });
    el('feedList').onclick = (e) => {
      const li = e.target.closest('[data-zone]');
      if (!li) return;
      const id = +li.dataset.zone;
      if (G.state.phase === 'playing') { this.toggleFeed(false); G.selectZone(id); }
    };
  },

  confirmEnlist(key) {
    const c = D.CLAN[key];
    if (!c) return;
    const body = '<div class="note gold"><b>' + c.name + (ORE.i18n && ORE.i18n.current !== 'en' ? '' : ' · ' + c.en) + '</b><br>' + esc(c.lore) + '<br><br>专属加成：<b>' + c.perk + '</b></div>'
      + '<div class="grid-3" style="margin-top:12px">'
      + '<div class="mkt-kpi"><span>初始军团</span><b>0 人</b><em>由链上 NFT 决定</em></div>'
      + '<div class="mkt-kpi"><span>起始地块</span><b>' + G.state.zones.filter((z) => z.owner === key).length + ' 块</b></div>'
      + '<div class="mkt-kpi"><span>起始 ETH</span><b>' + U.fmtEth(E.startEth) + '</b></div>'
      + '</div>'
      + '<p class="fine">加入后不可更换势力。地图会被 AI 势力同步争夺。</p>';
    this.openRaw({
      kicker: 'ENLIST · 入伍',
      title: '以 ' + c.name + ' 之名',
      sub: '你会接管全部族地；初始军团为 0，连接钱包并铸造 NFT 后自动召唤。',
      body,
      footer: '<div class="spacer"></div><button class="btn ghost" data-act="close">再想想</button><button class="btn" data-act="enlist" data-clan="' + key + '">确认入伍</button>',
    });
    this._pendingClan = key;
  },

  onEnlist() {
    const s = G.state;
    document.documentElement.dataset.clan = s.clan;
    this.closeModal();
    this.showCommand();
    this.toast('欢迎入伍：先连接钱包并铸造链上士兵', 'gold');
    if (!s.hints || !s.hints.onboarded) setTimeout(() => this.openOnboarding(), 550);
    this.refreshAll();
  },

  /* ============================================================
     HEADER / PANEL / ZONE
     ============================================================ */
  showLobby() {
    if (this.panel) this.panel.scrollTop = 0;
    this.pHero.hidden = false; this.pMe.hidden = true; this.pZone.hidden = true;
    const rows = D.CLANS.map((c) => {
      const n = G.state.zones.filter((z) => z.owner === c.key && z.kind === 'mine').length;
      return '<button class="clan-row" data-clan="' + c.key + '" style="--c:' + c.color + '" role="listitem">'
        + '<span class="clan-sig">' + D.sigilSvg(c.key) + '</span>'
        + '<span class="clan-info"><b>' + c.name + (ORE.i18n && ORE.i18n.current !== 'en' ? '' : ' <em style="font-style:normal;font-size:9px;letter-spacing:.14em;color:var(--muted)">' + c.en + '</em>') + '</b>'
        + '<span>' + esc(c.lore) + '</span></span>'
        + '<span class="clan-bonus">' + c.bonusShort + '<br><em style="font-style:normal;color:var(--dim);font-weight:500">' + n + '矿块·1基地</em></span>'
        + '</button>';
    }).join('');
    el('clanPick').innerHTML = rows;
    this.scheduleMapFit('fit');
  },

  showCommand() {
    if (this.panel) this.panel.scrollTop = 0;
    const s = G.state;
    if (!s || s.phase !== 'playing') return;
    this.pHero.hidden = true; this.pMe.hidden = false; this.pZone.hidden = true;
    const c = D.CLAN[s.clan];
    el('meSig').innerHTML = D.sigilSvg(s.clan);
    el('meSig').style.background = c.color;
    el('meSig').style.color = '#000';
    el('meName').textContent = s.commander || '指挥官';
    el('meClan').textContent = c.name + ' · 第 1 纪元';
    el('mePill').textContent = c.name;
    el('mePill').style.setProperty('--c', c.color);
    el('mePill').style.setProperty('--f', '#000');
    this.updateCommand();
    this.scheduleMapFit('fit');
  },

  updateHeader() {
    const s = G.state;
    const playing = s && s.phase === 'playing';
    const c = playing ? G.counts() : { total: 0 };
    const totalPower = playing ? G.totalPower() : 0;
    el('ckPower').textContent = U.fmt(totalPower, 0);
    el('ckArmy').textContent = (c.totalAll != null ? c.totalAll : c.total);
    const chainPool = (playing && this.chain && this.chain.oreLoaded && this.chain.poolOre != null) ? this.chain.poolOre : null;
    const poolValue = chainPool != null ? chainPool : (playing ? s.econ.minePool : E.minePoolInitial);
    el('ckPool').textContent = U.fmt(poolValue, 0);
    el('ckPool').title = chainPool != null ? '链上 OreMinePool 剩余' : '本地矿池剩余';
    if (el('mPool')) el('mPool').textContent = '矿池 ' + U.fmtCompact(poolValue) + (chainPool != null ? ' · 链上' : '');
    if (el('mArmy')) el('mArmy').textContent = '总兵 ' + (c.totalAll != null ? c.totalAll : c.total) + ' · 阵亡 ' + (c.dead || 0) + ' · 战力 ' + U.fmtCompact(totalPower);
    const chainOreTop = (this.chain && this.chain.oreLoaded && this.chain.ore != null) ? this.chain.ore : null;
    const topVal = playing ? (chainOreTop != null ? chainOreTop : s.player.ore) : 0;
    el('topOre').textContent = U.fmt(topVal, topVal < 100 ? 4 : 0);
    const gasLoaded = this.chain && this.chain.gasLoaded && this.chain.account;
    el('topEth').textContent = gasLoaded ? U.fmt(this.chain.gas, this.chain.gas < 1 ? 4 : 3) : '—';
    el('topEth').title = gasLoaded ? '当前区块链网络主币余额（ETH / BNB）' : '连接钱包后读取当前网络主币余额';
    el('chipOre').title = (this.chain && this.chain.oreLoaded) ? '链上 ORE 代币余额' : '个人钱包 · 烧兵后 ORE 直接打入钱包';
  },

  updateCommand() {
    const s = G.state;
    if (!s || s.phase !== 'playing' || this.pMe.hidden) return;
    const c = G.counts();
    const rate = G.playerRate();
    const pool = s.econ.minePool || 0;
    const pocketTotal = s.soldiers.reduce((a, x) => a + (x.pocket || 0), 0);
    const canExtract = s.soldiers.some((x) => (x.pocket || 0) > 0.0001 && x.status !== 'marching' && x.status !== 'listed' && !x.pregnant);
    el('chestVal').textContent = U.fmtCompact(pool);
    el('chestCap').textContent = '总量 ' + U.fmtCompact(E.totalSupply);
    el('chestRate').textContent = '今日 +' + U.fmtCompact(s.econ.dayBudget || 0);
    el('chestBar').style.width = U.clamp((pool / E.minePoolInitial) * 100, 0, 100) + '%';
    el('chestNote').textContent = '每日产出剩余1% · 士兵口袋 ' + U.fmt(pocketTotal, pocketTotal < 100 ? 2 : 0);
    el('btnExtract').disabled = !canExtract;
    // 个人钱包 = 链上 ORE 代币余额（未连接钱包时回退到游戏内记账）
    const chainOre = (this.chain && this.chain.oreLoaded && this.chain.ore != null) ? this.chain.ore : null;
    const shownOre = chainOre != null ? chainOre : s.player.ore;
    el('walletOre').textContent = U.fmt(shownOre, shownOre < 100 ? 4 : 0);
    el('walletOre').title = chainOre != null ? '链上 ORE 代币余额（钱包地址）' : '未连接钱包，显示游戏内记账';
    const gasLoaded2 = this.chain && this.chain.gasLoaded && this.chain.account;
    el('walletEth').textContent = gasLoaded2 ? U.fmt(this.chain.gas, this.chain.gas < 1 ? 4 : 3) : '—';
    el('walletEth').title = gasLoaded2 ? '当前区块链网络主币余额（ETH / BNB）' : '连接钱包后读取当前网络主币余额';
    el('walletLp').textContent = s.player.lp > 0 ? (s.econ.lpTotal ? pct(s.player.lp / s.econ.lpTotal) : '0%') : '0';
    const vc = el('vaultChain');
    if (vc) {
      const parts = [];
      if (s.lastExtractTx) {
        const ex = s.lastExtractTx;
        parts.push('烧兵 <a href="https://testnet.bscscan.com/tx/' + ex.hash + '" target="_blank" rel="noreferrer">' + ex.hash.slice(0, 10) + '…</a>');
        if (ex.payoutTx) parts.push('矿池直付 <a href="https://testnet.bscscan.com/tx/' + ex.payoutTx + '" target="_blank" rel="noreferrer">' + ex.payoutTx.slice(0, 10) + '…</a>');
        else if (ex.paidOnchain === false) parts.push('<span style="color:#e7b15c">矿池直付未成功：' + (ex.payError || '未知') + '</span>');
      }
      if (s.lastOreTx) parts.push((s.lastOreTx.type === 'deposit' ? '充值' : '提取') + ' <a href="https://testnet.bscscan.com/tx/' + s.lastOreTx.hash + '" target="_blank" rel="noreferrer">' + s.lastOreTx.hash.slice(0, 10) + '…</a>');
      const burnApprove = this._burnApproved;
      const approveBtn = (this.wallet && this.wallet.address)
        ? '<button class="btn sm ghost" type="button" data-act="revoke-burn" title="撤销 OreBurner 对士兵 NFT 系列的授权">'
          + (burnApprove === true ? '撤销士兵授权（已授权）' : burnApprove === false ? '撤销士兵授权（当前未授权）' : '撤销士兵授权')
          + '</button>'
        : '';
      vc.innerHTML = (parts.length ? '链上 Tx：' + parts.join(' · ') : '链上 Tx：—（烧兵 / 提取 ORE 后显示 BscScan 记录）')
        + (approveBtn ? '<div style="margin-top:6px">' + approveBtn + '</div>' : '');
    }
    el('armyN').textContent = (c.totalAll != null ? c.totalAll : c.total);
    const deadNext = (s.dead || []).reduce((a, d) => Math.min(a, d.reviveAt || Infinity), Infinity);
    if (el('forceTotal')) el('forceTotal').textContent = (c.totalAll != null ? c.totalAll : c.total);
    if (el('forceAlive')) el('forceAlive').textContent = c.total;
    if (el('forceDead')) el('forceDead').textContent = c.dead || 0;
    if (el('forceNext')) el('forceNext').textContent = deadNext < Infinity ? U.mmss(deadNext - Date.now()) : '—';
    el('armySum').innerHTML = [
      ['i', '待命', c.idle], ['g', '驻防', c.garrison], ['m', '行军', c.marching], ['p', '育中', c.pregnant], ['d', '阵亡', c.dead || 0],
    ].map((x) => '<div class="as ' + x[0] + '"><b>' + x[2] + '</b><span>' + x[1] + '</span></div>').join('');
    const owned = s.zones.filter((z) => z.owner === s.clan && z.kind === 'mine');
    const ownBase = s.zones.filter((z) => z.owner === s.clan && z.kind === 'base').length;
    const allMine = s.zones.filter((z) => z.kind === 'mine');
    const heldMine = allMine.filter((z) => z.owner).length || 1;
    el('factionLine').innerHTML = '<span>矿块 <b>' + owned.length + '</b> / ' + allMine.length + ' · 基地 <b>' + ownBase + '</b></span><span>占已占矿脉 <b>' + pct(owned.length / heldMine) + '</b></span>';
    let hint = '点击地图上的地块，查看矿脉与战况。';
    if (c.total === 0) hint = '<b style="color:#f2ce4b">当前军团为 0。</b> 连接右上角 BSC 钱包 → 免费铸造士兵 NFT → 同步军团，链上有几个 NFT 就有几个士兵。';
    else if (owned.length === 0) hint = '<b style="color:#ff8a80">你已失去全部矿脉，只剩基地。</b> 从基地出兵，夺回边境。';
    else if (s.graceUntil > Date.now()) hint = '<b>新手保护</b> ' + U.mmss(s.graceUntil - Date.now()) + ' · 敌军暂不会进攻你。';
    else if (G.chestFull()) hint = '<b style="color:#e7b15c">金库已满，产出停止。</b> 烧兵提取，让矿脉重新流动。';
    else if (c.idle === 0) hint = '没有待命士兵。去 <b>婚育</b> 繁衍，或去 <b>市场</b> 买人。';
    else if (s.marches.filter((m) => !m.mine).length + (s.battles || []).filter((b) => !b.mine).length) hint = '<b style="color:#ff8a80">' + (s.marches.filter((m) => !m.mine).length + (s.battles || []).filter((b) => !b.mine).length) + ' 支敌军</b>正在行军/攻城，点击战报可定位。';
    if ((s.battles || []).some((b) => b.mine)) hint = '<b style="color:#f2ce4b">我军正在攻城。</b> 30 秒后结算，点击城墙可查看。';
    el('meHint').innerHTML = hint;
    el('meHint').classList.toggle('warn', G.chestFull());
  },

  showZone(id) {
    const s = G.state, z = G.zone(id);
    if (!z) return;
    this.pHero.hidden = true; this.pMe.hidden = true; this.pZone.hidden = false;
    this._zoneOwner = z.owner;
    this._zoneSig = '';
    el('zName').textContent = z.name;
    this.updateZone();
    if (z.kind === 'mine' && z.owner !== s.clan) {
      const max = Math.max(1, Math.min(G.counts().idle, 80));
      const rec = Math.min(max, Math.max(6, Math.ceil(G.zoneDefense(z) / 60)));
      this.oRange.max = max;
      this.oRange.value = rec;
      this.updateOrder();
    }
    this.scheduleMapFit('zone', id);
  },

  updateZone(force) {
    const s = G.state;
    if (s.selected == null || this.pZone.hidden) return;
    const z = G.zone(s.selected);
    if (!z) { G.closeZone(); return; }
    if (this._zoneOwner !== z.owner && !force) { this.showZone(z.id); return; }
    this._zoneOwner = z.owner;
    const isMine = z.owner === s.clan;
    const isBase = z.kind === 'base';
    const owner = z.owner ? D.CLAN[z.owner] : null;
    const deg = Math.round((z.distBase || 0) * 180 / Math.PI);

    el('zSub').textContent = z.en + ' · ' + zoneKind(z);
    el('zOwner').textContent = owner ? owner.name : '中立';
    el('zOwner').className = 'cpill' + (owner ? '' : ' neutral');
    el('zOwner').style.setProperty('--c', owner ? owner.color : '#2a2a2a');
    el('zOwner').style.setProperty('--f', '#000');

    el('zYield').textContent = G.zoneRate(z.id).toFixed(1);
    el('zDef').textContent = isBase ? '—' : U.fmt(Math.round(G.zoneDefense(z)));
    el('zDefS').textContent = isBase ? '不可攻击' : isMine ? '你的驻军' : z.owner ? '敌军驻军' : '中立民兵';
    el('zGuards').textContent = G.garrisonCount(z);
    el('zMine').textContent = isBase ? (isMine ? '你的基地' : '敌方基地') : isMine ? '驻防中' : z.owner ? '敌方' : '禁军';

    const sig = z.kind + '|' + z.nb.map((n) => { const q = G.zone(n); return q ? q.owner : 'x'; }).join(',') + '|' + Math.round(G.zoneDefense(z)) + '|' + z.fort + '|' + Math.floor(s.player.ore) + '|' + Math.round((z.relYield || 0) * 100) + '|' + z.garrisonIds.length;
    if (sig !== this._zoneSig) {
      this._zoneSig = sig;
      el('zNeighbors').innerHTML = z.nb.map((n) => {
        const q = G.zone(n); if (!q) return '';
        const col = q.owner ? D.CLAN[q.owner].color : '#3a3a3a';
        return '<button class="nb" data-zone="' + q.id + '" style="--c:' + col + '"><i></i>' + q.name + '</button>';
      }).join('');
      el('zNeighbors').onclick = (e) => { const b = e.target.closest('[data-zone]'); if (b) G.selectZone(+b.dataset.zone); };
    }

    if (isBase) {
      el('zOrder').hidden = true;
      if (isMine) {
        el('zActs').hidden = false;
        el('zActs').innerHTML = '<button class="btn" data-zact="garrison">调防</button>'
          + (z.garrisonIds.length ? '<button class="btn ghost" data-zact="withdraw">撤回驻军</button>' : '');
        el('zHint').innerHTML = '<b>你的基地</b>不可被攻击，是绝对安全的出兵点。基地本身产矿最低；<b>离基地越远，矿脉产出越高</b>。';
      } else {
        el('zActs').hidden = true;
        el('zHint').innerHTML = '敌方<b>基地</b>：不可攻击、不可占领。三座基地在球面上互相等距。';
      }
      return;
    }

    if (isMine) {
      el('zOrder').hidden = true;
      el('zActs').hidden = false;
      const cost = z.fort < E.fortMax ? E.fortCosts[z.fort + 1] : null;
      el('zActs').innerHTML = '<button class="btn" data-zact="garrison">调防</button>'
        + '<button class="btn ghost" data-zact="withdraw">撤回驻军</button>'
        + '<button class="btn ghost" data-zact="fort">' + (cost == null ? '筑防已满' : '筑防 Lv.' + (z.fort + 1) + ' · ' + cost + ' ORE' + (s.player.ore < cost ? '（不足）' : '')) + '</button>';
      el('zActs').querySelectorAll('[data-zact="fort"]').forEach((b) => { b.disabled = cost == null || s.player.ore < cost; });
      const incoming = s.marches.filter((m) => !m.mine && m.to === z.id);
      let hint = '距你的基地 <b>' + deg + '°</b>。当前每秒产出 ' + (G.zoneRate(z.id) / 60).toFixed(4) + ' ORE：80% 进驻军口袋，20% 进地块金库（<b>' + U.fmt(z.vault || 0, 1) + '</b>）。'
        + '<br><span style="color:#f2ce4b">离自己的基地越远，产矿率越高。</span>';
      if (incoming.length) hint = '<b style="color:#ff8a80">敌军 ' + incoming.reduce((a, m) => a + m.n, 0) + ' 名，' + U.mmss(incoming[0].arriveAt - Date.now()) + ' 后抵达。</b> 立即调防可增强防御。';
      else if (z.garrisonIds.length === 0) hint += '<br><b style="color:#e7b15c">无驻军。</b> 防御仅靠工事，容易被敌军占领。';
      el('zHint').innerHTML = hint;
      return;
    }

    el('zOrder').hidden = false;
    el('zActs').hidden = true;
    const origin = G.canAttack(z.id);
    const idle = G.counts().idle;
    const max = Math.max(1, Math.min(idle, 80));
    if (+this.oRange.max !== max) this.oRange.max = max;
    let val = +this.oRange.value;
    if (!val || val > max) val = Math.min(max, Math.max(6, Math.ceil(G.zoneDefense(z) / 60)));
    this.oRange.value = val;
    el('oN').textContent = val;
    el('oTitle').textContent = '发动突袭';
    el('oSub').textContent = origin ? (origin.exile ? '流亡军 · 全图突袭' : '从 ' + origin.name + ' 出发') : '需要相邻己方地块';
    const lootLine = (z.vault || 0) > 0 ? '<div class="loot-line"><span>攻占后夺取地块金库，按战力分给参战士兵</span><b>' + U.fmt(z.vault, 1) + ' ORE</b></div>' : '';
    el('zHint').innerHTML = '敌方矿脉，距其当前基地 <b>' + deg + '°</b>。占领后会按<b>你与基地的距离</b>重新计算产出：离你基地越远，产矿越高。'
      + '<br><span style="color:#8d8a80">该地块当前产出 ' + G.zoneRate(z.id).toFixed(1) + ' ORE/分；抵达后攻城 30 秒结算。</span>';
    if (!origin) {
      this.oGo.disabled = true;
      el('oMsg').innerHTML = '该地块不与你的领地相邻。先扩张到它旁边。';
    } else if (!idle) {
      this.oGo.disabled = true;
      el('oMsg').innerHTML = '没有待命士兵。';
    } else {
      this.oGo.disabled = false;
      el('oMsg').innerHTML = '';
    }
    this.oGoT.textContent = '派出 ' + val + ' 人突袭';
    const oldLoot = this.zOrder.querySelector('.loot-line');
    if (oldLoot) oldLoot.remove();
    if (lootLine) this.oMsg.insertAdjacentHTML('beforebegin', lootLine);
  },

  updateOrder() {
    const s = G.state;
    const z = s.selected != null ? G.zone(s.selected) : null;
    if (!z || z.kind !== 'mine' || z.owner === s.clan) return;
    const max = Math.max(1, +this.oRange.max || 1);
    let n = U.clamp(Math.round(+this.oRange.value || 1), 1, max);
    this.oRange.value = n;
    el('oN').textContent = n;
    const est = G.estimateAttack(n);
    if (est) {
      const cls = est.chance > 0.72 ? 'good' : est.chance > 0.45 ? 'warn' : 'bad';
      this.oEst.innerHTML = '胜率 <b class="' + cls + '">' + pct(est.chance) + '</b> · 战力 <b>' + est.power + '</b> vs 防御 <b>' + est.def + '</b>'
        + '<br>若胜预计损失 ' + Math.max(1, Math.round(n * est.winLoss)) + ' 人；若败损失 ' + Math.max(1, Math.round(n * est.loseLoss)) + ' 人';
    } else {
      this.oEst.innerHTML = '';
    }
    const origin = G.canAttack(z.id);
    const idle = G.counts().idle;
    this.oGoT.textContent = '派出 ' + n + ' 人突袭';
    if (!origin) { this.oGo.disabled = true; this.oMsg.innerHTML = '该地块不与你的领地相邻。先扩张到它旁边。'; }
    else if (!idle) { this.oGo.disabled = true; this.oMsg.innerHTML = '没有待命士兵。'; }
    else { this.oGo.disabled = false; this.oMsg.innerHTML = ''; }
  },

  updateFeed() {
    const s = G.state;
    if (!s) return;
    const v = s._feedVersion || 0;
    if (v === this._feedV) return;
    this._feedV = v;
    const items = (s.feed || []).slice(0, 24);
    this.feedList.innerHTML = items.map((f, i) => {
      const col = FEED_COL[f.type] || (f.clan ? D.CLAN[f.clan].color : '#8a8a8a');
      const zone = f.zone != null ? ' data-zone="' + f.zone + '"' : '';
      return '<li class="fi ' + (i === 0 ? 'new ' : '') + (f.mine ? 'mine' : '') + '" style="--c:' + col + '"' + zone + '>'
        + '<span class="fi-ic">' + (f.icon || '◇') + '</span>'
        + '<div class="fi-b"><p>' + f.text + '</p><time>' + ts(f.t) + '</time></div></li>';
    }).join('');
    this.feedList.scrollTop = 0;
  },

  updateWar() {
    const s = G.state;
    const totalW = s.totalWeight || 1;
    const by = {};
    for (const c of D.CLANS) by[c.key] = { n: 0, w: 0, rate: 0 };
    let neutralN = 0, neutralW = 0;
    for (const z of s.zones) {
      if (z.kind !== 'mine') continue;
      if (z.owner && by[z.owner]) { by[z.owner].n++; by[z.owner].w += z.weight; by[z.owner].rate += G.zoneRate(z.id); }
      else { neutralN++; neutralW += z.weight; }
    }
    const order = D.CLANS.slice().sort((a, b) => by[b.key].w - by[a.key].w);
    const segs = order.map((c) => '<i style="width:' + (by[c.key].w / totalW * 100).toFixed(2) + '%;background:' + c.color + '"></i>').join('')
      + '<i style="width:' + (neutralW / totalW * 100).toFixed(2) + '%;background:#2a2a2a"></i>';
    el('warBar').innerHTML = segs;
    const top = order[0];
    el('warHolder').textContent = (by[top.key].w >= neutralW ? top.name + '领先' : '中立之地') + ' · 基地不可攻击';
    el('warTotal').textContent = (s.clan ? by[s.clan].n : 0) + ' / ' + s.zones.filter((z) => z.kind === 'mine').length + ' 矿块';
    el('warKey').innerHTML = order.map((c) => '<span style="--c:' + c.color + '"><i></i>' + c.name + ' ' + (by[c.key].w / totalW * 100).toFixed(0) + '%</span>').join('')
      + (neutralW > 0.01 ? '<span style="--c:#3a3a3a"><i></i>中立 ' + (neutralW / totalW * 100).toFixed(0) + '%</span>' : '');
    el('rankList').innerHTML = order.map((c, i) => {
      const x = by[c.key];
      return '<div class="rank-row ' + (c.key === s.clan ? 'me' : '') + '">'
        + '<span class="rk">' + (i + 1) + '</span>'
        + '<span class="rn" style="--c:' + c.color + '"><i></i>' + c.name + '</span>'
        + '<span class="rz">' + x.n + ' 矿块</span>'
        + '<span class="ry">' + (x.rate >= 10 ? Math.round(x.rate) : x.rate.toFixed(1)) + '/m</span></div>';
    }).join('');
  },

  /* ============================================================
     TICK
     ============================================================ */
  tick() {
    const s = G.state;
    if (!s) return;
    this.updateHeader();
    if (s.phase === 'playing') {
      if (this.pMe.hidden && this.pZone.hidden) this.showCommand();
      this.updateCommand();
      if (!this.pZone.hidden) this.updateZone();
    }
    this.updateFeed();
    const t = Date.now();
    if (t - this._lastWar > 600) { this._lastWar = t; this.updateWar(); }
    if (this.modalType === 'extract') this.refreshExtractLive();
    if (this.modalType === 'breed') this.refreshBreedLive();
    if (this.modalType === 'market' && this.tab.market === 'swap') this.refreshSwapLive();
    if (this.modalType === 'army') this.refreshArmyLive();
    if (this.modalType === 'economy') this.refreshEcoLive();
  },

  refreshAll() { this.tick(); this.updateFeed(); this.updateWar(); },

  scheduleMapFit(mode, id) {
    requestAnimationFrame(() => {
      const map = ORE.world && ORE.world.map;
      if (!map) return;
      map.refreshInsets(); map.resize();
      if (mode === 'zone' && id != null) map.focus(id, 1.08);
      else map.fit();
    });
  },

  /* ============================================================
     MODAL SHELL
     ============================================================ */
  shell(o) {
    const tabs = o.tabs && o.tabs.length ? '<div class="tabs">' + o.tabs.map((t) =>
      '<button class="tab ' + (t.on ? 'on' : '') + '" data-tab="' + t.key + '">' + t.label + (t.badge ? ' <span class="badge">' + t.badge + '</span>' : '') + '</button>').join('') + '</div>' : '';
    return '<div class="modal" data-modal><div class="sheet ' + (o.wide ? 'wide' : '') + '">'
      + '<div class="sheet-h"><div class="sh-t"><span class="kicker"><i></i>' + (o.kicker || '') + '</span><h2>' + o.title + '</h2>' + (o.sub ? '<p>' + o.sub + '</p>' : '') + '</div>'
      + '<button class="x" data-act="close" aria-label="关闭">×</button></div>'
      + tabs
      + '<div class="modal-msg" id="modalMsg" role="status"></div>'
      + '<div class="sheet-b">' + o.body + '</div>'
      + (o.footer ? '<div class="sheet-f">' + o.footer + '</div>' : '')
      + '</div></div>';
  },

  openRaw(o) {
    if (this.toasts) this.toasts.innerHTML = '';
    this.modals.innerHTML = this.shell(o);
    this.modalType = o.type || 'raw';
    document.body.classList.add('modal-open');
  },

  closeModal() {
    this.stopUnitShowcase();
    this.modals.innerHTML = '';
    this.modalType = null;
    this._pendingClan = null;
    document.body.classList.remove('modal-open');
  },

  openModal(type, opts) {
    const fn = this['modal_' + type];
    if (!fn) return;
    this.stopUnitShowcase();
    this.modalType = type;
    if (this.toasts) this.toasts.innerHTML = '';
    this.modals.innerHTML = fn.call(this, opts || {});
    document.body.classList.add('modal-open');
    this._bindModal();
    if (type === 'extract') requestAnimationFrame(() => this.refreshExtract());
    if (type === 'help' && this.tab.help === 'units') requestAnimationFrame(() => this.startUnitShowcase());
  },

  _bindModal() {
    const root = this.modals;
    root.querySelectorAll('input[type="range"]').forEach((r) => {
      if (r.dataset.bind) return;
      r.dataset.bind = '1';
      r.oninput = () => this.onModalInput({ target: r });
    });
  },

  onModalClick(e) {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) {
      const key = tabBtn.dataset.tab;
      if (this.modalType === 'army' || this.modalType === 'breed' || this.modalType === 'market' || this.modalType === 'economy' || this.modalType === 'help') {
        this.tab[this.modalType === 'economy' ? 'eco' : this.modalType] = key;
        this.openModal(this.modalType);
      }
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) {
      if (e.target.hasAttribute('data-modal')) this.closeModal();
      return;
    }
    this.doAct(b.dataset.act, b, e);
  },

  doAct(act, b, e) {
    const s = G.state;
    switch (act) {
      case 'close': this.closeModal(); break;
      case 'enlist': G.enlist(this._pendingClan || b.dataset.clan); break;
      case 'open-army': this.openArmy(); break;
      case 'open-breed': this.openBreed(); break;
      case 'open-market': this.openMarket(); break;
      case 'open-economy': this.openEconomy(); break;
      case 'open-help': this.openHelp(); break;
      case 'open-settings': this.openSettings(); break;
      case 'open-chain': this.openChain(); break;
      case 'terrain-mode': { const s=G.state; s.params = s.params || {}; s.params.terrainMode = b.dataset.v === 'faction' ? 'faction' : '3d'; G.save(); G.syncMap(); this.toast(s.params.terrainMode === '3d' ? '已切换 3D 地貌' : '已切换势力色块', 'gold'); this.openSettings(); break; }
      case 'chain-connect': this.chainConnect(); break;
      case 'chain-refresh': this.chainRead(false); break;
      case 'chain-mint': this.chainMint(); break;
      case 'chain-sync': this.chainSync(); break;
      case 'revoke-burn': {
        if (this._revoking) break;
        this._revoking = true;
        (async () => {
          try {
            const r = await G.revokeBurnApproval();
            if (!r.ok) { this.toast('撤销失败：' + r.error, 'bad'); return; }
            this.toast('已撤销 OreBurner 对士兵 NFT 的授权', 'good');
            this._burnApproved = false;
            this.refreshAll();
          } finally { this._revoking = false; }
        })();
        break;
      }
      case 'ore-claim': this.oreClaim(); break;
      case 'ore-deposit': this.oreDeposit(); break;
      case 'ore-claim-max': { const i=this.modals.querySelector('#oreClaimAmt'); if(i && ORE.game.state) i.value=ORE.game.state.player.ore.toFixed(4); break; }
      case 'wallet-pick': this.walletChoose(b.dataset.id); break;
      case 'wallet-rediscover': this.walletDiscover(); this.openWalletPicker(this.walletReturn); break;
      case 'open-wallet': this.openWalletPicker('chain'); break;
      case 'open-extract': this.openExtract(); break;
      case 'army-status': this.army.status = b.dataset.v; this.army.page = 1; this.openModal('army'); break;
      case 'army-gender': this.army.gender = b.dataset.v; this.army.page = 1; this.openModal('army'); break;
      case 'army-sort': this.army.sort = b.dataset.v; this.openModal('army'); break;
      case 'army-page': this.army.page = +b.dataset.v; this.openModal('army'); break;
      case 'army-station': {
        const so = G.soldier(b.dataset.id);
        const zid = b.dataset.zone;
        if (!so || !zid) { this.toast('先选择一个己方地块', 'bad'); return; }
        const r = G.stationSoldier(so.id, +zid);
        if (!r.ok) this.toast(r.error, 'bad'); else this.toast(so.name + ' 已驻防', 'good');
        this.openModal('army'); break;
      }
      case 'army-withdraw': {
        const so = G.soldier(b.dataset.id);
        if (so) { const r = G.unstationSoldier(so.id); if (!r.ok) this.toast(r.error, 'bad'); else this.toast(so.name + ' 已撤回', 'good'); }
        this.openModal('army'); break;
      }
      case 'army-list': this.openList(b.dataset.id); break;
      case 'army-cancel': {
        const l = s.market.listings.find((x) => x.soldierId === b.dataset.id && x.seller === 'player');
        if (l) G.cancelListing(l.id);
        this.openModal('army'); break;
      }
      case 'army-zone': { const so = G.soldier(b.dataset.id); if (so && so.zone != null) { this.closeModal(); G.selectZone(so.zone); } break; }
      case 'breed-select': {
        const sc = [...this.modals.querySelectorAll('.pick-list')].map((x) => x.scrollTop);
        if (b.dataset.g === 'm') this.breed.m = b.dataset.id; else this.breed.f = b.dataset.id;
        this.openModal('breed');
        requestAnimationFrame(() => this.modals.querySelectorAll('.pick-list').forEach((x, i) => { x.scrollTop = sc[i] || 0; }));
        break;
      }
      case 'breed-marry': {
        const r = G.marry(this.breed.m, this.breed.f);
        if (!r.ok) this.toast(r.error, 'bad');
        else { this.toast('结为伴侣 · 焚毁/注入 ' + r.cost + ' ORE', 'gold'); this.breed.m = null; this.breed.f = null; this.tab.breed = 'nursery'; }
        this.openModal('breed'); break;
      }
      case 'breed-go': {
        const r = G.breed(b.dataset.a, b.dataset.b);
        if (!r.ok) this.toast(r.error, 'bad'); else this.toast('开始孕育，' + Math.round(E.gestation / 1000) + ' 秒后诞生', 'gold');
        this.openModal('breed'); break;
      }
      case 'extract-mode': this.extract.includeGarrison = b.dataset.v === '1'; this.extract.count = 0; this.openModal('extract'); break;
      case 'extract-go': {
        if (this._extracting) break;
        const set = this.currentExtract();
        const btn = this.modals.querySelector('#exGo');
        this._extracting = true;
        if (btn) { btn.disabled = true; btn.textContent = '等待链上确认…'; }
        (async () => {
          try {
            const r = await G.extract(set.ids);
            if (!r.ok) {
              this.toast(r.error, 'bad');
              if (r.burned) { this.closeModal(); this.refreshAll(); }
            } else {
              this.toast('烧毁 ' + r.burned + ' 人，取出 ' + U.fmt(r.amount, 1) + ' ORE' + (r.nftBurned ? ' · ' + r.nftBurned + ' 个 NFT 已用一笔交易批量销毁' : ''), 'gold');
              this.closeModal();
              this.refreshAll();
            }
          } catch (e) {
            this.toast('烧兵失败：' + (e.shortMessage || e.message || '未知错误'), 'bad');
          } finally {
            this._extracting = false;
            if (btn && this.modals.contains(btn)) { btn.disabled = false; btn.textContent = '确认退伍并领取'; }
          }
        })();
        break;
      }
      case 'market-buy': {
        const r = G.buyListing(b.dataset.id);
        if (!r.ok) this.toast(r.error, 'bad'); else { this.toast('买入 ' + r.soldier.name, 'good'); this.openModal('market'); }
        break;
      }
      case 'market-cancel': {
        const r = G.cancelListing(b.dataset.id);
        if (!r.ok) this.toast(r.error, 'bad'); else this.toast('已下架', 'gold');
        this.openModal('market'); break;
      }
      case 'market-list-go': {
        const sel = this.modals.querySelector('#listSoldier');
        const price = parseFloat((this.modals.querySelector('#listPrice') || {}).value || '0');
        if (!sel) return;
        const r = G.listSoldier(sel.value, price);
        if (!r.ok) this.toast(r.error, 'bad'); else { this.toast('已挂牌 · ' + U.fmtEth(price) + ' ETH', 'gold'); this.market.listId = null; this.openModal('market'); }
        break;
      }
      case 'market-price-fair': {
        const sel = this.modals.querySelector('#listSoldier');
        const so = sel ? G.soldier(sel.value) : null;
        if (so) { this.modals.querySelector('#listPrice').value = G.fairValue(so).toFixed(4); this.updateListQuote(); }
        break;
      }
      case 'market-swap-dir': this.market.swapDir = b.dataset.v; this.market.amt = ''; this.openModal('market'); break;
      case 'market-swap-max': {
        const s2 = G.state;
        this.market.amt = this.market.swapDir === 'sell' ? String(Math.floor(s2.player.ore)) : s2.player.eth.toFixed(4);
        this.openModal('market'); break;
      }
      case 'market-swap': this.doSwap(); break;
      case 'market-lp-add': {
        const v = parseFloat((this.modals.querySelector('#lpOre') || {}).value || '0');
        const r = G.addLp(v);
        if (!r.ok) this.toast(r.error, 'bad'); else { this.toast('LP 已注入', 'good'); this.openModal('market'); }
        break;
      }
      case 'market-lp-remove': {
        const p = +b.dataset.v / 100;
        const r = G.removeLp(p);
        if (!r.ok) this.toast(r.error, 'bad'); else { this.toast('LP 已撤出', 'gold'); this.openModal('market'); }
        break;
      }
      case 'eco-reset': {
        G.state.params = { emission: 1, extraction: 1, breed: 1, fee: E.marketFee };
        G.save(); this.openModal('economy'); break;
      }
      case 'settings-export': {
        const txt = G.exportSave();
        const ta = this.modals.querySelector('#saveText');
        if (ta) { ta.value = txt; ta.select(); }
        U.download('ore-zone-save.json', txt);
        this.toast('存档已导出', 'good'); break;
      }
      case 'settings-copy': {
        const ta = this.modals.querySelector('#saveText');
        if (ta) { ta.select(); document.execCommand('copy'); this.toast('已复制存档', 'good'); }
        break;
      }
      case 'settings-import': {
        const ta = this.modals.querySelector('#saveText');
        try { G.importSave(ta.value); } catch (err) { this.toast('导入失败：' + err.message, 'bad'); }
        break;
      }
      case 'settings-reset': {
        if (confirm('确定重开？当前地图、军团、市场与流动性都会清空。')) G.reset();
        break;
      }
      case 'garrison-station': {
        const n = +((this.modals.querySelector('#gRange') || {}).value || 10);
        const r = G.station(G.state.selected, n);
        if (!r.ok) this.toast(r.error, 'bad'); else this.toast('派驻 ' + r.n + ' 人', 'good');
        this.openModal('garrison'); break;
      }
      case 'garrison-withdraw': {
        const r = G.withdraw(G.state.selected);
        if (r.ok) this.toast('撤回 ' + r.n + ' 人', 'gold');
        this.openModal('garrison'); break;
      }
      case 'list-confirm': {
        const price = parseFloat((this.modals.querySelector('#listPrice') || {}).value || '0');
        const r = G.listSoldier(this.listId, price);
        if (!r.ok) this.toast(r.error, 'bad');
        else { this.toast('已挂牌', 'gold'); this.closeModal(); this.openMarket('soldiers'); }
        break;
      }
      case 'onboard-next': this.onboardStep(1); break;
      case 'onboard-prev': this.onboardStep(-1); break;
      case 'onboard-done': {
        G.state.hints = G.state.hints || {}; G.state.hints.onboarded = true; G.save(); this.closeModal(); break;
      }
      case 'core-close': this.closeModal(); break;
    }
  },

  onModalInput(e) {
    const t = e.target;
    if (!t || !t.id) return;
    if (t.id === 'exRange') { this.extract.count = +t.value; this.refreshExtract(); }
    else if (t.id === 'swapAmt') { this.market.amt = t.value; this.updateSwapQuote(); }
    else if (t.id === 'lpOre') this.updateLpQuote();
    else if (t.id === 'listPrice') this.updateListQuote();
    else if (t.id === 'listSoldier') {
      const so = G.soldier(t.value);
      if (so) {
        const p = this.modals.querySelector('#listPrice');
        if (p) p.value = G.fairValue(so).toFixed(4);
        this.updateListQuote();
      }
    } else if (t.id === 'gRange') {
      const n = +t.value;
      const o = this.modals.querySelector('#gN'); if (o) o.textContent = n;
    } else if (t.dataset.param) {
      const k = t.dataset.param, v = +t.value;
      G.setParam(k, v);
      const out = this.modals.querySelector('[data-out="' + k + '"]');
      if (out) out.textContent = k === 'fee' ? (v * 100).toFixed(1) + '%' : '×' + v.toFixed(2);
      if (k === 'fee') this.updateFeeHint(v);
    }
  },

  /* ============================================================
     ARMY
     ============================================================ */
  openArmy() { this.openModal('army'); },
  modal_army() {
    const s = G.state;
    if (!s || s.phase !== 'playing') return '';
    const st = this.army;
    let list = s.soldiers.slice();
    if (st.status !== 'all') {
      if (st.status === 'pregnant') list = list.filter((x) => x.pregnant);
      else list = list.filter((x) => x.status === st.status && !x.pregnant);
    }
    if (st.gender !== 'all') list = list.filter((x) => x.gender === st.gender);
    if (st.sort === 'cap') list.sort((a, b) => cap(b) - cap(a));
    else if (st.sort === 'gen') list.sort((a, b) => b.gen - a.gen || b.tier - a.tier);
    else if (st.sort === 'new') list.sort((a, b) => b.bornAt - a.bornAt);
    else list.sort((a, b) => power(b) - power(a) || b.tier - a.tier);
    const per = 24, pages = Math.max(1, Math.ceil(list.length / per));
    if (st.page > pages) st.page = pages;
    const page = list.slice((st.page - 1) * per, st.page * per);
    const c = G.counts();
    const zone = s.selected != null ? G.zone(s.selected) : null;
    const zoneOk = zone && zone.owner === s.clan;
    const cards = page.map((so) => {
      let btn;
      if (so.status === 'idle') {
        btn = '<span style="display:flex;gap:3px"><button data-act="army-list" data-id="' + so.id + '" ' + (so.spouse ? 'disabled' : '') + '>售</button><button data-act="army-station" data-id="' + so.id + '" data-zone="' + (zoneOk ? zone.id : '') + '" ' + (zoneOk ? '' : 'disabled title="先选择己方地块"') + '>驻防</button></span>';
      } else if (so.status === 'garrison') {
        btn = '<button data-act="army-withdraw" data-id="' + so.id + '">撤回</button>';
      } else if (so.status === 'listed') {
        btn = '<button data-act="army-cancel" data-id="' + so.id + '">下架</button>';
      } else if (so.status === 'pregnant') {
        btn = '<button disabled>孕育</button>';
      } else {
        btn = '<button disabled>行军</button>';
      }
      return '<div class="wcard">' + statusChip(so)
        + '<span class="av">' + av(so) + '</span>'
        + '<div class="wc-b"><div class="wc-t"><b>' + esc(so.name) + '</b>' + tierBadge(so.tier) + '<span class="soldier-id">#' + esc(so.nft != null ? so.nft : so.id) + '</span></div>'
        + '<div class="wc-s"><span>' + so.clsName + ' · ' + genderIcon(so.gender) + ' · ' + (so.gen ? '第' + so.gen + '代' : (so.nft ? '链铸' : '创世')) + '</span><span>' + (so.spouse || so.pregnant ? (so.pregnant ? '育中' : '已婚') : '') + '</span></div>'
        + '<div class="wc-stats"><div><span>ATK</span><b>' + so.atk + '</b></div><div><span>DEF</span><b>' + so.def + '</b></div><div><span>SPD</span><b>' + so.spd + '</b></div><div><span>口袋</span><b>' + U.fmt(so.pocket || 0, (so.pocket || 0) < 100 ? 2 : 0) + '</b></div></div>'
        + '<div class="wc-f"><span>战力 ' + power(so) + '</span>' + btn + '</div>'
        + '</div></div>';
    }).join('');
    this._deadSig = (s.dead || []).map((d) => d.soldier && d.soldier.id + ':' + d.reviveAt).join('|');
    const deadCards = (s.dead || []).map((d) => {
      const so = d.soldier || {};
      const left = Math.max(0, (d.reviveAt || 0) - Date.now());
      const span = Math.max(1, (d.reviveAt || 0) - (d.diedAt || 0));
      const pct = U.clamp(((Date.now() - (d.diedAt || 0)) / span) * 100, 0, 100);
      return '<div class="dead-card">' + '<span class="av">' + av(so) + '</span>'
        + '<div class="dead-meta"><b>' + esc(so.name || '阵亡士兵') + ' <span class="soldier-id">#' + esc(so.nft != null ? so.nft : so.id) + '</span></b>'
        + '<span>' + (so.clsName || '') + ' · 基地复活</span>'
        + '<div class="bar"><i style="width:' + pct.toFixed(1) + '%"></i></div></div>'
        + '<span class="dead-time" data-revive="' + d.reviveAt + '">' + U.mmss(left) + '</span></div>';
    }).join('');
    const deadSection = deadCards
      ? '<div class="sect" style="margin-top:10px"><div class="sect-h"><h3>阵亡 · 等待复活</h3><span>' + (s.dead || []).length + ' 人 · 10 分钟</span></div><div class="dead-grid">' + deadCards + '</div></div>'
      : '';
    const tabs = [
      { key: 'all', label: '全部', on: st.status === 'all' },
      { key: 'idle', label: '待命', on: st.status === 'idle' },
      { key: 'garrison', label: '驻防', on: st.status === 'garrison' },
      { key: 'marching', label: '行军', on: st.status === 'marching' },
      { key: 'listed', label: '挂牌', on: st.status === 'listed' },
    ];
    const body = '<div class="army-tools">'
      + '<div class="seg">' + tabs.map((t) => '<button class="' + (t.on ? 'on' : '') + '" data-act="army-status" data-v="' + t.key + '">' + t.label + '</button>').join('') + '</div>'
      + '<div class="seg">' + [['all', '全部'], ['m', '男'], ['f', '女']].map((g) => '<button class="' + (st.gender === g[0] ? 'on' : '') + '" data-act="army-gender" data-v="' + g[0] + '">' + g[1] + '</button>').join('') + '</div>'
      + '<div class="seg">' + [['power', '战力'], ['cap', '口袋'], ['gen', '血脉'], ['new', '新兵']].map((g) => '<button class="' + (st.sort === g[0] ? 'on' : '') + '" data-act="army-sort" data-v="' + g[0] + '">' + g[1] + '</button>').join('') + '</div>'
      + '</div>'
      + '<div class="note" style="margin-bottom:10px">' + (zoneOk ? '当前目标地块：<b>' + zone.name + '</b>。点“驻防”会把该士兵调入。' : '先在地图上选中己方地块，可把待命士兵驻防过去。') + '</div>'
      + '<div class="army-grid">' + (cards || empty('没有符合条件的士兵')) + '</div>'
      + deadSection
      + '<div class="pager" style="display:flex;align-items:center;justify-content:space-between;margin-top:16px"><span class="fine" style="margin:0">共 ' + list.length + ' 人 · 第 ' + st.page + '/' + pages + ' 页</span><span style="display:flex;gap:6px">'
      + '<button class="btn sm ghost" data-act="army-page" data-v="' + Math.max(1, st.page - 1) + '" ' + (st.page <= 1 ? 'disabled' : '') + '>上一页</button>'
      + '<button class="btn sm ghost" data-act="army-page" data-v="' + Math.min(pages, st.page + 1) + '" ' + (st.page >= pages ? 'disabled' : '') + '>下一页</button></span></div>';
    return this.shell({
      kicker: 'LEGION · 军团', title: '军团花名册', sub: '总兵力 ' + (c.totalAll != null ? c.totalAll : c.total) + ' · 在役 ' + c.total + ' · 阵亡 ' + (c.dead || 0) + ' · 驻防 ' + c.garrison + ' · 行军 ' + c.marching,
      body, wide: true,
      footer: '<div class="spacer"></div><button class="btn ghost" data-act="open-breed">婚育</button><button class="btn ghost" data-act="open-market">市场</button><button class="btn" data-act="close">关闭</button>',
    });
  },

  refreshArmyLive() {
    if (this.modalType !== 'army' || !this.modals) return;
    const s = G.state;
    if (!s) return;
    const dead = s.dead || [];
    const sig = dead.map((d) => d.soldier && d.soldier.id + ':' + d.reviveAt).join('|');
    if (this._deadSig !== sig) {
      this._deadSig = sig;
      this.openArmy();
      return;
    }
    const now = Date.now();
    this.modals.querySelectorAll('[data-revive]').forEach((el2) => {
      const at = +el2.getAttribute('data-revive') || 0;
      el2.textContent = U.mmss(Math.max(0, at - now));
    });
  },

  /* ============================================================
     BREEDING
     ============================================================ */
  openBreed() { this.openModal('breed'); },
  modal_breed() {
    const s = G.state;
    if (!s || s.phase !== 'playing') return '';
    const tab = this.tab.breed;
    const body = tab === 'nursery' ? this.breedNursery() : this.breedMatch();
    return this.shell({
      kicker: 'BLOODLINE · 血脉', title: '婚育与子嗣', sub: '结缘 → 繁衍 → 新兵。孩子可以留在军团，也可以挂牌出售。',
      body,
      tabs: [
        { key: 'match', label: '结缘', on: tab === 'match' },
        { key: 'nursery', label: '产房与家族', on: tab === 'nursery', badge: s.births.length || '' },
      ],
      wide: true,
      footer: '<div class="spacer"></div><button class="btn ghost" data-act="open-army">军团</button><button class="btn ghost" data-act="open-market">市场</button><button class="btn" data-act="close">关闭</button>',
    });
  },

  breedMatch() {
    const s = G.state;
    const male = s.soldiers.filter((x) => x.gender === 'm' && x.status === 'idle' && !x.spouse && !x.pregnant).sort((a, b) => b.tier - a.tier || power(b) - power(a)).slice(0, 50);
    const female = s.soldiers.filter((x) => x.gender === 'f' && x.status === 'idle' && !x.spouse && !x.pregnant).sort((a, b) => b.tier - a.tier || power(b) - power(a)).slice(0, 50);
    const row = (so, g) => '<button class="prow ' + ((g === 'm' ? this.breed.m : this.breed.f) === so.id ? 'on' : '') + '" data-act="breed-select" data-g="' + g + '" data-id="' + so.id + '">'
      + '<span class="pav">' + av(so) + '</span>'
      + '<span class="pn"><b>' + esc(so.name) + '</b><span>' + so.clsName + ' · ' + D.TIERS[so.tier].name + ' · 战力 ' + power(so) + '</span></span>'
      + '<span class="pp">' + so.childCount + '/' + so.fertility + '</span></button>';
    const a = this.breed.m ? G.soldier(this.breed.m) : null;
    const b = this.breed.f ? G.soldier(this.breed.f) : null;
    const chk = a && b ? G.canMarry(a, b) : { ok: false, error: '各选一名男女士兵' };
    const cost = E.marryCost;
    const blocked = !chk.ok ? chk.error : (!window.ORE_MP_CLIENT && s.player.ore < cost) ? '个人钱包不足（需 ' + cost + '）' : '';
    const childRange = (x, y) => Math.round(x + y) + '–' + Math.round((x + y) * 1.2);
    const pair = '<div class="pair-card" style="margin-top:10px">'
      + '<div class="pair-avs"><span class="pav ' + (a ? '' : 'ph') + '">' + (a ? av(a) : '♂') + '</span><i>∞</i><span class="pav ' + (b ? '' : 'ph') + '">' + (b ? av(b) : '♀') + '</span></div>'
      + '<div class="pair-names">' + (a ? esc(a.name) : '男方') + ' <span>×</span> ' + (b ? esc(b.name) : '女方') + '</div>'
      + '<div class="pair-meta">' + (a ? tierBadge(a.tier) : '') + (b ? tierBadge(b.tier) : '') + '<span class="pill">结缘 ' + cost + ' ORE</span></div>'
      + (a && b ? '<div class="pair-meta" style="justify-content:center;color:#f2ce4b">新兵 ATK ' + childRange(a.atk, b.atk) + ' · DEF ' + childRange(a.def, b.def) + ' · SPD ' + childRange(a.spd, b.spd) + ' · 口袋 0</div>' : '')
      + (a && b ? '<div class="pair-meta" style="justify-content:center;color:#9fd6ff">繁衍 ' + G.breedCost(a, b) + ' ORE/次 · 双方各自 24h 冷却</div>' : '')
      + '<p class="fine" style="text-align:center">' + (blocked ? '<span style="color:#e7b15c">' + blocked + '</span>' : '双方血缘可查，生育上限 ' + Math.min(a.fertility, b.fertility) + ' 次。') + '</p>'
      + '<button class="btn wide" data-act="breed-marry" ' + (blocked ? 'disabled' : '') + ' style="margin-top:8px">结为伴侣 · ' + cost + ' ORE</button>'
      + '</div>';
    return '<div class="note" style="margin-bottom:10px">婚姻消耗 <b>30 ORE</b>（50% 销毁 / 50% 进金库）。繁衍费用 = <b>父亲战力 + 母亲战力</b>，父母各自进入 <b>24 小时</b>冷却。孩子三维 = <b>(父亲属性 + 母亲属性) × 1.0～1.2</b>，口袋代币从 0 开始。近亲不可结缘。列表按血脉与战力推荐前 50 人。</div>'
      + '<div class="breed-cols">'
      + '<div class="pick-col"><div class="pick-h"><b>男方</b><span>' + male.length + ' 人可选</span></div><div class="pick-list">' + (male.map((x) => row(x, 'm')).join('') || empty('没有合适的男方')) + '</div></div>'
      + '<div class="pick-col"><div class="pick-h"><b>女方</b><span>' + female.length + ' 人可选</span></div><div class="pick-list">' + (female.map((x) => row(x, 'f')).join('') || empty('没有合适的女方')) + '</div></div>'
      + '</div>' + pair;
  },

  breedNursery() {
    const s = G.state;
    const nowT = Date.now();
    const preg = s.births.map((b) => '<div class="preg"><span>❍</span><b>' + esc(b.fatherName) + ' × ' + esc(b.motherName) + '</b><span class="t" data-due="' + b.dueAt + '">' + U.mmss(b.dueAt - nowT) + '</span></div>').join('');
    const seen = new Set();
    const couples = [];
    for (const so of s.soldiers) {
      if (!so.spouse || seen.has(so.id)) continue;
      const other = G.soldier(so.spouse);
      if (!other) continue;
      seen.add(so.id); seen.add(other.id);
      couples.push([so, other]);
    }
    couples.sort((x, y) => {
      const ax = x[0].pregnant || x[1].pregnant ? 1 : 0, ay = y[0].pregnant || y[1].pregnant ? 1 : 0;
      return ay - ax;
    });
    const list = couples.slice(0, 60).map(([a, b]) => {
      const f = a.gender === 'f' ? a : b, m = a.gender === 'm' ? a : b;
      const chk = G.canBreed(m, f);
      const cost = G.breedCost(m, f);
      const cd = Math.max(0, (m.cdUntil || 0) - nowT, (f.cdUntil || 0) - nowT);
      const dots = Array.from({ length: Math.max(m.fertility, f.fertility) }, (_, i) => '<i class="' + (i < Math.max(m.childCount, f.childCount) ? 'on' : '') + '"></i>').join('');
      return '<div class="couple"><div class="cp"><span class="pav">' + av(m) + '</span><span class="pav">' + av(f) + '</span>'
        + '<div><b>' + esc(m.name) + ' × ' + esc(f.name) + '</b><span>子女 ' + Math.max(m.childCount, f.childCount) + '/' + Math.min(m.fertility, f.fertility) + '</span><div class="fert">' + dots + '</div></div></div>'
        + '<div class="ca">' + (f.pregnant ? '<em>孕育中</em><button disabled>繁衍</button>' : '<button class="btn sm" data-act="breed-go" data-a="' + m.id + '" data-b="' + f.id + '" ' + (chk.ok ? '' : 'disabled title="' + chk.error + '"') + '>繁衍</button><em>' + cost + ' ORE' + (cd > 0 ? ' · 冷却 ' + U.clock(cd) : '') + '</em>') + '</div></div>';
    }).join('');
    return '<div class="sect"><div class="sect-h"><h3>孕育中</h3><span>' + s.births.length + ' 个新生命</span></div>' + (preg || empty('暂无孕育中的子嗣')) + '</div>'
      + '<div class="sect"><div class="sect-h"><h3>伴侣与家族</h3><span>' + couples.length + ' 对 · 显示前 60 对</span></div>' + (list || empty('还没有伴侣。先在“结缘”里选一男一女。')) + '</div>'
      + '<div class="note">繁衍费用 = <b>父亲战力 + 母亲战力</b>，从个人钱包支付；父母双方各自进入 <b>24 小时</b>冷却（从繁衍开始计时）。孕育 45 秒。孩子随机继承父母职业，有 16% 概率提升品阶；三维为 <b>(父 + 母) × 1.0～1.2</b>，每条属性独立随机，不设 99 上限，口袋为 0。</div>';
  },

  refreshBreedLive() {
    if (this.tab.breed !== 'nursery') return;
    this.modals.querySelectorAll('[data-due]').forEach((x) => {
      const d = +x.dataset.due - Date.now();
      x.textContent = d <= 0 ? '诞生中' : U.mmss(d);
    });
  },

  /* ============================================================
     EXTRACT
     ============================================================ */
  openExtract() {
    const s = G.state;
    if (!s || s.phase !== 'playing') return;
    const has = s.soldiers.some((x) => (x.pocket || 0) > 0.0001 && x.status !== 'marching' && x.status !== 'listed' && !x.pregnant);
    if (!has) { this.toast('没有士兵口袋里有可领取的代币', 'bad'); return; }
    this.extract.count = 1;
    this.openModal('extract');
  },
  modal_extract() {
    const s = G.state;
    if (!s || s.phase !== 'playing') return '';
    const totalPocket = s.soldiers.reduce((a, x) => a + (x.pocket || 0), 0);
    const body = '<div class="ex-hero"><span>士兵口袋待提取</span><b id="exChest">' + U.fmt(totalPocket, totalPocket < 100 ? 2 : 0) + '</b><em>ORE · 仅退伍后可领取</em></div>'
      + '<div class="ex-rate"><span class="pill gold">领取去向：直接打入钱包</span><span class="pill">退伍会永久销毁士兵</span></div>'
      + '<div class="ex-slider"><div class="ex-s-h"><b>选择退伍士兵</b><span id="exCountTxt">—</span></div>'
      + '<input type="range" id="exRange" min="1" max="1" value="1">'
      + '<div style="display:flex;gap:5px;margin-top:9px"><button class="btn sm ' + (!this.extract.includeGarrison ? '' : 'ghost') + '" data-act="extract-mode" data-v="0">只选待命</button><button class="btn sm ' + (this.extract.includeGarrison ? '' : 'ghost') + '" data-act="extract-mode" data-v="1">含驻防</button><span class="spacer"></span><span class="fine" id="exWarn" style="margin:0"></span></div></div>'
      + '<div class="ex-pool"><div><span>可领取</span><b class="g" id="exGet">0</b></div><div><span>退伍人数</span><b id="exBurn">0</b></div><div><span>剩余口袋</span><b id="exRest">0</b></div></div>'
      + '<div class="ex-list" id="exList"></div>'
      + '<div class="note gold" style="margin-top:10px">士兵口袋里的代币只有在该士兵被销毁后才能领取。领取后会进入<b>个人钱包</b>，但该士兵永久消失，地块驻军和战力同步下降。<b>链上 NFT 士兵会先弹钱包：只对「士兵 NFT 合约」这一个地址授权一次（setApprovalForAll），之后任意数量的士兵都可一笔 OreBurner.burnBatch 批量销毁。<br><span style="opacity:.85">作用域说明：授权记录保存在士兵合约内部，<b>只覆盖士兵这一个系列</b>，其他 NFT 系列（任何别的合约地址）完全不受影响，dev 也无法借此动它们。烧完可随时在下方点「撤销士兵授权」收回。</span></b> 销毁确认后，游戏签名服务会调用 <b>OreMinePool.release</b> 把 ORE <b>直接打进你的钱包地址</b>，不再进入游戏内记账；个人钱包显示的金额就是链上 ORE 余额。销毁 Tx 与打币 Tx 都会显示在个人钱包下方。</div>';
    return this.shell({
      kicker: 'RETIRE · 烧兵领取', title: '把口袋代币转入个人钱包', sub: '士兵是战力，也是代币口袋；销毁才能提现。',
      body, wide: false,
      footer: '<div class="spacer"></div><button class="btn ghost" data-act="close">取消</button><button class="btn" data-act="extract-go" id="exGo">确认退伍并领取</button>',
    });
  },
  currentExtract() {
    const cand = G.extractionCandidates()
      .filter((x) => (this.extract.includeGarrison || x.so.status === 'idle') && x.cap > 0.0001)
      .sort((a, b) => b.cap - a.cap);
    const max = Math.max(1, cand.length);
    let n = U.clamp(this.extract.count || 1, 1, max);
    const pick = cand.slice(0, n);
    const total = pick.reduce((a, x) => a + x.cap, 0);
    return { ids: pick.map((x) => x.so.id), total, amount: total, wasted: 0, n, cand: pick };
  },
  refreshExtract() {
    const s = G.state;
    const r = this.modals.querySelector('#exRange');
    if (!r) return;
    if (this.extract.count) this.extract.count = +r.value;
    const candAll = G.extractionCandidates().filter((x) => (this.extract.includeGarrison || x.so.status === 'idle') && x.cap > 0.0001);
    const set = this.currentExtract();
    if (+r.max !== Math.max(1, candAll.length)) r.max = Math.max(1, candAll.length);
    r.value = set.n;
    this.extract.count = set.n;
    const q = (id) => this.modals.querySelector(id);
    const allPocket = s.soldiers.reduce((a, x) => a + (x.pocket || 0), 0);
    if (q('#exChest')) q('#exChest').textContent = U.fmt(allPocket, allPocket < 100 ? 2 : 0);
    if (q('#exCountTxt')) q('#exCountTxt').textContent = set.n + ' / ' + candAll.length + ' 人';
    if (q('#exGet')) q('#exGet').textContent = U.fmt(set.amount, set.amount < 100 ? 2 : 0);
    if (q('#exBurn')) q('#exBurn').textContent = set.n;
    if (q('#exRest')) q('#exRest').textContent = U.fmt(Math.max(0, allPocket - set.amount), set.amount < 100 ? 2 : 0);
    if (q('#exWarn')) q('#exWarn').textContent = '销毁后不可恢复';
    if (q('#exList')) q('#exList').innerHTML = set.cand.slice(0, 20).map((x) => '<span class="ex-chip"><i></i>' + esc(x.so.name) + (x.so.nft ? ' · NFT#' + x.so.nft : '') + ' · +' + U.fmt(x.cap, x.cap < 100 ? 2 : 0) + '</span>').join('') + (set.cand.length > 20 ? '<span class="ex-chip">+' + (set.cand.length - 20) + '</span>' : '');
    if (q('#exGo')) q('#exGo').disabled = set.amount < 0.0001;
  },

  refreshExtractLive() { if (this.modals.querySelector('#exRange')) this.refreshExtract(); },

  /* ============================================================
     MARKET
     ============================================================ */
  openMarket(tab) {
    if (tab) this.tab.market = tab;
    this.openModal('market');
  },
  modal_market() {
    const s = G.state;
    if (!s || s.phase !== 'playing') return '';
    const tab = this.tab.market;
    const body = tab === 'swap' ? this.marketSwap() : tab === 'lp' ? this.marketLp() : this.marketSoldiers();
    return this.shell({
      kicker: 'MARKET · 黑市', title: '士兵、ORE 与流动性', sub: '子嗣可以卖给其他指挥官。每笔成交的 ' + (s.params.fee * 100).toFixed(1) + '% 手续费，40% 注入流动性、30% 回购销毁、30% 进金库。',
      body,
      tabs: [
        { key: 'soldiers', label: '士兵市场', on: tab === 'soldiers' },
        { key: 'swap', label: 'ORE 兑换', on: tab === 'swap' },
        { key: 'lp', label: '流动性', on: tab === 'lp' },
      ],
      wide: true,
      footer: '<div class="spacer"></div><button class="btn ghost" data-act="open-army">军团</button><button class="btn ghost" data-act="open-economy">经济仪表盘</button><button class="btn" data-act="close">关闭</button>',
    });
  },

  marketSoldiers() {
    const s = G.state;
    const mine = s.market.listings.filter((l) => l.seller === 'player');
    const npc = s.market.listings.filter((l) => l.seller === 'npc');
    const idle = s.soldiers.filter((x) => x.status === 'idle' && !x.spouse && !x.pregnant);
    const my = mine.map((l) => {
      const so = G.soldier(l.soldierId);
      return '<div class="my-listing"><span class="pav">' + (so ? av(so) : '') + '</span><div><b>' + (so ? esc(so.name) : '已售') + '</b><span>' + (so ? '战力 ' + power(so) : '') + ' · 到期 ' + U.mmss(l.expiresAt - Date.now()) + '</span></div><span class="ml-p">' + U.fmtEth(l.price) + ' Ξ</span><button data-act="market-cancel" data-id="' + l.id + '">下架</button></div>';
    }).join('');
    const opts = idle.slice(0, 300).map((so) => '<option value="' + so.id + '">' + esc(so.name) + ' · ' + D.TIERS[so.tier].name + ' · 战力 ' + power(so) + '</option>').join('');
    const defaultId = this.market.listId || (idle[0] && idle[0].id);
    const def = defaultId ? G.soldier(defaultId) : null;
    const fair = def ? G.fairValue(def) : 0.02;
    const cards = npc.map((l) => {
      const so = l.soldier;
      const ratio = l.price / Math.max(0.0001, l.fair);
      const tag = ratio < 0.9 ? '<span class="pill good">低于估价</span>' : ratio > 1.12 ? '<span class="pill bad">溢价</span>' : '<span class="pill">合理</span>';
      return '<div class="lcard"><span class="pav">' + av(so) + '</span><div class="lc-b"><b>' + esc(so.name) + '</b><span>' + so.clsName + ' · ' + D.TIERS[so.tier].name + ' · 第' + (so.gen || 0) + '代</span><span>战力 ' + Math.round(EC.soldierPower(so, so.clan)) + ' · 口袋 ' + U.fmt(so.pocket || 0, 2) + '</span>'
        + '<div class="lc-f"><span class="lc-price">' + U.fmtEth(l.price) + ' <em>ETH</em></span><button data-act="market-buy" data-id="' + l.id + '" ' + (s.player.eth < l.price ? 'disabled' : '') + '>买入</button></div>'
        + '<div style="margin-top:4px">' + tag + '</div></div></div>';
    }).join('');
    return '<div class="mkt-top">'
      + '<div class="mkt-kpi"><span>ORE 价格</span><b>' + U.fmtEth(EC.price(s)) + ' Ξ</b></div>'
      + '<div class="mkt-kpi"><span>流动性池</span><b>' + U.fmt(s.econ.poolEth, 2) + ' Ξ</b></div>'
      + '<div class="mkt-kpi"><span>手续费累计</span><b>' + U.fmtEth(s.econ.fees.total) + ' Ξ</b></div>'
      + '<div class="mkt-kpi"><span>成交士兵</span><b>' + (s.stats.sold + s.stats.bought) + ' 人</b></div></div>'
      + '<div class="sect"><div class="sect-h"><h3>我的挂牌</h3><span>' + mine.length + ' / 4</span></div>' + (my || empty('没有挂牌。挑一名待命士兵，挂个价。')) + '</div>'
      + '<div class="sect"><div class="sect-h"><h3>挂牌出售</h3><span>成交后 ' + (s.params.fee * 100).toFixed(1) + '% 手续费自动路由</span></div>'
      + '<div class="grid-2" style="align-items:end"><div class="field"><label>选择士兵（仅待命 / 未婚）</label><select class="search" id="listSoldier">' + (opts || '<option value="">没有可挂牌士兵</option>') + '</select></div>'
      + '<div class="field"><label>标价（ETH）· 估价 ' + (def ? U.fmtEth(G.fairValue(def)) : '—') + '</label><div style="display:flex;gap:5px"><input id="listPrice" type="number" step="0.0001" min="0.001" value="' + (fair).toFixed(4) + '"><button class="btn sm ghost" data-act="market-price-fair">估价</button><button class="btn sm" data-act="market-list-go" ' + (idle.length ? '' : 'disabled') + '>挂牌</button></div></div></div>'
      + '<p class="fine" id="listQuote">手续费 ' + U.fmtEth(fair * s.params.fee) + ' Ξ · 到手 ' + U.fmtEth(fair * (1 - s.params.fee)) + ' Ξ</p>'
      + '<div class="note" style="margin-top:8px">定价越接近估价，越快成交。买家是其他指挥官；成交后手续费会即时改变池子与 ORE 价格。</div></div>'
      + '<div class="sect"><div class="sect-h"><h3>市场在售</h3><span>' + npc.length + ' 个挂牌 · 其他指挥官的血脉</span></div><div class="listing-grid">' + (cards || empty('市场暂时没有挂牌')) + '</div></div>';
  },

  updateListQuote() {
    const s = G.state;
    const sel = this.modals.querySelector('#listSoldier');
    const price = parseFloat((this.modals.querySelector('#listPrice') || {}).value || '0');
    if (!sel || !price) return;
    const so = G.soldier(sel.value);
    if (!so) return;
    const fee = price * s.params.fee;
    const note = this.modals.querySelector('#listQuote');
    if (note) note.innerHTML = '手续费 <b>' + U.fmtEth(fee) + ' Ξ</b> · 到手 <b>' + U.fmtEth(price - fee) + ' Ξ</b>';
  },

  marketSwap() {
    const s = G.state;
    const dir = this.market.swapDir;
    const amt = parseFloat(this.market.amt || '0') || 0;
    const q = dir === 'sell' ? EC.quoteSell(s, Math.min(amt, s.player.ore)) : EC.quoteBuy(s, Math.min(amt, s.player.eth));
    const out = dir === 'sell' ? U.fmt(q.ethOut, 4) + ' ETH' : U.fmt(q.oreOut, 0) + ' ORE';
    return '<div class="pool-stat"><div><span>池内 ORE</span><b>' + U.fmt(s.econ.poolOre) + '</b></div><div><span>池内 ETH</span><b>' + U.fmt(s.econ.poolEth, 2) + '</b></div><div><span>现价</span><b>' + U.fmtEth(EC.price(s)) + '</b></div><div><span>累计成交</span><b>' + U.fmt(s.econ.volumeEth, 2) + ' Ξ</b></div></div>'
      + '<div class="swap-tabs"><button class="' + (dir === 'sell' ? 'on' : '') + '" data-act="market-swap-dir" data-v="sell">卖出 ORE</button><button class="' + (dir === 'buy' ? 'on' : '') + '" data-act="market-swap-dir" data-v="buy">买入 ORE</button></div>'
      + '<div class="swap-box"><div class="swap-in"><div class="swap-l"><span>' + (dir === 'sell' ? '支付 ORE' : '支付 ETH') + '</span><span>余额 ' + (dir === 'sell' ? U.fmt(s.player.ore, 1) + ' ORE' : U.fmtEth(s.player.eth) + ' ETH') + '</span></div>'
      + '<div class="swap-row"><input id="swapAmt" inputmode="decimal" placeholder="0.0" value="' + (this.market.amt || '') + '"><span class="swap-tok">' + (dir === 'sell' ? '<i class="zn"></i>ORE' : '<i class="eth-ico" style="color:#b9a7ff">Ξ</i>ETH') + '</span></div>'
      + '</div>'
      + '<div class="swap-mid"><button data-act="market-swap-max" title="最大">↕</button></div>'
      + '<div class="swap-in"><div class="swap-l"><span>获得 <b id="swapOut">' + out + '</b></span><span>1% 兑换费留在池中</span></div><div class="swap-row"><input id="swapRecv" disabled placeholder="0.0" value="' + (dir === 'sell' ? q.ethOut.toFixed(4) : Math.round(q.oreOut)) + '"><span class="swap-tok">' + (dir === 'sell' ? 'ETH' : 'ORE') + '</span></div></div>'
      + '<div class="swap-meta"><span>价格影响 <b id="swapImpact">' + (q.impact * 100).toFixed(2) + '%</b></span><span>新价格 <b>' + U.fmtEth(q.newPrice) + '</b></span></div>'
      + '<button class="btn" data-act="market-swap">' + (dir === 'sell' ? '卖出 ORE' : '买入 ORE') + '</button></div>'
      + '<div class="grid-2" style="margin-top:10px">'
      + '<div class="spark-wrap"><div class="spark-l"><span>ORE / ETH · 最近</span><b>' + U.fmtEth(EC.price(s)) + '</b></div>' + sparkline(s.econ.priceHist, 'p', '#fec23e') + '</div>'
      + '<div class="note gold"><b>手续费怎么走</b><br>1% 兑换费 → 全部留在 LP，抬高 k 值。<br>6% 市场费 → 40% 买 ORE 加池，30% 回购销毁，30% 进金库。<br>卖矿的人越多，池子越深；交易越多，LP 越值钱。</div></div>';
  },

  updateSwapQuote() {
    const s = G.state;
    const amt = parseFloat(this.market.amt || '0') || 0;
    const dir = this.market.swapDir;
    const q = dir === 'sell' ? EC.quoteSell(s, Math.min(amt, s.player.ore)) : EC.quoteBuy(s, Math.min(amt, s.player.eth));
    const out = this.modals.querySelector('#swapOut');
    if (out) out.textContent = dir === 'sell' ? U.fmt(q.ethOut, 4) + ' ETH' : U.fmt(q.oreOut, 0) + ' ORE';
    const recv = this.modals.querySelector('#swapRecv');
    if (recv) recv.value = dir === 'sell' ? q.ethOut.toFixed(4) : Math.round(q.oreOut);
    const im = this.modals.querySelector('#swapImpact');
    if (im) im.textContent = (q.impact * 100).toFixed(2) + '%';
  },
  refreshSwapLive() { if (this.modals.querySelector('#swapAmt')) this.updateSwapQuote(); },

  doSwap() {
    const s = G.state;
    const amt = parseFloat(this.market.amt || '0') || 0;
    const r = this.market.swapDir === 'sell' ? G.swapSell(amt) : G.swapBuy(amt);
    if (!r.ok) this.toast(r.error, 'bad');
    else { this.toast(this.market.swapDir === 'sell' ? '卖出完成' : '买入完成', 'good'); this.market.amt = ''; this.openModal('market'); }
  },

  marketLp() {
    const s = G.state;
    const p = EC.price(s);
    const ethNeed = (parseFloat((this.modals.querySelector('#lpOre') || {}).value || '0') || 0) * p;
    return '<div class="pool-stat"><div><span>池内 ORE</span><b>' + U.fmt(s.econ.poolOre) + '</b></div><div><span>池内 ETH</span><b>' + U.fmt(s.econ.poolEth, 2) + '</b></div><div><span>你的 LP</span><b>' + (s.player.lp ? pct(s.player.lp / s.econ.lpTotal) : '0%') + '</b></div><div><span>LP 价值</span><b>' + U.fmtEth(EC.lpValueEth(s)) + ' Ξ</b></div></div>'
      + '<div class="grid-2">'
      + '<div><div class="sect-h"><h3>注入流动性</h3><span>按当前价格 1:1 配对</span></div>'
      + '<div class="field"><label>ORE 数量</label><input id="lpOre" type="number" min="0" step="10" placeholder="0"></div>'
      + '<p class="fine" id="lpNeed">需要 ETH：0.0000 · 余额 ' + U.fmtEth(s.player.eth) + '</p>'
      + '<button class="btn wide" data-act="market-lp-add">注入 LP</button>'
      + '<p class="fine">LP 会持续赚取 1% 兑换费。池子越深，大额卖矿的滑点越小。</p></div>'
      + '<div><div class="sect-h"><h3>撤出流动性</h3><span>取回 ORE + ETH</span></div>'
      + '<div class="note">你的份额 <b>' + (s.econ.lpTotal ? pct(s.player.lp / s.econ.lpTotal) : '0%') + '</b> · 价值 <b>' + U.fmtEth(EC.lpValueEth(s)) + ' ETH</b><br>协议自有流动性 POL：<b>' + U.fmtEth(EC.polValueEth(s)) + ' ETH</b></div>'
      + '<div style="display:flex;gap:5px;margin-top:9px">' + [25, 50, 75, 100].map((x) => '<button class="btn sm ghost" data-act="market-lp-remove" data-v="' + x + '" ' + (s.player.lp <= 0 ? 'disabled' : '') + '>' + x + '%</button>').join('') + '</div>'
      + '<div class="note gold" style="margin-top:10px"><b>POL 从哪来</b><br>市场手续费的 40% 由协议配上金库 ORE，永久注入池子。交易越活跃，池子越深，价格越稳。</div></div>'
      + '</div>'
      + '<div class="sect" style="margin-top:14px"><div class="sect-h"><h3>手续费与深度</h3><span>LP 累计费 ' + U.fmtEth(s.econ.fees.lp) + ' Ξ</span></div>'
      + '<div class="bars"><div class="bl"><span>池深 ETH</span>' + bar(U.clamp(s.econ.poolEth / 160, 0, 1), '#5ba8ff') + '<b>' + U.fmt(s.econ.poolEth, 1) + ' Ξ</b></div>'
      + '<div class="bl"><span>协议 POL</span>' + bar(U.clamp(EC.polValueEth(s) / 160, 0, 1), '#fec23e') + '<b>' + U.fmt(EC.polValueEth(s), 1) + ' Ξ</b></div>'
      + '<div class="bl"><span>回购销毁</span>' + bar(U.clamp(s.econ.fees.burnedOre / 12000, 0, 1), '#ff5b45') + '<b>' + U.fmt(s.econ.fees.burnedOre, 0) + '</b></div></div></div>';
  },
  updateLpQuote() {
    const s = G.state;
    const v = parseFloat((this.modals.querySelector('#lpOre') || {}).value || '0') || 0;
    const n = this.modals.querySelector('#lpNeed');
    if (n) n.textContent = '需要 ETH：' + U.fmtEth(v * EC.price(s)) + ' · 余额 ' + U.fmtEth(s.player.eth);
  },

  /* ============================================================
     ECONOMY
     ============================================================ */
  openEconomy() { this.openModal('economy'); },
  modal_economy() {
    const s = G.state;
    if (!s || s.phase !== 'playing') return '';
    const tab = this.tab.eco;
    const body = tab === 'params' ? this.ecoParams() : this.ecoDash();
    return this.shell({
      kicker: 'TOKENOMICS · 经济', title: 'ORE 经济仪表盘', sub: '排放 → 金库 → 烧兵 → 流通。所有数字都是本地实时模拟，不涉及真实资产。',
      body,
      tabs: [{ key: 'dash', label: '仪表盘', on: tab === 'dash' }, { key: 'params', label: '经济调参', on: tab === 'params' }],
      wide: true,
      footer: '<div class="spacer"></div><button class="btn ghost" data-act="open-market">市场</button><button class="btn ghost" data-act="open-help">设计说明</button><button class="btn" data-act="close">关闭</button>',
    });
  },

  ecoDash() {
    const s = G.state;
    const m = EC.metrics(s);
    const f = s.econ.flow;
    const maxFlow = Math.max(1, f.minted, f.extracted, f.burnedOre, f.lpAddedEth * 3000);
    const extractedOnly = Math.max(0, f.extracted - (f.looted || 0));
    const extractedRatio = extractedOnly / Math.max(1, f.minted);
    const burnRatio = f.burnedOre / Math.max(1, f.minted);
    const health = (m.minePool <= 0.01) ? { cls: 'bad', t: '矿池已枯竭：不再有新的挖矿产出。' }
      : extractedRatio < 0.25 ? { cls: '', t: '大部分代币仍在士兵口袋和地块金库；烧兵才会把口袋转入个人钱包。' }
      : burnRatio > 0.45 ? { cls: 'bad', t: '销毁比例偏高。留意繁殖成本与士兵净减少速度。' }
      : { cls: 'good', t: '循环在转：排放被提取，部分被销毁/锁进 LP，士兵在战斗与繁衍间流动。' };
    const pos = s.zones.filter((z) => z.owner === s.clan && z.kind === 'mine');
    const bases = s.zones.filter((z) => z.owner === s.clan && z.kind === 'base').length;
    return '<div class="eco-kpis">'
      + '<div class="eco-kpi"><span>ORE 总发行</span><b>' + U.fmtCompact(m.totalSupply) + '</b><em>已产出 ' + U.fmtCompact(m.supply) + ' · 销毁 ' + U.fmtCompact(m.burned) + '</em></div>'
      + '<div class="eco-kpi"><span>ORE 价格</span><b>' + U.fmtEth(m.price) + ' Ξ</b><em>池深 ' + U.fmt(m.lpEth, 1) + ' ETH</em></div>'
      + '<div class="eco-kpi"><span>全局矿池剩余</span><b>' + U.fmtCompact(m.minePool) + '</b><em>初始 ' + U.fmtCompact(m.minePoolInitial) + ' · 每日产出1%</em></div>'
      + '<div class="eco-kpi"><span>今日矿池预算</span><b>' + U.fmtCompact(m.dayBudget) + '</b><em>你的份额 ' + m.playerRate.toFixed(2) + '/分</em></div>'
      + '<div class="eco-kpi"><span>你的口袋/金库</span><b>' + U.fmtCompact(m.playerPocket) + '</b><em>个人钱包 ' + U.fmtCompact(m.playerVault) + ' ORE</em></div>'
      + '<div class="eco-kpi"><span>你的士兵</span><b>' + m.alive + '</b><em>待命 ' + G.counts().idle + ' · 驻防 ' + G.counts().garrison + '</em></div></div>'
      + '<div class="sect"><div class="sect-h"><h3>价值闭环</h3><span>先锁后放 · 烧兵即出水</span></div>'
      + '<div class="flow">'
      + '<div class="flow-node gold"><span>01 · 矿池剩余</span><b>' + U.fmtCompact(m.minePool) + ' / ' + U.fmtCompact(m.minePoolInitial) + '</b><em>每日产出=剩余矿池的1%</em></div><div class="flow-arrow">→</div>'
      + '<div class="flow-node"><span>02 · 地块产出</span><b>80% 口袋 / 20% 地块金库</b><em>口袋按驻军战力分配</em></div><div class="flow-arrow">→</div>'
      + '<div class="flow-node red"><span>03 · 销毁提取</span><b>' + U.fmtCompact(m.playerPocket) + ' 口袋</b><em>退伍后转入个人钱包</em></div>'
      + '</div>'
      + '<div class="flow" style="margin-top:5px">'
      + '<div class="flow-node blue"><span>04 · 个人钱包 / LP</span><b>' + U.fmtCompact(s.player.ore) + ' 金库 + ' + U.fmtCompact(s.econ.poolOre) + ' 池</b><em>卖矿、买矿、加 LP</em></div><div class="flow-arrow">→</div>'
      + '<div class="flow-node"><span>05 · 消耗</span><b>繁殖 / 筑防 / 手续费</b><em>70% 繁殖费销毁，市场费 40/30/30</em></div><div class="flow-arrow">→</div>'
      + '<div class="flow-node gold"><span>06 · 回流流动性</span><b>' + U.fmtEth(EC.polValueEth(s)) + ' Ξ POL 价值</b><em>手续费买回 ORE 加池 + 销毁</em></div>'
      + '</div>'
      + '<div class="grid-3" style="margin-top:8px">'
      + '<div class="mkt-kpi"><span>40% · 流动性</span><b>' + U.fmtEth(s.econ.fees.lp) + ' Ξ</b><em>已配对注入 POL</em></div>'
      + '<div class="mkt-kpi"><span>30% · 回购销毁</span><b>' + U.fmt(s.econ.fees.burnedOre, 0) + ' ORE</b><em>累计销毁</em></div>'
      + '<div class="mkt-kpi"><span>30% · 项目金库</span><b>' + U.fmtEth(s.econ.fees.treasury) + ' Ξ</b><em>金库总 ' + U.fmtEth(m.treasuryEth) + ' Ξ</em></div>'
      + '</div></div>'
      + '<div class="grid-2"><div class="sect"><div class="sect-h"><h3>今日流量</h3><span>本局累计</span></div><div class="bars">'
      + '<div class="bl"><span>矿池产出</span>' + bar(f.minted / maxFlow, '#fec23e') + '<b>' + U.fmtCompact(f.minted) + '</b></div>'
      + '<div class="bl"><span>口袋提取</span>' + bar((f.extracted - (f.looted || 0)) / maxFlow, '#3ddc84') + '<b>' + U.fmtCompact(f.extracted - (f.looted || 0)) + '</b></div>'
      + '<div class="bl"><span>ORE 销毁</span>' + bar(f.burnedOre / maxFlow, '#ff5b45') + '<b>' + U.fmtCompact(f.burnedOre) + '</b></div>'
      + '<div class="bl"><span>LP 注入</span>' + bar((f.lpAddedEth * 2800) / maxFlow, '#5ba8ff') + '<b>' + U.fmtEth(f.lpAddedEth) + 'Ξ</b></div>'
      + '</div><div class="note ' + health.cls + '" style="margin-top:9px">' + health.t + '</div></div>'
      + '<div class="sect"><div class="sect-h"><h3>价格 · 供应</h3><span>每 10 秒采样</span></div>'
      + '<div class="spark-wrap"><div class="spark-l"><span>ORE / ETH</span><b>' + U.fmtEth(m.price) + '</b></div>' + sparkline(s.econ.priceHist, 'p', '#fec23e') + '</div>'
      + '<div class="spark-wrap" style="margin-top:6px"><div class="spark-l"><span>流通供应</span><b>' + U.fmtCompact(m.supply) + '</b></div>' + sparkline(s.econ.priceHist, 's', '#5ba8ff') + '</div></div></div>'
      + '<div class="note gold"><b>关键比例</b> · 口袋提取/产出 <b>' + (extractedRatio * 100).toFixed(0) + '%</b> · 销毁/产出 <b>' + (burnRatio * 100).toFixed(0) + '%</b> · 手续费进 LP <b>' + U.fmtEth(f.lpAddedEth) + ' ETH</b>。<br>口袋提取越高，进入个人钱包的代币越多；否则代币留在士兵口袋与地块金库。</div>';
  },

  ecoParams() {
    const s = G.state;
    const p = s.params;
    const row = (k, label, min, max, step, fmt) => '<div class="slider-row"><label>' + label + '</label><input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + p[k] + '" data-param="' + k + '"><output data-out="' + k + '">' + fmt(p[k]) + '</output></div>';
    return '<div class="note">调参即时生效，并写入存档。矿池每日 1% 与 80/20 分配是固定规则；这里调整市场费率；繁衍费用固定为父母战力总和。<b>单机沙盘</b>，不影响任何链上资产。</div>'
      + '<div class="sect" style="margin-top:14px"><div class="sect-h"><h3>全局参数</h3><span>默认值见括号</span></div><div class="sliders">'
      + row('fee', '市场费率', 0.02, 0.12, 0.005, (v) => (v * 100).toFixed(1) + '%')
      + '</div><div class="grid-3" style="margin-top:10px">'
      + '<div class="mkt-kpi"><span>每日产出</span><b>剩余矿池 × 1%</b><em style="font-style:normal;color:var(--dim);font-size:8.5px">当前 ' + U.fmtCompact(s.econ.dayBudget) + '</em></div>'
      + '<div class="mkt-kpi"><span>矿池剩余</span><b>' + U.fmtCompact(s.econ.minePool) + '</b><em style="font-style:normal;color:var(--dim);font-size:8.5px">每日产出 1%</em></div>'
      + '<div class="mkt-kpi"><span>士兵口袋</span><b>' + U.fmtCompact(s.soldiers.reduce((a, x) => a + (x.pocket || 0), 0)) + '</b><em style="font-style:normal;color:var(--dim);font-size:8.5px">烧兵领取</em></div>'
      + '</div><div style="display:flex;gap:6px;margin-top:10px"><button class="btn sm ghost" data-act="eco-reset">恢复默认</button><span class="fine" id="feeHint" style="margin:0">市场费 40% 进 LP / 30% 回购销毁 / 30% 金库</span></div></div>'
      + '<div class="sect"><div class="sect-h"><h3>为什么这样设计</h3><span>避免死亡螺旋</span></div><div class="legend-note">'
      + '<div><b>① 矿池递减。</b>每天只发剩余矿池的 1%，越挖越慢。</div>'
      + '<div><b>② 代币先进口袋。</b>80% 按战力分给驻军，20% 留在地块金库。</div>'
      + '<div><b>③ 不销毁不能提。</b>士兵口袋代币必须退伍销毁后才能进个人钱包。</div>'
      + '<div><b>④ 金库随战争易手。</b>攻方胜利后拿走 20% 地块金库，按战力分给参战士兵。</div>'
      + '<div><b>⑤ 繁殖是 ORE sink。</b>70% 繁殖费直接销毁。</div>'
      + '<div><b>⑥ 手续费喂流动性。</b>40% 市场费 + 金库 ORE 变 POL，30% 回购销毁。</div>'
      + '</div></div>';
  },

  updateFeeHint(v) {
    const n = this.modals.querySelector('#feeHint');
    if (n) n.textContent = '市场费 ' + (v * 100).toFixed(1) + '% · 40% 进 LP / 30% 回购销毁 / 30% 金库';
  },

  refreshMarketLive() {
    if (this.modalType === 'market' && this.tab.market === 'soldiers') this.openModal('market');
  },

  refreshEcoLive() {
    if (this.tab.eco !== 'dash') return;
    // keep total issuance fixed; update the issued/burned line under it
    const s = G.state;
    const m = EC.metrics(s);
    const em = this.modals.querySelector('.eco-kpis .eco-kpi:first-child em');
    if (em) em.textContent = '已产出 ' + U.fmtCompact(m.supply) + ' · 销毁 ' + U.fmtCompact(m.burned);
    const pool = this.modals.querySelector('.eco-kpis .eco-kpi:nth-child(3) b');
    if (pool) pool.textContent = U.fmtCompact(m.minePool);
  },

  /* ============================================================
     HELP / SETTINGS / ONBOARD / GARRISON / LIST
     ============================================================ */
  openHelp() { this.openModal('help'); },
  modal_help() {
    const tab = this.tab.help;
    const body = tab === 'econ' ? this.helpEcon() : tab === 'units' ? this.helpUnits() : this.helpPlay();
    return this.shell({
      kicker: 'FIELD MANUAL · 作战手册', title: '矿域：60 秒上手', sub: '三个势力、链上 NFT 军团、一个每分钟都在产矿的战场。',
      body,
      tabs: [{ key: 'play', label: '玩法', on: tab === 'play' }, { key: 'econ', label: '经济设计', on: tab === 'econ' }, { key: 'units', label: '兵种', on: tab === 'units' }],
      wide: true,
      footer: '<div class="spacer"></div><button class="btn ghost" data-act="open-settings">设置 / 存档</button><button class="btn" data-act="close">知道了</button>',
    });
  },
  helpPlay() {
    return '<div class="rule-list">'
      + '<div class="rule"><span class="rule-i">01</span><div><b>矿池每天产出 1%</b><p>代币总量 100,000,000，其中 80,000,000 是游戏矿池。每天产出“当前剩余矿池”的 1%，按地块权重分配；离自己基地越远，地块产出越高。地块产出的 <b>80% 按战力进入驻军士兵口袋</b>，<b>20% 进入地块金库</b>。</p></div></div>'
      + '<div class="rule"><span class="rule-i">02</span><div><b>口袋必须烧兵领取</b><p>士兵攻击力栏新增“口袋”代币数量。只有销毁该士兵，口袋里的代币才会转入你的个人钱包；士兵越强，分到的口袋代币越多。</p></div></div>'
      + '<div class="rule"><span class="rule-i">03</span><div><b>结缘、繁衍、卖子嗣</b><p>一男一女结为伴侣，消耗 ORE 繁衍新兵。孩子三维 = <b>(父亲属性 + 母亲属性) × 1.0～1.2</b>，每条属性独立随机，口袋代币从 0 开始，不设 99 上限。孩子可以留在军团，也可以挂牌卖给其他指挥官，成交收 6% 手续费。</p></div></div>'
      + '<div class="rule"><span class="rule-i">04</span><div><b>占领 = 抢地块金库</b><p>从相邻己方地块出兵。胜利后占领地块，并夺取该地块金库（地块产出的 20% 累积），按战力分给参战士兵的口袋。驻军越多、筑防越高，越难被抢。</p></div></div>'
      + '<div class="rule"><span class="rule-i">05</span><div><b>手续费喂流动性</b><p>市场手续费的 40% 与金库 ORE 配对成协议流动性（POL），30% 回购 ORE 并销毁，30% 进金库。你也可以自己注入 LP 赚 1% 兑换费。</p></div></div>'
      + '</div>'
      + '<div class="note gold" style="margin-top:12px"><b>地图结构</b> · 球面被 240 个领地铺满。三座 <b>基地</b>（南极王国/森林王国/沙漠王国）在球面上互相等距，基地本身<b>不可被攻击</b>；基地地块颜色会加深，并显示加高的 3D 石墙、塔楼与阵营旗。每族以自家基地为正中心：<b>基地中心产矿最低，离基地越远产矿越高</b>。己方驻军所在城市显示一个花名册头像 + 阵营旗 + 驻军 ATK 总攻击力（每地块最多 1 个头像），并每秒挥动锄头、飘出 +每秒 ORE 数值；缩放后显示地块名与当前产出。部队抵达后进入 30 秒攻城战：城墙内按实际驻军兵种显示，城外按实际攻方兵种显示，倒计时结束才结算。红/绿/蓝重装骑士图标会随军队沿球面移动；路径、速度和剩余时间会显示在行军队列旁。交战格显示交叉双剑 + 炸弹。</div>'
      + '<div class="note bad" style="margin-top:10px"><b>阵亡不是自动退伍</b>：驻军被 AI 攻破、攻城失败、守城失败时会<b>阵亡</b>，10 分钟后在基地复活并编入基地驻军；这是战斗损失，不是系统自动退伍。只有你手动点击「烧兵提取」才会永久销毁士兵并把口袋代币转入个人钱包。</div>'
      + '<div class="help-h"><i></i><h3>开局建议</h3><i></i></div>'
      + '<div class="note gold">先在 <b>军团</b> 里给 2–3 个前线地块调防，防 AI 偷家；再攒个人钱包结缘、繁衍；士兵口袋有代币后，用“烧兵领取”把口袋转入个人钱包。市场里价格接近“估价”的士兵最容易成交。</div>'
      + '<div class="help-h"><i></i><h3>操作</h3><i></i></div>'
      + '<div class="legend-note"><div><b>点击地块</b> 查看产出、防御、驻军与战况。</div><div><b>拖拽 / 滚轮</b> 平移与缩放地图。</div><div><b>战报</b> 点击带地块的战报可直接定位。</div><div><b>Esc</b> 关闭弹窗 / 取消选中。</div></div>';
  },
  helpUnits() {
    const meta = {
      guard: ['盾卫', '前排 · 举盾吸收 · 稳守城墙'],
      vanguard: ['先锋', '突进 · 长枪 · 撕开缺口'],
      archer: ['弓手', '远程 · 拉弓 · 箭雨压制'],
      warlock: ['术士', '法术 · 法杖 · 魔法弹'],
      raider: ['游骑', '高速 · 骑射 · 侧翼骚扰'],
    };
    const order = ['guard', 'vanguard', 'archer', 'warlock', 'raider'];
    const cards = order.map((key) => {
      const m = meta[key];
      return '<div style="background:#0b0b09;border:1px solid #27251f;border-radius:8px;padding:8px 9px"><b style="font:800 13px/1.2 var(--display);color:#f2ce4b">' + m[0] + '</b><p class="fine" style="margin:4px 0 0;line-height:1.4">' + m[1] + '</p></div>';
    }).join('');
    return '<div class="note">五名卡通兵种已加入攻城战：<b>盾卫 / 先锋 / 弓手 / 术士 / 游骑</b>。攻城时会按双方<b>实际拥有的兵种</b>显示：城内有什么兵种就出现什么，攻方有什么兵种就出现什么；AI 编成会模拟生成。</div>'
      + '<canvas id="unitShowcase" width="1040" height="278" style="width:100%;height:278px;display:block;margin-top:10px;border:1px solid #2a2720;border-radius:10px;background:#0a0b09"></canvas>'
      + '<div class="units-grid" style="margin-top:8px">' + cards + '</div>'
      + '<div class="note gold" style="margin-top:10px"><b>动作</b>：盾卫举盾/挥剑，先锋长枪突刺，弓手拉弓放箭，术士法杖蓄能/发出魔法弹，游骑战马疾驰。攻城开始时自动显示在目标城墙外。</div>';
  },
  stopUnitShowcase() {
    if (this.unitRaf) cancelAnimationFrame(this.unitRaf);
    this.unitRaf = null;
  },
  startUnitShowcase() {
    this.stopUnitShowcase();
    const canvas = this.modals.querySelector('#unitShowcase');
    if (!canvas || !ORE.world || !ORE.world.drawUnit) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const keys = ['guard', 'vanguard', 'archer', 'warlock', 'raider'];
    const names = { guard: '盾卫', vanguard: '先锋', archer: '弓手', warlock: '术士', raider: '游骑' };
    const roles = { guard: '举盾 / 吸收', vanguard: '长枪 / 突进', archer: '拉弓 / 箭雨', warlock: '法杖 / 魔法弹', raider: '骑射 / 侧翼' };
    const color = D.CLAN[(G.state && G.state.clan) || 'ember'].color;
    const tick = (ms) => {
      if (this.modalType !== 'help' || this.tab.help !== 'units' || !this.modals.contains(canvas)) {
        this.stopUnitShowcase(); return;
      }
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0b0d0b'); bg.addColorStop(1, '#18120b');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(242,206,75,.12)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 52) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(242,206,75,.22)';
      ctx.beginPath(); ctx.moveTo(0, 218); ctx.lineTo(W, 218); ctx.stroke();
      for (let i = 0; i < keys.length; i++) {
        const x = 116 + i * 202;
        const phase = (ms / 900 + i * 0.17) % 1;
        ORE.world.drawUnit(ctx, keys[i], x, 218, 3.65, color, 1, phase);
        ctx.font = '800 15px "Space Grotesk", "PingFang SC", sans-serif';
        ctx.fillStyle = '#f3ead7'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(names[keys[i]], x, 244);
        ctx.font = '600 10px "PingFang SC", "Noto Sans SC", sans-serif';
        ctx.fillStyle = 'rgba(242,206,75,.8)';
        ctx.fillText(roles[keys[i]], x, 260);
      }
      this.unitRaf = requestAnimationFrame(tick);
    };
    this.unitRaf = requestAnimationFrame(tick);
  },

  helpEcon() {
    return '<div class="note">下面这套参数就是游戏里正在跑的模型。它想解决的不是“怎么发更多矿”，而是“矿怎么被消耗、流动性怎么自己长出来”。</div>'
      + '<div class="help-h"><i></i><h3>1. 100M 总量与每日 1%</h3><i></i></div>'
      + '<div class="formula">总发行 = 100,000,000 ORE<br>游戏矿池 = 80,000,000 ORE<br>每日产出 = 当前矿池剩余 × 1%</div>'
      + '<p class="fine">每天开始时锁定当天预算，再按地块权重实时分配到各矿脉。矿池剩余越少，后面的每日产出越少。</p>'
      + '<div class="help-h"><i></i><h3>2. 80% 口袋 / 20% 地块金库</h3><i></i></div>'
      + '<div class="formula">地块产出 × 80% → 按驻军战力分到每个士兵口袋<br>地块产出 × 20% → 进入地块金库</div>'
      + '<p class="fine">地块金库会随占领易手：攻方胜利后，金库按参战士兵战力分配。被敌人打下的城池，其金库也会被敌人拿走。</p>'
      + '<div class="help-h"><i></i><h3>3. 消耗与繁殖</h3><i></i></div>'
      + '<div class="formula">繁衍费 = 父亲战力 + 母亲战力<br>父母各自 24 小时冷却 · 孕育 45 秒</div>'
      + '<p class="fine">繁殖是把“个人钱包 ORE”变回“士兵”的转换器：孩子三维 = (父 + 母) × 1.0～1.2，口袋为 0。孩子进入市场再收 6% 手续费，形成二次消耗。</p>'
      + '<div class="help-h"><i></i><h3>4. 手续费 → 流动性</h3><i></i></div>'
      + '<div class="formula">市场费 6%：40% 买 ORE + 金库 ORE → POL<br>30% 回购 ORE 并销毁 · 30% 进项目金库</div>'
      + '<p class="fine">这意味着市场越活跃，池子越深、价格越稳；同时有持续回购销毁。LP 还赚 1% 兑换费。协议不靠“项目方砸钱做市”，而靠真实成交把流动性养出来。</p>'
      + '<div class="help-h"><i></i><h3>5. 为什么不是无限通胀</h3><i></i></div>'
      + '<div class="legend-note"><div><b>矿池递减</b>：每天只发剩余矿池的 1%，越挖越慢。</div><div><b>代币锁在口袋</b>：不销毁士兵，代币不能进个人钱包，也不能自由卖。</div><div><b>金库随战争易手</b>：打城可以直接抢走 20% 累积份额。</div><div><b>手续费回流</b>：市场费仍按 40/30/30 路由到 LP、销毁与金库。</div></div>'
      + '<div class="note bad" style="margin-top:10px"><b>仍需盯住的点</b>：① 每日产出/活跃士兵的比值；② 口袋提取/产出是否长期 <25%（说明代币滞留在口袋）；③ 繁殖成本是否低于“卖一个孩子”的收益（否则无限刷子）；④ 市场费过高会抑制成交，过低则 LP 长不起来。用“调参”页可以实时试。</div>';
  },

  openSettings() { this.openModal('settings'); },
  setMintSupply(total) {
    if (total == null || !isFinite(total)) return;
    document.querySelectorAll('[data-mint-supply]').forEach((n) => { n.textContent = String(total); });
  },
  async refreshMintSupply() {
    try {
      const r = await fetch('https://bsc-testnet-rpc.publicnode.com', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'eth_call',
          params: [{ to: '0x400e42D03dCf80D31fE45B57Daf3E0504a9dA240', data: '0x18160ddd' }, 'latest'],
        }),
      });
      if (!r.ok) return;
      const j = await r.json();
      if (j && j.result && j.result !== '0x') this.setMintSupply(Number(BigInt(j.result)));
    } catch (e) {}
  },
  walletInit() {
    this.wallet = { address: null, chainId: null, balance: 0 };
    this.walletProvider = null;
    this.walletName = '';
    this.wallets = [];
    this.walletSeq = 0;
    this.walletReturn = null;
    this.updateWalletChip();
    this.bindWalletDiscovery();
    this.walletDiscover();
    setTimeout(() => this.walletAutoReconnect(), 350);
  },
  bindWalletDiscovery() {
    if (this._walletDiscoveryBound) return;
    this._walletDiscoveryBound = true;
    window.addEventListener('eip6963:announceProvider', (e) => {
      try {
        const d = e.detail || {};
        if (d.info && d.provider) {
          this.walletAdd(d.info, d.provider, 'eip6963');
          this.updateWalletChip();
          this.walletAutoReconnect();
        }
      } catch (err) {}
    });
    try { window.dispatchEvent(new Event('eip6963:requestProvider')); } catch (e) {}
  },
  walletIdentify(provider, fallback) {
    const p = provider || {};
    if (p.isOkxWallet || p.isOKExWallet || p.isOkexWallet) return 'OKX Wallet';
    if (p.isBinance || p.isBinanceWallet) return 'Binance Web3 Wallet';
    if (p.isCoinbaseWallet) return 'Coinbase Wallet';
    if (p.isTrust || p.isTrustWallet) return 'Trust Wallet';
    if (p.isRabby) return 'Rabby';
    if (p.isBitKeep || p.isBitget) return 'Bitget Wallet';
    if (p.isMetaMask) return 'MetaMask';
    return fallback || 'Browser Wallet';
  },
  walletBadge(name) {
    if (/OKX/i.test(name)) return 'OKX';
    if (/Binance/i.test(name)) return 'BN';
    if (/MetaMask/i.test(name)) return 'MM';
    if (/Trust/i.test(name)) return 'TW';
    if (/Coinbase/i.test(name)) return 'CB';
    if (/Rabby/i.test(name)) return 'RB';
    if (/Bitget|BitKeep/i.test(name)) return 'BG';
    return (name || 'W').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'W';
  },
  walletAdd(info, provider, source) {
    if (!provider || typeof provider.request !== 'function') return;
    if (this.wallets.some((w) => w.provider === provider)) return;
    const name = info && info.name ? info.name : this.walletIdentify(provider);
    const wallet = {
      id: 'w' + (++this.walletSeq),
      name: info && info.name ? name : this.walletIdentify(provider, name),
      badge: this.walletBadge(name),
      icon: info && info.icon ? String(info.icon) : '',
      rdns: info && info.rdns ? String(info.rdns) : '',
      provider,
      source: source || 'legacy',
    };
    this.wallets.push(wallet);
  },
  walletDiscover() {
    const globals = [
      ['okxwallet', 'OKX Wallet'],
      ['BinanceChain', 'Binance Web3 Wallet'],
      ['coinbaseWalletExtension', 'Coinbase Wallet'],
      ['trustwallet', 'Trust Wallet'],
      ['rabby', 'Rabby'],
      ['bitkeep', 'Bitget Wallet'],
      ['ethereum', 'MetaMask'],
    ];
    for (const [key, fallback] of globals) {
      let p = window[key];
      if ((key === 'bitkeep' || key === 'okxwallet') && p && p.ethereum) p = p.ethereum;
      if (!p) continue;
      if (key === 'ethereum' && Array.isArray(p.providers)) {
        for (const sub of p.providers) this.walletAdd(null, sub, 'legacy');
      }
      this.walletAdd(null, p, 'legacy');
    }
    // Some wallets expose only the generic provider with feature flags.
    if (!this.wallets.length && window.ethereum) this.walletAdd(null, window.ethereum, 'legacy');
    this.updateWalletChip();
  },
  walletBind(provider) {
    try {
      if (this._walletBoundProvider && this._walletBoundProvider.removeListener) {
        this._walletBoundProvider.removeListener('accountsChanged', this._walletHandler);
        this._walletBoundProvider.removeListener('chainChanged', this._walletHandler);
      }
    } catch (e) {}
    this._walletBoundProvider = provider;
    this._walletHandler = () => this.walletRefresh(true);
    try {
      if (provider && provider.on) {
        provider.on('accountsChanged', this._walletHandler);
        provider.on('chainChanged', this._walletHandler);
      }
    } catch (e) {}
  },
  walletUse(wallet) {
    this.walletProvider = wallet.provider;
    this.walletName = wallet.name;
    this.walletBind(wallet.provider);
  },
  walletAutoReconnect() {
    if (this._walletAutoBusy || this.walletProvider) return;
    this._walletAutoBusy = true;
    (async () => {
      try {
        for (const w of this.wallets) {
          try {
            const accounts = await Promise.race([
              w.provider.request({ method: 'eth_accounts' }),
              new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 500)),
            ]);
            if (accounts && accounts.length) {
              this.walletUse(w);
              await this.walletRefresh(true);
              break;
            }
          } catch (e) {}
        }
      } finally {
        this._walletAutoBusy = false;
      }
    })();
  },
  openWalletPicker(returnTo) {
    this.walletDiscover();
    this.walletReturn = returnTo || null;
    this.openModal('wallet');
  },
  modal_wallet() {
    const list = (this.wallets || []).map((w) => {
      const active = this.walletProvider === w.provider;
      const icon = w.icon ? '<img class="wallet-logo" src="' + w.icon + '" alt="">' : '<span class="wallet-badge">' + w.badge + '</span>';
      return '<button class="wallet-pick-row" data-act="wallet-pick" data-id="' + w.id + '">'
        + icon
        + '<span class="wallet-meta"><b>' + esc(w.name) + '</b><span>' + (w.rdns ? esc(w.rdns) : (w.source === 'eip6963' ? 'EIP-6963' : '浏览器扩展')) + '</span></span>'
        + '<em>' + (active ? '已连接' : '连接') + '</em></button>';
    }).join('');
    const installs = '<div class="wallet-installs"><span>没有看到你的钱包？</span>'
      + '<a href="https://www.okx.com/web3" target="_blank" rel="noreferrer">安装 OKX Wallet</a>'
      + '<a href="https://www.binance.com/en/web3wallet" target="_blank" rel="noreferrer">Binance Web3</a>'
      + '<a href="https://metamask.io/download/" target="_blank" rel="noreferrer">MetaMask</a>'
      + '<a href="https://trustwallet.com/" target="_blank" rel="noreferrer">Trust Wallet</a>'
      + '<a href="https://www.coinbase.com/wallet" target="_blank" rel="noreferrer">Coinbase</a>'
      + '<a href="https://rabby.io/" target="_blank" rel="noreferrer">Rabby</a></div>';
    const detected = (this.wallets || []).length;
    const body = '<div class="note">支持浏览器扩展 / 内置钱包（EIP-6963 或 EIP-1193）：<b>OKX Wallet</b>、Binance Web3、MetaMask、Trust Wallet、Coinbase Wallet、Rabby、Bitget 等。连接后会自动切换到 BSC Testnet。<br><b>已检测到 ' + detected + ' 个钱包</b> · window.ethereum：' + (window.ethereum ? '已注入' : '未注入') + ' · window.okxwallet：' + (window.okxwallet ? '已注入' : '未注入') + '</div>'
      + (list ? '<div class="wallet-list">' + list + '</div>' : '<div class="note bad" style="margin-top:10px">未检测到浏览器钱包扩展。请先安装钱包，或在钱包 App 的内置浏览器中打开本页。</div>')
      + installs
      + '<div style="display:flex;gap:6px;margin-top:9px"><button class="btn sm ghost" data-act="wallet-rediscover">重新检测钱包</button></div>'
      + '<div class="note" id="walletMsg" style="margin-top:8px">如果钱包已解锁但仍连不上，点“重新检测钱包”，再选择钱包。</div>';

    return this.shell({
      kicker: 'WALLET · 连接钱包', title: '选择钱包', sub: '连接 BSC Testnet；不连接也可以继续玩单机。',
      body, wide: false,
      footer: '<div class="spacer"></div><button class="btn ghost" data-act="close">取消</button>',
    });
  },
  walletChoose(id) {
    const w = (this.wallets || []).find((x) => x.id === id);
    if (!w) return;
    this.walletUse(w);
    const msg = this.modals.querySelector('#walletMsg');
    if (msg) msg.textContent = '正在连接 ' + w.name + ' … 请在钱包里确认';
    (async () => {
      try {
        await w.provider.request({ method: 'eth_requestAccounts' });
        await this.chainSwitch(w.provider);
        const returnTo = this.walletReturn;
        this.walletReturn = null;
        this.closeModal();
        await this.walletRefresh(false);
        this.toast('已连接 ' + w.name + ' · BSC Testnet', 'good');
        if (returnTo === 'chain') this.openChain();
      } catch (e) {
        const detail = e.shortMessage || e.message || '用户拒绝';
        if (msg) msg.textContent = '连接失败：' + detail;
        this.toast('连接失败：' + detail, 'bad');
      }
    })();
  },
  walletRefresh(silent) {
    const provider = this.walletProvider;
    if (!provider) { this.updateWalletChip(); return; }
    (async () => {
      try {
        const accounts = await provider.request({ method: 'eth_accounts' });
        if (!accounts || !accounts.length) {
          this.wallet = { address: null, chainId: null, balance: 0 };
          this.updateWalletChip();
          return;
        }
        const address = accounts[0].toLowerCase();
        const chainId = String(await provider.request({ method: 'eth_chainId' })).toLowerCase();
        this.wallet = { address, chainId, balance: 0 };
        this.updateWalletChip();
        if (ORE.game && ORE.game.syncChainArmy && ORE.game.state && ORE.game.state.phase === 'playing') ORE.game.syncChainArmy();
        this.readNativeBalance(provider, address).then((gasBal) => {
          if (gasBal != null) { this.chain.gas = gasBal; this.chain.gasLoaded = true; }
        });
        this.readOreBalances(provider, address).then((ore) => {
          if (!ore) return;
          this.chain.ore = ore.ore; this.chain.vaultOre = ore.vaultOre; this.chain.poolOre = ore.poolOre; this.chain.oreLoaded = true; this.chain.syncedAt = Date.now();
        });
        // 顺带刷新「是否已授权士兵系列给 OreBurner」
        if (ORE.game && ORE.game.burnApprovalState) {
          ORE.game.burnApprovalState().then((v) => { if (v !== null) this._burnApproved = v; }).catch(() => {});
        }
        if (chainId === '0x61') {
          try {
            const raw = await provider.request({ method: 'eth_getBalance', params: [address, 'latest'] });
            this.wallet.balance = Number(BigInt(raw || '0x0')) / 1e18;
            this.updateWalletChip();
          } catch (e) {}
        }
      } catch (e) {
        if (!silent) this.toast('读取钱包失败：' + (e.shortMessage || e.message || 'RPC 错误'), 'bad');
        this.updateWalletChip();
      }
    })();
  },
  updateWalletChip() {
    const chip = el('chipWallet'); const label = el('walletLabel');
    if (!chip || !label) return;
    const w = this.wallet || {};
    chip.classList.remove('connected', 'warn');
    if (!w.address) {
      label.textContent = '连接钱包';
      chip.title = '连接 BSC 测试网钱包 · 支持 OKX / Binance / MetaMask / Trust / Coinbase / Rabby';
      return;
    }
    chip.classList.add(w.chainId === '0x61' ? 'connected' : 'warn');
    if (w.chainId === '0x61') {
      label.textContent = w.address.slice(0, 6) + '…' + w.address.slice(-4);
      chip.title = this.walletName + ' · BSC Testnet · ' + w.address + ' · ' + w.balance.toFixed(4) + ' tBNB';
    } else {
      label.textContent = '切换 BSC 测试网';
      chip.title = (this.walletName || '钱包') + ' · 当前网络不是 BSC Testnet（chainId 97）';
    }
  },
  walletClick() {
    if (!this.walletProvider || !this.wallet || !this.wallet.address) { this.openWalletPicker(); return; }
    if (this.wallet.chainId !== '0x61') { this.walletConnect(); return; }
    this.openChain();
  },
  walletConnect() {
    if (!this.walletProvider) { this.openWalletPicker(); return; }
    (async () => {
      try {
        await this.walletProvider.request({ method: 'eth_requestAccounts' });
        await this.chainSwitch(this.walletProvider);
        await this.walletRefresh(false);
        this.toast('已切换到 BSC Testnet', 'good');
      } catch (e) {
        this.toast('钱包连接失败：' + (e.shortMessage || e.message || '用户拒绝'), 'bad');
      }
    })();
  },

  openChain() {
    this.chain = { account: null, nft: 0, minted: 0, total: 0, ore: 0, vaultOre: 0, poolOre: 0, gas: 0, gasLoaded: false, oreLoaded: false, loaded: false, chainOk: false, busy: false, msg: '' };
    this.openModal('chain');
    if (this.walletProvider) this.chainRead(true);
  },
  modal_chain() {
    const c = this.chain || {};
    const has = !!this.walletProvider || (this.wallets && this.wallets.length > 0);
    const addr = c.account ? c.account.slice(0, 6) + '…' + c.account.slice(-4) : '未连接';
    const body = '<div class="note gold"><b>只有两个余额</b><br>链上个人钱包 ORE，以及士兵口袋 ORE。充值、提现、流动性页面已关闭；口袋 ORE 只能通过烧兵领取。</div>'
      + '<div class="grid-3" style="margin-top:10px">'
      + '<div class="mkt-kpi"><span>士兵 NFT</span><b style="font-size:10px;word-break:break-all">0x400e42D03dCf80D31fE45B57Daf3E0504a9dA240</b><em>BSC Testnet · chainId 97</em></div>'
      + '<div class="mkt-kpi"><span>钱包</span><b style="font-size:11px">' + addr + '</b><em>' + (this.walletProvider ? this.walletName : (has ? '已检测到钱包，点击连接' : '未检测到钱包')) + '</em></div>'
      + '<div class="mkt-kpi"><span>链上 ORE</span><b>' + (c.oreLoaded ? U.fmt(c.ore, c.ore < 100 ? 2 : 0) : '—') + '</b><em>个人钱包余额</em></div>'
      + '</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">'
      + '<button class="btn sm" data-act="chain-connect">' + (c.account ? '重新连接钱包' : '连接钱包') + '</button>'
      + '<button class="btn sm ghost" data-act="chain-refresh" ' + (c.account ? '' : 'disabled') + '>刷新链上数据</button>'
      + '<button class="btn sm ghost" data-act="chain-sync" ' + (c.account ? '' : 'disabled') + '>同步链上士兵</button>'
      + '<button class="btn sm ghost" data-act="open-wallet">选择钱包</button>'
      + '<a class="btn sm ghost" href="https://testnet.bscscan.com/address/0x400e42D03dCf80D31fE45B57Daf3E0504a9dA240" target="_blank" rel="noreferrer" style="text-decoration:none;display:inline-flex;align-items:center">BscScan</a>'
      + '</div>'
      + '<div class="note" id="chainMsg" style="margin-top:10px">' + (c.msg || (has ? '连接钱包后读取链上数据。' : '请安装 MetaMask 或兼容的 EIP-1193 钱包。')) + '</div>'
      + '<div class="note" style="margin-top:8px">士兵 NFT 的属性在链上；游戏内士兵口袋 ORE 不随 NFT 转移，交易或转移后直接清零。</div>';
    return this.shell({
      kicker: 'BSC TESTNET · 链上钱包', title: '链上个人钱包', sub: '链上 ORE 与士兵 NFT；充值和提现功能已关闭。',
      body, wide: true,
      footer: '<div class="spacer"></div><button class="btn ghost" data-act="close">关闭</button>',
    });
  },
  chainSetMsg(msg) {
    this.chain.msg = msg;
    const n = this.modals.querySelector('#chainMsg');
    if (n) n.textContent = msg;
  },
  walletError(e) {
    const seen = new Set();
    const walk = (x, depth) => {
      if (!x || depth > 5) return '';
      if (typeof x === 'string') return x;
      if (typeof x !== 'object' || seen.has(x)) return '';
      seen.add(x);
      let msg = x.shortMessage || x.reason || x.message || '';
      for (const k of ['data', 'error', 'originalError', 'info']) {
        if (!x[k]) continue;
        const inner = walk(x[k], depth + 1);
        if (inner && (!msg || /internal json-rpc|execution reverted|unknown error/i.test(msg))) msg = inner;
      }
      return msg;
    };
    return walk(e, 0) || '钱包拒绝或 RPC 错误';
  },
  async chainSwitch(provider) {
    const p = provider || this.walletProvider;
    if (!p) throw new Error('未检测到钱包');
    const chain = await p.request({ method: 'eth_chainId' });
    if (String(chain).toLowerCase() === '0x61') return;
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x61' }] });
    } catch (e) {
      if (e && (e.code === 4902 || /Unrecognized chain/i.test(e.message || ''))) {
        await p.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x61', chainName: 'BSC Testnet',
            nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
            rpcUrls: ['https://bsc-testnet-rpc.publicnode.com'],
            blockExplorerUrls: ['https://testnet.bscscan.com'],
          }],
        });
      } else throw e;
    }
  },
  async chainConnect() {
    if (!this.walletProvider) { this.openWalletPicker('chain'); return; }
    try {
      await this.walletProvider.request({ method: 'eth_requestAccounts' });
      await this.chainSwitch(this.walletProvider);
      await this.chainRead(false);
    } catch (e) {
      const detail = e.shortMessage || e.message || '用户拒绝';
      this.chainSetMsg('连接失败：' + detail + '。请重新选择钱包或解锁扩展。');
      this.openWalletPicker('chain');
    }
  },
  async readNativeBalance(provider, account) {
    if (!provider || !account) return null;
    try {
      const out = await provider.request({ method: 'eth_getBalance', params: [account, 'latest'] });
      return out ? Number(BigInt(out)) / 1e18 : 0;
    } catch (e) { return null; }
  },
  async readOreBalances(provider, account) {
    if (!provider || !account) return null;
    try {
      const pad = (a) => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
      const [w, v, p] = await Promise.all([
        provider.request({ method: 'eth_call', params: [{ to: ORE_TOKEN, data: '0x70a08231' + pad(account) }, 'latest'] }),
        provider.request({ method: 'eth_call', params: [{ to: ORE_TOKEN, data: '0x70a08231' + pad(ORE_VAULT) }, 'latest'] }),
        provider.request({ method: 'eth_call', params: [{ to: ORE_TOKEN, data: '0x70a08231' + pad(ORE_MINE_POOL) }, 'latest'] }),
      ]);
      return {
        ore: w && w !== '0x' ? Number(BigInt(w)) / 1e18 : 0,
        vaultOre: v && v !== '0x' ? Number(BigInt(v)) / 1e18 : 0,
        poolOre: p && p !== '0x' ? Number(BigInt(p)) / 1e18 : 0,
      };
    } catch (e) { return null; }
  },
  async chainRead(silent) {
    const provider = this.walletProvider;
    if (!provider) return;
    const c = this.chain;
    try {
      const accounts = await provider.request({ method: 'eth_accounts' });
      if (!accounts || !accounts.length) {
        if (!silent) this.chainSetMsg('钱包未连接，请点击“连接钱包”。');
        return;
      }
      const chain = await provider.request({ method: 'eth_chainId' });
      if (String(chain).toLowerCase() !== '0x61') {
        this.chainSetMsg('请切换到 BSC Testnet（chainId 97）后刷新。');
        c.account = accounts[0]; c.chainOk = false;
        this.chainRender();
        return;
      }
      const account = accounts[0].toLowerCase();
      const native = await this.readNativeBalance(provider, account);
      if (native != null) { c.gas = native; c.gasLoaded = true; }
      const padAddr = (a) => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
      const call = async (selector, withAddress) => {
        const data = selector + (withAddress === false ? '' : padAddr(account));
        const out = await provider.request({ method: 'eth_call', params: [{ to: '0x400e42D03dCf80D31fE45B57Daf3E0504a9dA240', data }, 'latest'] });
        return out && out !== '0x' ? BigInt(out) : 0n;
      };
      const nft = await call('0x70a08231');
      const minted = await call('0xd3738fc8');
      const total = await call('0x18160ddd', false);
      const ore = await this.readOreBalances(provider, account);
      c.account = account; c.chainOk = true; c.loaded = true; c.nft = Number(nft); c.minted = Number(minted); c.total = Number(total);
      if (ore) { c.ore = ore.ore; c.vaultOre = ore.vaultOre; c.poolOre = ore.poolOre; c.oreLoaded = true; }
      c.syncedAt = Date.now();
      this.setMintSupply(c.total);
      c.msg = '已读取链上数据 · 钱包 ' + account.slice(0, 6) + '…' + account.slice(-4);
      this.walletRefresh(true);
      if (ORE.game && ORE.game.syncChainArmy) await ORE.game.syncChainArmy();
      this.chainRender();
    } catch (e) {
      this.chainSetMsg('读取失败：' + (e.shortMessage || e.message || 'RPC 错误'));
    }
  },
  chainRender() {
    if (this.modalType !== 'chain') return;
    this.openModal('chain');
  },
  async chainMint() {
    const provider = this.walletProvider;
    if (!provider) return this.chainSetMsg('未检测到钱包');
    const c = this.chain;
    if (!c.account) return this.chainSetMsg('请先连接钱包');
    if (!c.loaded) {
      await this.chainRead(false);
      if (!c.loaded) return this.chainSetMsg('链上数据还没读到，请先刷新链上数据');
    }
    const qty = Math.max(0, Math.min(10 - (c.minted || 0), 10000 - (c.total || 0)));
    if (qty <= 0) return this.chainSetMsg(c.minted >= 10 ? '该地址已铸造 10 个，已达上限。' : '链上总量已满。');
    try {
      c.busy = true; this.chainRender();
      const data = '0xa0712d68' + BigInt(qty).toString(16).padStart(64, '0');
      let gas = null;
      try {
        const est = await provider.request({
          method: 'eth_estimateGas',
          params: [{ from: c.account, to: '0x400e42D03dCf80D31fE45B57Daf3E0504a9dA240', data, value: '0x0' }],
        });
        if (est) gas = '0x' + (BigInt(est) * 12n / 10n).toString(16);
      } catch (e) {
        const detail = this.walletError(e);
        if (!/not supported|unsupported|method.*not found|does not exist/i.test(detail)) throw e;
      }
      const tx = { from: c.account, to: '0x400e42D03dCf80D31fE45B57Daf3E0504a9dA240', data, value: '0x0' };
      if (gas) tx.gas = gas;
      const hash = await provider.request({ method: 'eth_sendTransaction', params: [tx] });
      c.msg = '交易已提交：' + hash.slice(0, 10) + '… 等待确认';
      this.chainRender();
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const rec = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] });
        if (rec) {
          const ok = rec.status === '0x1' || rec.status === 1 || rec.status === '0x01';
          if (ok) {
            c.busy = false;
            await this.chainRead(false);
            c.msg = '铸造成功：' + hash.slice(0, 10) + '…';
            this.chainRender();
            return;
          }
          if (rec.status === '0x0' || rec.status === 0 || rec.status === '0x00') throw new Error('交易 revert');
        }
      }
      c.busy = false; c.msg = '交易未在超时前确认，请刷新链上数据。'; this.chainRender();
    } catch (e) {
      c.busy = false;
      const detail = this.walletError(e);
      this.chainSetMsg('铸造失败：' + detail);
    }
  },

  oreSetMsg(msg) {
    const n = this.modals && this.modals.querySelector('#oreMsg');
    if (n) n.textContent = msg;
    if (this.chain) this.chain.oreMsg = msg;
  },
  oreToWei(value) {
    const text = String(value == null ? '' : value).trim();
    if (!/^\d+(\.\d+)?$/.test(text)) throw new Error('请输入有效数量');
    const [a, b = ''] = text.split('.');
    if (b.length > 18) throw new Error('最多 18 位小数');
    return BigInt(a) * 10n ** 18n + BigInt((b + '0'.repeat(18)).slice(0, 18));
  },
  oreWord(n) { return BigInt(n).toString(16).padStart(64, '0'); },
  oreAddr(a) { return a.toLowerCase().replace(/^0x/, '').padStart(64, '0'); },
  oreClaimApi() {
    const host = (typeof location !== 'undefined' && location.hostname) ? location.hostname : '127.0.0.1';
    return 'http://' + host + ':8090/claim';
  },
  oreBurnPayoutApi() {
    const host = (typeof location !== 'undefined' && location.hostname) ? location.hostname : '127.0.0.1';
    return 'http://' + host + ':8090/burn-payout';
  },
  async oreSend(provider, tx) {
    let gas = null;
    try {
      const est = await provider.request({ method: 'eth_estimateGas', params: [tx] });
      if (est) gas = '0x' + (BigInt(est) * 12n / 10n).toString(16);
    } catch (e) {
      throw new Error(this.walletError(e));
    }
    const out = { from: tx.from, to: tx.to, data: tx.data, value: tx.value || '0x0' };
    if (gas) out.gas = gas;
    return provider.request({ method: 'eth_sendTransaction', params: [out] });
  },
  async oreWait(provider, hash) {
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const rec = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] });
      if (!rec) continue;
      const ok = rec.status === '0x1' || rec.status === 1 || rec.status === '0x01';
      if (ok) return rec;
      if (rec.status === '0x0' || rec.status === 0 || rec.status === '0x00') throw new Error('交易 revert');
    }
    throw new Error('交易确认超时');
  },
  async oreClaim() {
    const provider = this.walletProvider;
    const c = this.chain;
    const s = ORE.game && ORE.game.state;
    if (!provider || !c || !c.account) return this.oreSetMsg('请先连接钱包');
    if (!c.chainOk) return this.oreSetMsg('请先切换到 BSC Testnet');
    if (!s || s.phase !== 'playing') return this.oreSetMsg('游戏尚未开始');
    if (this._oreBusy) return;
    try {
      const input = this.modals.querySelector('#oreClaimAmt');
      const amount = Number(input ? input.value : 0);
      if (!(amount > 0)) throw new Error('请输入提取数量');
      if (amount > s.player.ore + 1e-9) throw new Error('超过游戏个人钱包余额');
      const wei = this.oreToWei(amount);
      this._oreBusy = true;
      this.oreSetMsg('正在请求游戏签名…');
      const deadline = Math.floor(Date.now() / 1000) + 600;
      const nonce = Date.now() * 1000 + Math.floor(Math.random() * 1000);
      const pending = Math.max(0, (s.econ.totalEmitted || 0) - (s.econ.chainSettled || 0));
      const settleAmount = pending > 0 ? this.oreToWei(Math.min(pending, amount)).toString() : '0';
      const resp = await fetch(this.oreClaimApi(), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ player: c.account, amount: wei.toString(), nonce: String(nonce), deadline, settleAmount }),
      });
      const sig = await resp.json();
      if (!resp.ok || !sig.ok) throw new Error(sig.error || '签名服务失败');
      if (sig.settled && BigInt(sig.settled) > 0n) {
        s.econ.chainSettled = (s.econ.chainSettled || 0) + Number(BigInt(sig.settled)) / 1e18;
        ORE.game.save();
      }
      const signature = String(sig.signature || '');
      if (!signature.startsWith('0x') || signature.length < 130) throw new Error('签名格式错误');
      const sigHex = signature.slice(2);
      const sigPadded = sigHex.padEnd(Math.ceil(sigHex.length / 64) * 64, '0');
      const data = ORE_CLAIM + this.oreWord(wei) + this.oreWord(nonce) + this.oreWord(deadline) + this.oreWord(128) + this.oreWord(sigHex.length / 2) + sigPadded;
      this.oreSetMsg('签好名，正在提交 Vault.claim…');
      const hash = await this.oreSend(provider, { from: c.account, to: ORE_VAULT, data, value: '0x0' });
      this.oreSetMsg('交易已提交，等待确认…');
      await this.oreWait(provider, hash);
      s.player.ore = Math.max(0, s.player.ore - amount);
      s.econ.onchainNet = (s.econ.onchainNet || 0) + amount;
      s.lastOreTx = { hash, amount, type: 'claim', at: Date.now(), settleTx: sig.settleTx || null };
      ORE.game.save(); ORE.game.syncMap();
      ORE.game.pushFeed({ type: 'chain', icon: '◈', mine: true, text: '提取 <b>' + U.fmt(amount, 2) + ' ORE</b> 到链上钱包：<a href="https://testnet.bscscan.com/tx/' + hash + '" target="_blank" rel="noreferrer">查看 Tx</a>' });
      this.oreSetMsg('提取成功 · Tx ' + hash.slice(0, 10) + '…');
      this.toast('提取 ' + U.fmt(amount, 2) + ' ORE 到链上钱包', 'good');
      await this.chainRead(false);
      this.openChain();
      if (ORE.ui) ORE.ui.refreshAll();
    } catch (e) {
      this.oreSetMsg('提取失败：' + this.walletError(e));
    } finally { this._oreBusy = false; }
  },
  async oreDeposit() {
    const provider = this.walletProvider;
    const c = this.chain;
    const s = ORE.game && ORE.game.state;
    if (!provider || !c || !c.account) return this.oreSetMsg('请先连接钱包');
    if (!c.chainOk) return this.oreSetMsg('请先切换到 BSC Testnet');
    if (!s || s.phase !== 'playing') return this.oreSetMsg('游戏尚未开始');
    if (this._oreBusy) return;
    try {
      const input = this.modals.querySelector('#oreDepositAmt');
      const amount = Number(input ? input.value : 0);
      if (!(amount > 0)) throw new Error('请输入充值数量');
      if (amount > c.ore + 1e-9) throw new Error('超过钱包链上 ORE 余额');
      const wei = this.oreToWei(amount);
      this._oreBusy = true;
      this.oreSetMsg('第一步：approve Vault…');
      const approveData = ERC20_APPROVE + this.oreAddr(ORE_VAULT) + this.oreWord(wei);
      const approveHash = await this.oreSend(provider, { from: c.account, to: ORE_TOKEN, data: approveData, value: '0x0' });
      await this.oreWait(provider, approveHash);
      this.oreSetMsg('第二步：deposit 到 Vault…');
      const depData = ORE_DEPOSIT + this.oreWord(wei);
      const hash = await this.oreSend(provider, { from: c.account, to: ORE_VAULT, data: depData, value: '0x0' });
      await this.oreWait(provider, hash);
      s.player.ore += amount;
      s.econ.onchainNet = (s.econ.onchainNet || 0) - amount;
      s.lastOreTx = { hash, amount, type: 'deposit', at: Date.now() };
      ORE.game.save(); ORE.game.syncMap();
      ORE.game.pushFeed({ type: 'chain', icon: '◈', mine: true, text: '从链上钱包充值 <b>' + U.fmt(amount, 2) + ' ORE</b> 到游戏个人钱包：<a href="https://testnet.bscscan.com/tx/' + hash + '" target="_blank" rel="noreferrer">查看 Tx</a>' });
      this.oreSetMsg('充值成功 · Tx ' + hash.slice(0, 10) + '…');
      this.toast('从链上充值 ' + U.fmt(amount, 2) + ' ORE 到游戏', 'good');
      await this.chainRead(false);
      this.openChain();
      if (ORE.ui) ORE.ui.refreshAll();
    } catch (e) {
      this.oreSetMsg('充值失败：' + this.walletError(e));
    } finally { this._oreBusy = false; }
  },

  async chainSync() {
    if (!this.walletProvider) return this.chainSetMsg('请先连接钱包');
    await this.chainRead(false);
    const c = this.chain;
    const s = ORE.game && ORE.game.state;
    if (!c || !c.loaded || !s) return this.chainSetMsg('同步失败：链上数据未读取');
    const army = ORE.game.counts();
    const b = EC.balanceCheck(s);
    this.chainSetMsg('资产已同步：链上 NFT ' + c.nft + ' 个 · 游戏军团 ' + army.totalAll + ' 人（在役 ' + army.total + ' / 阵亡 ' + (army.dead || 0) + '）· 钱包 ORE ' + U.fmt(c.ore, 2) + ' · 个人钱包 ' + U.fmt(s.player.ore, 2) + ' · 链上矿池 ' + U.fmt(c.poolOre, 0) + ' · 账本差 ' + U.fmt(b.diff, 4));
    this.chainRender();
  },

  modal_settings() {
    const s = G.state;
    return this.shell({
      kicker: 'SYSTEM · 系统', title: '设置与存档', sub: '进度只保存在这台设备的浏览器里。',
      body: '<div class="set-row"><div><b>世界种子</b><span>' + s.worldSeed + ' · 单机模拟</span></div><span class="pill">SEED</span></div>'
        + '<div class="set-row"><div><b>存档时间</b><span>' + new Date(s.lastSeen || Date.now()).toLocaleString('zh-CN') + '</span></div><span class="pill">LOCAL</span></div>'
        + '<div class="set-row"><div><b>地图外观</b><span>自然地貌 / 红蓝黄势力色块</span></div><div style="display:flex;gap:4px"><button class="btn sm ' + ((s.params.terrainMode || '3d') === '3d' ? '' : 'ghost') + '" data-act="terrain-mode" data-v="3d">3D 地貌</button><button class="btn sm ' + (s.params.terrainMode === 'faction' ? '' : 'ghost') + '" data-act="terrain-mode" data-v="faction">势力色块</button></div></div>'
        + '<div class="set-row"><div><b>BSC 测试网士兵</b><span>免费 NFT · 每地址最多 10 个 · 决定游戏军团</span></div><button class="btn sm ghost" data-act="open-chain">打开</button></div>'
        + '<div class="set-row"><div><b>导出 / 导入</b><span>复制 JSON 可在别的浏览器继续。</span></div><div style="display:flex;gap:5px"><button class="btn sm ghost" data-act="settings-export">导出</button><button class="btn sm ghost" data-act="settings-copy">复制</button><button class="btn sm ghost" data-act="settings-import">导入</button></div></div>'
        + '<textarea class="savebox" id="saveText" placeholder="导出的存档 JSON 会出现在这里；粘贴后点导入。"></textarea>'
        + '<div class="set-row" style="margin-top:8px"><div><b style="color:#ff8a80">重开一局</b><span>清空地图、军团、市场与 LP，重新选择势力。</span></div><button class="btn sm danger" data-act="settings-reset">重开</button></div>'
        + '<p class="fine">提示：游戏经济为本地模拟；链上部分仅使用 BSC Testnet NFT，不产生真实资产。</p>',
      footer: '<div class="spacer"></div><button class="btn" data-act="close">关闭</button>',
    });
  },

  openOnboarding() {
    this.onboardIndex = 0;
    this.openModal('onboard');
  },
  modal_onboard() {
    const i = this.onboardIndex || 0;
    const steps = [
      { k: '链上', t: '先连钱包，再铸士兵', p: '游戏开局没有免费士兵。连接 BSC Testnet 钱包，免费铸造士兵 NFT；链上有几个 NFT，游戏军团就有几个士兵。', art: this.art(0) },
      { k: '口袋', t: '80% 进士兵口袋', p: '地块产出的 80% 按战力进入驻军士兵口袋；只有销毁士兵，口袋代币才会转入个人钱包。', art: this.art(1) },
      { k: '血脉', t: '结婚、繁衍、卖子嗣', p: '一男一女结缘，消耗 ORE 生出新兵。孩子三维 = (父 + 母) × 1.0～1.2，口袋为 0；可以留下，也可以挂牌出售。', art: this.art(2) },
      { k: '战争', t: '打下城池，抢走地块金库', p: '攻城 30 秒后结算。胜利后接管产出，并把该地块 20% 金库按战力分给参战士兵。', art: this.art(3) },
    ];
    const st = steps[i];
    const body = '<div class="steps-dots">' + steps.map((_, j) => '<i class="' + (j === i ? 'on' : '') + '"></i>').join('') + '</div>'
      + '<div class="step-visual">' + st.art + '</div>'
      + '<span class="kicker"><i></i>STEP ' + (i + 1) + ' / 4 · ' + st.k + '</span>'
      + '<h3 style="font:800 22px/1.25 var(--display);margin:10px 0 8px">' + st.t + '</h3>'
      + '<p style="color:var(--muted);font-size:12.5px;line-height:1.65;margin:0">' + st.p + '</p>';
    return this.shell({
      kicker: 'BRIEFING · 作战简报', title: '欢迎来到矿域', sub: '四个动作，理解整个经济循环。',
      body,
      footer: '<button class="btn ghost" data-act="onboard-done">跳过</button><div class="spacer"></div>'
        + (i > 0 ? '<button class="btn ghost" data-act="onboard-prev">上一步</button>' : '')
        + '<button class="btn" data-act="' + (i >= 3 ? 'onboard-done' : 'onboard-next') + '">' + (i >= 3 ? '进入战场' : '下一步') + '</button>',
    });
  },
  onboardStep(d) {
    this.onboardIndex = U.clamp((this.onboardIndex || 0) + d, 0, 3);
    this.openModal('onboard');
  },
  art(i) {
    const cols = ['#fec23e', '#ff5b45', '#d6a7ff', '#5ba8ff'];
    const c = cols[i];
    if (i === 0) return '<svg viewBox="0 0 400 150"><defs><radialGradient id="g0"><stop offset="0" stop-color="#f2ce4b" stop-opacity=".22"/><stop offset="1" stop-color="#f2ce4b" stop-opacity="0"/></radialGradient></defs><rect width="400" height="150" fill="#050809"/><circle cx="200" cy="76" r="70" fill="url(#g0)"/><polygon points="200,24 252,54 252,112 200,142 148,112 148,54" fill="#17140c" stroke="#6b5a24" stroke-width="1.4"/><polygon points="200,48 230,65 230,101 200,118 170,101 170,65" fill="#242013" stroke="#f2ce4b" stroke-width="1.2"/><circle cx="200" cy="83" r="9" fill="#f2ce4b"/><circle cx="200" cy="83" r="20" fill="none" stroke="#f2ce4b" stroke-opacity=".25"/><text x="200" y="20" text-anchor="middle" fill="#8d866f" font-size="8" font-family="monospace">远离基地 · 高产</text><text x="200" y="140" text-anchor="middle" fill="#6d685e" font-size="9" font-family="monospace">+ ORE / MIN</text></svg>';
    if (i === 1) return '<svg viewBox="0 0 400 150"><rect width="400" height="150" fill="#0b0b0b"/><polygon points="120,28 138,22 146,55 132,88 112,62" fill="#2b2b2b" stroke="#ff5b45" stroke-width="1.6"/><polygon points="112,88 146,84 156,130 102,130" fill="#1a1a1a" stroke="#333"/><path d="M170 78 L230 78" stroke="#ff5b45" stroke-width="2" stroke-dasharray="5 5"/><polygon points="238,66 262,78 238,90" fill="#ff5b45"/><circle cx="300" cy="78" r="28" fill="#171008" stroke="#fec23e"/><text x="300" y="84" text-anchor="middle" fill="#fec23e" font-size="17" font-family="monospace">ORE</text><text x="200" y="142" text-anchor="middle" fill="#6d685e" font-size="9" font-family="monospace">BURN SOLDIER → CLAIM ORE</text></svg>';
    if (i === 2) return '<svg viewBox="0 0 400 150"><rect width="400" height="150" fill="#0b0b0b"/><polygon points="132,44 152,34 168,48 166,82 150,96 134,82" fill="#d8d1c2" stroke="#000" stroke-width="2"/><polygon points="140,40 152,30 164,40 160,54 144,54" fill="#2b2b2b"/><polygon points="250,44 270,34 286,48 284,82 268,96 252,82" fill="#d8d1c2" stroke="#000" stroke-width="2"/><polygon points="258,40 270,30 282,40 278,54 262,54" fill="#2b2b2b"/><path d="M180 70 L236 70" stroke="#d6a7ff" stroke-width="1.6"/><text x="208" y="62" text-anchor="middle" fill="#d6a7ff" font-size="14">∞</text><polygon points="330,42 350,52 344,76 328,84 318,62" fill="#d6a7ff" opacity=".8"/><text x="200" y="136" text-anchor="middle" fill="#6d685e" font-size="9" font-family="monospace">MARRY → BREED → SELL THE CHILD</text></svg>';
    return '<svg viewBox="0 0 400 150"><rect width="400" height="150" fill="#050809"/><polygon points="60,34 126,34 154,64 126,108 60,108 32,64" fill="#142a3c" stroke="#4d9de0"/><polygon points="246,34 312,34 340,64 312,108 246,108 218,64" fill="#2e1714" stroke="#e5533d"/><path d="M150 70 L212 70" stroke="#fff" stroke-width="2" stroke-dasharray="5 5"/><polygon points="188,59 206,70 188,81" fill="#fff"/><path d="M96 52 L96 30" stroke="#ece6d7" stroke-width="2"/><polygon points="96,30 118,35 112,44 96,40" fill="#4d9de0"/><path d="M286 52 L286 30" stroke="#ece6d7" stroke-width="2"/><polygon points="286,30 264,35 270,44 286,40" fill="#e5533d"/><text x="96" y="130" text-anchor="middle" fill="#4d9de0" font-size="9" font-family="monospace">YOUR HEX</text><text x="286" y="130" text-anchor="middle" fill="#e5533d" font-size="9" font-family="monospace">ENEMY HEX</text><text x="200" y="145" text-anchor="middle" fill="#6d685e" font-size="8" font-family="monospace">CAPTURE = TAKE THE ORE FLOW</text></svg>';
  },

  /* ============================================================
     GARRISON / LIST
     ============================================================ */
  openGarrison(id) {
    if (id == null) { this.toast('先选择己方地块', 'bad'); return; }
    this.openModal('garrison');
  },
  modal_garrison() {
    const s = G.state;
    const z = s.selected != null ? G.zone(s.selected) : null;
    if (!z || z.owner !== s.clan) return this.shell({ kicker: 'GUARD', title: '调防', body: empty('请选择一个己方地块'), footer: '<div class="spacer"></div><button class="btn" data-act="close">关闭</button>' });
    const idle = G.counts().idle;
    const max = Math.min(80 - z.garrisonIds.length, idle);
    const cur = z.garrisonIds.map((i) => G.soldier(i)).filter(Boolean);
    return this.shell({
      kicker: 'GUARD · 调防', title: z.name, sub: z.kind === 'base' ? '基地不可被攻击，可以存放预备队，也可以直接出兵。' : '驻军提供防御。无驻军的地块会很快被 AI 拿走。',
      body: '<div class="z-stats" style="margin-top:0"><div><span>当前驻军</span><b>' + z.garrisonIds.length + '</b><em>上限 80</em></div><div><span>' + (z.kind === 'base' ? '地块类型' : '地块防御') + '</span><b>' + (z.kind === 'base' ? '基地' : Math.round(G.zoneDefense(z))) + '</b><em>' + (z.kind === 'base' ? '不可攻击' : '含筑防 Lv.' + z.fort) + '</em></div><div><span>待命士兵</span><b>' + idle + '</b><em>可调派</em></div></div>'
        + '<div class="ex-slider"><div class="ex-s-h"><b>派驻数量</b><span id="gN">' + Math.min(10, max) + '</span></div><input type="range" id="gRange" min="1" max="' + Math.max(1, max) + '" value="' + Math.min(10, Math.max(1, max)) + '"></div>'
        + '<div style="display:flex;gap:6px"><button class="btn" data-act="garrison-station" ' + (max ? '' : 'disabled') + '>派驻</button><button class="btn ghost" data-act="garrison-withdraw" ' + (z.garrisonIds.length ? '' : 'disabled') + '>撤回全部</button><button class="btn ghost" data-act="close">关闭</button></div>'
        + '<div class="sect" style="margin-top:14px"><div class="sect-h"><h3>驻军名单</h3><span>' + cur.length + ' 人</span></div><div class="ex-list" style="max-height:150px">' + (cur.slice(0, 40).map((x) => '<span class="ex-chip"><i style="background:' + D.CLAN[s.clan].color + '"></i>' + esc(x.name) + ' · DEF ' + x.def + '</span>').join('') || empty('无驻军')) + '</div></div>'
        + '<div class="note" style="margin-top:10px">' + (z.kind === 'base' ? '基地驻军是安全的预备队；从这里也可以直接出兵。' : '驻军按防御从高到低调派。撤回会立刻清空该地块驻军，请留意战报中的敌军行军。') + '</div>',
      footer: '<div class="spacer"></div><button class="btn" data-act="close">完成</button>',
    });
  },

  openList(id) {
    const s = G.state;
    const so = G.soldier(id);
    if (!so) return;
    this.listId = id;
    const fair = G.fairValue(so);
    this.openRaw({
      kicker: 'LIST · 挂牌', title: '出售 ' + so.name,
      sub: '成交后收取 ' + (s.params.fee * 100).toFixed(1) + '% 手续费。价格越接近估价，越快成交。',
      body: '<div style="display:flex;gap:12px;align-items:center;margin-bottom:12px"><span class="pav" style="width:74px;height:74px;border-radius:12px;overflow:hidden;background:#111">' + av(so) + '</span><div><div style="font:800 16px/1.2 var(--display)">' + esc(so.name) + ' ' + tierBadge(so.tier) + '</div><p class="fine" style="margin:5px 0 0">' + so.clsName + ' · 战力 ' + power(so) + ' · 提取 ' + cap(so) + '</p></div></div>'
        + '<div class="field"><label>标价（ETH）· 系统估价 ' + U.fmtEth(fair) + '</label><input id="listPrice" type="number" step="0.0001" min="0.001" value="' + fair.toFixed(4) + '"></div>'
        + '<p class="fine" id="listQuote">手续费 <b>' + U.fmtEth(fair * s.params.fee) + ' Ξ</b> · 到手 <b>' + U.fmtEth(fair * (1 - s.params.fee)) + ' Ξ</b></p>'
        + '<div class="note" style="margin-top:8px">买家是模拟的其他指挥官。定价高于估价 20% 以上会明显变慢。</div>',
      footer: '<div class="spacer"></div><button class="btn ghost" data-act="close">取消</button><button class="btn" data-act="list-confirm">确认挂牌</button>',
    });
  },

  /* ============================================================
     TOAST
     ============================================================ */
  toast(msg, type) {
    if (this.modalType) {
      const m = this.modals.querySelector('#modalMsg');
      if (m) {
        clearTimeout(this._msgTimer);
        m.className = 'modal-msg show ' + (type || '');
        m.textContent = String(msg).replace(/<[^>]+>/g, '');
        this._msgTimer = setTimeout(() => { m.className = 'modal-msg'; }, 3200);
        return;
      }
    }
    const box = this.toasts;
    if (!box) return;
    const d = document.createElement('div');
    d.className = 'toast ' + (type || '');
    d.innerHTML = '<i></i><span>' + msg + '</span>';
    box.appendChild(d);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 320); }, 3000);
  },
};

// expose small helper used by the world/feed
UI.ts = ts;
UI.av = av;

ORE.ui = UI;
})();
