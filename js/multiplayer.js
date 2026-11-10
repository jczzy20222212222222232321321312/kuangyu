/* ORE.ZONE server-authoritative shared world client.
 * The server owns ownership, troops, ORE, attacks and battle results.
 * The client sends commands and renders the server snapshot.
 */
(function () {
  'use strict';
  const cfg = window.ORE_MP_CONFIG || {};
  const entry = document.getElementById('mpEnter');
  if (entry) {
    if (cfg.enabled) entry.style.display = 'none';
    else entry.addEventListener('click', () => {
      const u = new URL(location.href);
      u.searchParams.set('mp', '1');
      location.href = u.toString();
    });
  }
  if (!cfg.enabled) return;

  const host = (location.hostname && location.protocol !== 'file:') ? location.hostname : '127.0.0.1';
  const base = (cfg.url || (location.protocol + '//' + host + ':8091')).replace(/\/$/, '');
  let pid = '';
  try {
    pid = localStorage.getItem('ore.mp.pid') || '';
    if (!pid) {
      pid = (crypto.randomUUID ? crypto.randomUUID() : ('p-' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
      localStorage.setItem('ore.mp.pid', pid);
    }
  } catch (e) { pid = 'p-' + Math.random().toString(36).slice(2); }

  const T = (s) => (window.ORE.i18n ? ORE.i18n.tr(s) : s);
  const G = () => window.ORE && ORE.game;
  const MP = window.ORE_MP_CLIENT = {
    id: pid, token: '', base, joined: false, online: 0, snap: null,
    selected: null, onLocalCapture: null,
  };
  let joined = false, joining = false, source = null, statusEl = null;
  let selected = null;
  let hud = null;
  let authEl = null;
  let authBusy = false;
  let mpTab = 'war';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function sname(x) { return (window.ORE && ORE.i18n && ORE.i18n.name) ? ORE.i18n.name(x && x.name, x && x.gender) : (x && x.name || ''); }
  function me() {
    return (MP.snap && MP.snap.players || []).find((p) => p.id === pid) || null;
  }
  function zone(id) {
    const s = G() && G().state;
    return s ? s.zones.find((z) => z.id === id) : null;
  }
  function ownerClan(owner) {
    return window.ORE.data && ORE.data.CLAN[owner] ? T(ORE.data.CLAN[owner].name) : (owner || T('中立'));
  }

  function ensureHud() {
    if (hud) return;
    fetch(base + '/health').then((r) => r.json()).then((j) => { MP.storage = (j.storage || '') + ' · online ' + (j.online || 0); }).catch(() => {});
    if (!MP._fxTimer) MP._fxTimer = setInterval(() => { if (MP.snap) { updateWorldFx(); renderBattles(); } }, 700);
    document.body.classList.add('mp-mode');
    document.body.classList.add('mp-hud-on');
    try { if (window.ORE.ui && ORE.ui.closeModal) ORE.ui.closeModal(); } catch (e) {}
    const panel = document.getElementById('panel');
    if (!panel) return;
    hud = document.createElement('div');
    hud.id = 'mpPanel';
    hud.innerHTML = `
      <div class="mp-tabs" id="mpTabs">
        <button type="button" data-mptab="war">${esc(T('战争'))}</button>
        <button type="button" data-mptab="army">${esc(T('军团'))}</button>
        <button type="button" data-mptab="breed">${esc(T('婚育'))}</button>
        <button type="button" data-mptab="market">${esc(T('市场'))}</button>
      </div>
      <div class="mp-recruit-box"><input id="mpRecruitN" type="number" min="1" max="20" value="1" aria-label="recruit count"><span id="mpRecruitTotal">0.0000000001 BNB</span><button class="btn wide mp-mintbtn" type="button" data-mp="recruit">${esc(T('招募士兵'))}</button></div>
      <div class="mp-me" id="mpMe"></div>
      <div class="mp-zone" id="mpZone"></div>
      <div class="mp-battles" id="mpBattles"></div>
      <div class="mp-board" id="mpBoard"></div>
      <button class="btn ghost wide mp-exit-inline" id="mpExit" type="button">${esc(T('退出多人'))}</button>
    `;
    panel.appendChild(hud);
    const rn = document.getElementById('mpRecruitN');
    if (rn) rn.addEventListener('input', () => {
      const n = Math.max(1, Math.min(20, Math.floor(Number(rn.value) || 1)));
      rn.value = n;
      const tot = document.getElementById('mpRecruitTotal');
      if (tot) tot.textContent = (n * 0.0000000001).toFixed(10) + ' BNB';
    });
    hud.querySelectorAll('[data-mptab]').forEach((b) => b.addEventListener('click', () => {
      mpTab = b.dataset.mptab;
      if (mpTab === 'army') { openMpArmy(); }
      if (mpTab === 'breed') { openMpBreed(); }
      if (mpTab === 'market') { openMpMarket(); }
      render();
    }));
    document.getElementById('mpExit').addEventListener('click', () => {
      const u = new URL(location.href); u.searchParams.delete('mp'); location.href = u.toString();
    });
    hud.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mp]');
      if (!b) return;
      const act = b.dataset.mp;
      if (act === 'attack') doAttack(b.dataset.zone);
      if (act === 'recruit') doRecruit();
      if (act === 'station') openGarrison(b.dataset.zone);
      if (act === 'withdraw') doWithdraw(b.dataset.zone);
      if (act === 'burn') doBurn();
      if (act === 'burn-options') { syncArmyMirror(); ORE.ui.openExtract(); }
      if (act === 'burn-retry') retryBurnPayout();
      if (act === 'soldier') showSoldier(b.dataset.id);
      if (act === 'zone') { select(Number(b.dataset.zone)); }
      if (act === 'attack-pct') adjustAttack(b.dataset.pct);
      if (act === 'select') select(Number(b.dataset.zone));
      if (act === 'marry') doMarry();
      if (act === 'breed') doBreed();
      if (act === 'market-list') doMarketList();
      if (act === 'market-buy') doMarketBuy(b.dataset.id);
      if (act === 'market-cancel') doMarketCancel(b.dataset.id);
    });
    // Shared-world settings modal instead of the local save/settings panel.
    try {
      if (window.ORE.ui) {
        ORE.ui.openSettings = () => {
          const m = me();
          const body = '<div class="note gold"><b>' + esc(T('多人同服')) + '</b><br>'
            + esc(T('服务器')) + ': ' + esc(base) + '<br>'
            + 'PostgreSQL / Redis: ' + esc(MP.storage || '—') + '<br>'
            + 'Wallet: ' + esc(m ? m.id : '—') + '<br>'
            + 'NFT: ' + esc(m ? (m.nft || 0) : 0) + ' · tokenId: ' + esc(m ? (m.nftTokenIds || []).join(', ') : '') + '<br>'
            + 'Chain ORE: ' + esc(m && m.chainOre != null ? m.chainOre : '—') + '<br>'
            + 'Game ORE: ' + esc(m ? Math.floor(m.ore) : 0) + '</div>'
            + '<p class="fine">' + esc(T('一个钱包只能加入一个势力')) + '</p>';
          ORE.ui.openRaw({ type: 'mpSettings', kicker: 'SYSTEM · ' + T('多人同服'), title: T('多人同服'), sub: T('服务器设置'), body, footer: '<div class="spacer"></div><button class="btn ghost" data-act="close">' + T('关闭') + '</button>' });
        };
      }
    } catch (e) {}
    try {
      if (window.ORE.ui && !ORE.ui._mpArmyWrapped) {
        ORE.ui._mpArmyWrapped = true;
        const origClick = ORE.ui.onModalClick;
        ORE.ui.onModalClick = function (e) {
          const b = e.target.closest('[data-act]');
          if (b && MP.snap) {
            const act = b.dataset.act;
            if (act === 'extract-go') {
              e.preventDefault(); e.stopPropagation();
              const set = ORE.ui.currentExtract ? ORE.ui.currentExtract() : null;
              if (set && set.ids && set.ids.length) doBurn(set.ids);
              return;
            }
            if (act === 'burn-options') { e.preventDefault(); e.stopPropagation(); syncArmyMirror(); ORE.ui.openExtract(); return; }
            if (act === 'mp-onchain-market') { e.preventDefault(); e.stopPropagation(); ORE.ui.closeModal(); openOnchainMarket(); return; }
            if (act === 'mp-onchain-refresh') { e.preventDefault(); e.stopPropagation(); loadOnchainListings(); return; }
            if (act === 'mp-onchain-back') { e.preventDefault(); e.stopPropagation(); ORE.ui.closeModal(); openMpMarket(); return; }
            if (act === 'mp-onchain-list') { e.preventDefault(); e.stopPropagation(); onchainList(); return; }
            if (act === 'mp-onchain-cancel') { e.preventDefault(); e.stopPropagation(); onchainCancel(Number(b.dataset.id)); return; }
            if (act === 'mp-onchain-buy') { e.preventDefault(); e.stopPropagation(); onchainBuy(Number(b.dataset.id)); return; }
            if (act === 'market-list-go') {
              e.preventDefault(); e.stopPropagation();
              const sel = document.getElementById('listSoldier'), price = document.getElementById('listPrice');
              if (sel && sel.value && price) post('/market/list', { soldierId: sel.value, price: Math.floor(Number(price.value) || 0) }).then((r) => { if (r) openMpMarket(); });
              return;
            }
            if (act === 'market-buy') { e.preventDefault(); e.stopPropagation(); post('/market/buy', { listingId: b.dataset.id }).then((r) => { if (r) openMpMarket(); }); return; }
            if (act === 'market-cancel') { e.preventDefault(); e.stopPropagation(); post('/market/cancel', { listingId: b.dataset.id }).then((r) => { if (r) openMpMarket(); }); return; }
            if (act === 'open-army') { e.preventDefault(); e.stopPropagation(); openMpArmy(); return; }
            if (act === 'mp-birth-mint') {
              e.preventDefault(); e.stopPropagation();
              mintChild(b.dataset.id);
              return;
            }
            if (act === 'breed-marry') {
              e.preventDefault(); e.stopPropagation();
              const f = ORE.ui.breed && ORE.ui.breed.f, m = ORE.ui.breed && ORE.ui.breed.m;
              if (f && m) marryPair(m, f).then(() => openMpBreed('nursery'));
              return;
            }
            if (act === 'breed-go') {
              e.preventDefault(); e.stopPropagation();
              post('/breed', { fatherId: b.dataset.a, motherId: b.dataset.b }).then((r) => { if (r) openMpBreed('nursery'); });
              return;
            }
            if (act === 'open-breed') { e.preventDefault(); e.stopPropagation(); ORE.ui.closeModal(); mpTab = 'breed'; openMpBreed(); return; }
            if (act === 'open-market') { e.preventDefault(); e.stopPropagation(); ORE.ui.closeModal(); mpTab = 'market'; render(); return; }
            if (act === 'army-station') {
              e.preventDefault(); e.stopPropagation();
              const zid = selected != null ? selected : Number(b.dataset.zone);
              doStation(zid, 1).then(() => openMpArmy());
              return;
            }
            if (act === 'army-withdraw') {
              e.preventDefault(); e.stopPropagation();
              const so = (me()?.roster || []).find((x) => x.id === b.dataset.id);
              if (so && so.zoneId != null) doWithdraw(so.zoneId).then(() => openMpArmy());
              return;
            }
            if (act === 'army-list') {
              e.preventDefault(); e.stopPropagation();
              const price = Number(window.prompt('价格 ORE') || 0);
              if (price > 0) post('/market/list', { soldierId: b.dataset.id, price }).then(() => openMpArmy());
              return;
            }
            if (act === 'army-cancel') {
              e.preventDefault(); e.stopPropagation();
              const l = (MP.snap.listings || []).find((x) => x.soldierId === b.dataset.id);
              if (l) doMarketCancel(l.id).then(() => openMpArmy());
              return;
            }
          }
          return origClick.call(this, e);
        };
      }
    } catch (e) {}
    // The local UI tick would overwrite the shared-world top bar/feed with the
    // local economy. Keep the shell, but let the server snapshot drive it.
    try {
      if (window.ORE.ui) {
        ORE.ui.tick = function () {};
        ORE.ui.updateFeed = function () {};
        if (!ORE.ui._mpChainWrapped) {
          ORE.ui._mpChainWrapped = true;
          const origMint = ORE.ui.chainMint;
          const origSync = ORE.ui.chainSync;
          ORE.ui.chainMint = async function () {
            const r = await origMint.call(this);
            await syncNFTs();
            return r;
          };
          ORE.ui.chainSync = async function () {
            const r = await syncNFTs();
            return r;
          };
        }
      }
    } catch (e) {}
    try {
      if (window.ORE.ui && !ORE.ui._mpBreedWrapped) {
        ORE.ui._mpBreedWrapped = true;
        const origNursery = ORE.ui.breedNursery;
        ORE.ui.breedNursery = function () {
          let html = origNursery.call(this);
          const pending = ((MP.snap && MP.snap.births) || []).filter((b) => b.ready);
          if (pending.length) {
            html += '<div class="sect" style="margin-top:14px"><div class="sect-h"><h3>' + T('待铸造子嗣') + '</h3><span>' + pending.length + ' ' + T('个') + '</span></div>'
              + pending.map((b) => '<div class="couple"><div class="cp"><span class="pav">◈</span><div><b>' + esc(b.child ? sname({ name: b.child.name, gender: b.child.gender }) : T('新生儿')) + '</b><span>' + esc(b.child ? b.child.clsName || b.child.cls : '') + ' · ' + T('需要铸造 NFT') + '</span></div></div><div class="ca"><button class="btn sm" data-act="mp-birth-mint" data-id="' + esc(b.id) + '">' + T('铸造士兵 NFT') + '</button></div></div>').join('')
              + '</div>';
          }
          return html;
        };
      }
    } catch (e) {}
    try {
      if (window.ORE.ui && !ORE.ui._mpOnchainWrapped) {
        ORE.ui._mpOnchainWrapped = true;
        ORE.ui.modal_onchain = function () {
          return this.shell({
            kicker: 'MARKET · ' + T('链上'), title: T('链上士兵市场'),
            sub: T('NFT 直接链上成交，士兵属性上链；不携带口袋 ORE。'),
            body: '<div id="ocBody">' + T('读取链上挂牌…') + '</div>', wide: true,
            footer: '<div class="spacer"></div><button class="btn ghost" data-act="mp-onchain-refresh">' + T('刷新') + '</button><button class="btn ghost" data-act="mp-onchain-back">' + T('返回市场') + '</button><button class="btn" data-act="close">' + T('关闭') + '</button>',
          });
        };
      }
    } catch (e) {}
    try {
      if (window.ORE.ui && !ORE.ui._mpMarketWrapped) {
        ORE.ui._mpMarketWrapped = true;
        ORE.ui.modal_market = function () {
          return this.shell({
            kicker: 'MARKET · ' + T('黑市'), title: T('士兵与 ORE'),
            sub: T('士兵按战力与口袋 ORE 交易；口袋 ORE 随士兵一起转移。'),
            body: mpMarketBody(), wide: true,
            footer: '<div class="spacer"></div><button class="btn ghost" data-act="mp-onchain-market">' + T('链上市场') + '</button><button class="btn ghost" data-act="open-army">' + T('军团') + '</button><button class="btn" data-act="close">' + T('关闭') + '</button>',
          });
        };
      }
    } catch (e) {}
    try {
      if (window.ORE && ORE.game) {
        // Single-player UI is reused only as a shell. Breeding cost must match the
        // server: raw ATK+DEF+SPD of both parents, and the game wallet is not used.
        ORE.game.breedCost = function (a, b) {
          if (!a || !b) return 0;
          return Math.round((a.atk + a.def + a.spd) + (b.atk + b.def + b.spd));
        };
        ORE.game.canBreed = function (a, b) {
          if (!a || !b) return { ok: false, error: 'select a married pair' };
          if (a.spouse !== b.id || b.spouse !== a.id) return { ok: false, error: 'marry first' };
          if (a.status !== 'idle' || b.status !== 'idle') return { ok: false, error: 'both must be idle' };
          if (a.pregnant || b.pregnant) return { ok: false, error: 'already pregnant' };
          if (Math.max(a.cdUntil || 0, b.cdUntil || 0) > Date.now()) return { ok: false, error: 'breeding cooldown' };
          if (a.childCount >= a.fertility || b.childCount >= b.fertility) return { ok: false, error: 'fertility exhausted' };
          return { ok: true };
        };
      }
    } catch (e) {}
    const map = window.ORE && ORE.world && ORE.world.map;
    if (map) {
      map.onPick = (id) => {
        if (id < 0) { selected = null; MP.selected = null; map.setSelected(-1); renderZone(); }
        else select(id);
      };
      map.setMe(G().state.clan);
    }
  }

  function renderStats() {
    if (!hud) return;
    const m = me();
    const online = MP.snap ? MP.snap.online : 0;
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('mArmy', T('总兵') + ' ' + (m ? m.troops : 0) + ' · ' + T('战力') + ' ' + (m ? m.power : 0));
    set('mPool', T('在线') + ' ' + online + ' · ' + T('链上 ORE') + ' ' + (m && m.chainOre != null ? Number(m.chainOre).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'));
    set('ckArmy', m ? m.troops : 0);
    set('ckPower', m ? m.power : 0);
    set('ckPool', MP.snap && MP.snap.economy ? Number(MP.snap.economy.minePool || 0).toLocaleString() : '0');
    const chip = document.getElementById('chipOre');
    if (chip) {
      const pocket = m ? (m.roster || []).reduce((a, x) => a + (Number(x.pocket) || 0), 0) : 0;
      const chain = m && m.chainOre != null ? Number(m.chainOre) : null;
      const fmt = (v) => v == null ? '—' : Math.floor(Number(v)).toLocaleString('en-US');
      chip.classList.add('dual');
      chip.innerHTML = '<span class="ore-line"><span class="ore-k"><i class="zn"></i>' + esc(T('士兵钱包')) + '</span><b>' + esc(fmt(pocket)) + '</b><em>ORE</em></span>'
        + '<span class="ore-line"><span class="ore-k"><i class="zn"></i>' + esc(T('链上钱包')) + '</span><b>' + esc(fmt(chain)) + '</b><em>ORE</em></span>';
      chip.title = T('士兵钱包') + ' ORE: ' + fmt(pocket) + ' · ' + T('链上钱包') + ' ORE: ' + fmt(chain);
    }
    if (m) {
      const meBox = document.getElementById('mpMe');
      if (meBox) meBox.innerHTML = '<b>' + esc(ownerClan(m.clan)) + '</b><span>' + esc(m.name || '') + ' · ' + esc(T('我的军团')) + '</span>';
    }
  }

  function select(id) {
    selected = id; MP.selected = id;
    // Clicking the map is a War-panel action. If the user was in Legion,
    // switch back to War instead of flashing a zone panel and then restoring
    // the Legion view on the next render.
    mpTab = 'war';
    const map = window.ORE && ORE.world && ORE.world.map;
    if (map) map.setSelected(id);
    renderTabs();
    render();
  }

  MP.select = select;
  MP.openGarrison = openGarrison;
  MP.me = me;
  MP.attack = doAttack;
  MP.recruit = doRecruit;
  function renderZone() {
    const box = document.getElementById('mpZone');
    if (!box) return;
    if (selected == null) {
      const empty = '<div class="mp-empty">' + esc(T('选择一块与己方相邻的敌方地块')) + '</div>';
      if (box._html !== empty || !box.innerHTML) { box._html = empty; box.innerHTML = empty; }
      return;
    }
    const z = zone(selected);
    if (!z) return;
    const m = me();
    const owner = MP.snap && MP.snap.owners ? MP.snap.owners[String(z.id)] : z.owner;
    const baseDef = MP.snap && MP.snap.defenses ? (MP.snap.defenses[String(z.id)] || 0) : 0;
    const gids = (MP.snap && MP.snap.garrisons && MP.snap.garrisons[String(z.id)]) || [];
    const zs = MP.snap && MP.snap.zoneStats ? MP.snap.zoneStats[String(z.id)] : null;
    const garr = zs ? Number(zs.garrison) : (MP.snap && MP.snap.garrisonCount && MP.snap.garrisonCount[String(z.id)] != null ? Number(MP.snap.garrisonCount[String(z.id)]) : gids.length);
    const mine = m && owner === m.clan;
    const base = z.kind === 'base';
    const adjacent = !!(m && z.nb && z.nb.some((n) => MP.snap.owners[String(n)] === m.clan));
    const can = !!(m && !mine && !base && adjacent && m.troops > 0);
    const old = document.getElementById('mpAttackR');
    const max = m ? Math.max(1, m.troops) : 1;
    const val = old ? Math.min(max, Math.max(1, Number(old.value) || 1)) : Math.min(5, max);
    const col = window.ORE.data && ORE.data.CLAN[owner] ? ORE.data.CLAN[owner].color : '#888';
    const def = zs ? Number(zs.defense) : ((MP.snap.defensePower && MP.snap.defensePower[String(z.id)] != null) ? Number(MP.snap.defensePower[String(z.id)]) : (baseDef + (MP.snap.garrisonPower?.[String(z.id)] || 0) + Number(MP.snap.forts?.[String(z.id)] || 0) * 12));
    const rate = zs ? Number(zs.rate).toFixed(2) : ((Number(z.weight) || 1) * 0.55 * 12).toFixed(2);
    const target = m ? (m.clan === owner ? T('己方领地') : T('敌方')) : '';
    const html = ''
      + '<div class="z-h"><div class="z-t"><b>' + esc(z.code || z.name) + '</b><span>' + esc(z.en || '') + '</span></div><span class="cpill" style="--c:' + col + ';--f:#000">' + esc(ownerClan(owner)) + '</span></div>'
      + '<div class="z-stats"><div><span>' + esc(T('产出')) + '</span><b>' + esc(rate) + '</b><em>ORE / 分</em></div><div><span>' + esc(T('防御')) + '</span><b>' + esc(def) + '</b><em>' + esc(base ? T('不可攻击') : target) + '</em></div><div><span>' + esc(T('驻军')) + '</span><b>' + esc(garr) + '</b><em>' + esc(mine ? T('驻防中') : '') + '</em></div></div>'
      + '<div class="z-neighbors">' + (z.nb || []).slice(0, 8).map((n) => { const q = zone(n); if (!q) return ''; const o = MP.snap.owners[String(q.id)]; const c = window.ORE.data && ORE.data.CLAN[o] ? ORE.data.CLAN[o].color : '#3a3a3a'; return '<button class="nb" data-mp="zone" data-zone="' + q.id + '" style="--c:' + c + '"><i></i>' + esc(q.code) + '</button>'; }).join('') + '</div>'
      + (can ? '<div class="order"><div class="o-h"><b>' + esc(T('发动突袭')) + '</b><span>' + esc(T('从相邻己方地块出发')) + '</span></div><div class="o-pick"><button class="step" type="button" data-mp="attack-pct" data-pct="-">−</button><input type="range" id="mpAttackR" min="1" max="' + max + '" value="' + val + '"><button class="step" type="button" data-mp="attack-pct" data-pct="+">+</button><b class="o-n" id="mpAttackN">' + val + '</b></div><div class="o-q"><button type="button" data-mp="attack-pct" data-pct="0.25">¼</button><button type="button" data-mp="attack-pct" data-pct="0.5">½</button><button type="button" data-mp="attack-pct" data-pct="1">' + esc(T('全部')) + '</button><button type="button" data-mp="attack-pct" data-pct="need">' + esc(T('够赢即可')) + '</button></div><div class="o-est" id="mpAttackEst"></div><button class="btn big" type="button" data-mp="attack" data-zone="' + z.id + '">' + esc(T('发动突袭')) + '</button></div>' : '')
      + (!base && !mine && !adjacent ? '<p class="hint"><b style="color:#ff8a80">' + esc(T('必须与己方地块相邻')) + '</b></p>' : '')
      + (mine && !base ? '<div class="z-acts"><button class="btn" type="button" data-mp="station" data-zone="' + z.id + '">' + esc(T('调防')) + '</button><button class="btn ghost" type="button" data-mp="withdraw" data-zone="' + z.id + '">' + esc(T('撤回驻军')) + '</button></div>' : '')
      + '<p class="hint">' + esc(base ? T('基地不可被攻击') : mine ? T('距基地越远，产矿越高') : '') + '</p>';
    if (box._html === html && box.innerHTML) { updateMpEstimate(); return; }
    box._html = html;
    box.innerHTML = html;
    const r = document.getElementById('mpAttackR');
    if (r) r.oninput = () => { const n = document.getElementById('mpAttackN'); if (n) n.textContent = r.value; updateMpEstimate(); };
    updateMpEstimate();
  }
  function updateMpEstimate() {
    const box = document.getElementById('mpAttackEst');
    const range = document.getElementById('mpAttackR');
    if (!box || !range) return;
    const m = me();
    const z = selected != null ? zone(selected) : null;
    if (!m || !z) { box.innerHTML = ''; return; }
    const zs = MP.snap.zoneStats?.[String(z.id)] || {};
    const def = Math.max(1, Number(zs.defense) || 0);
    const n = Math.max(1, Math.min(Number(range.value) || 1, Number(range.max) || 1));
    const idle = (m.roster || []).filter((x) => x.status === 'idle').sort((a, b) => (b.atk + b.def + b.spd) - (a.atk + a.def + a.spd));
    const chosen = idle.slice(0, n);
    const avgAtk = chosen.length ? chosen.reduce((a, x) => a + x.atk, 0) / chosen.length : 0;
    const power = Math.max(1, Math.floor(n * (1 + avgAtk / 30)));
    const ratio = power / Math.max(1, def);
    let chance;
    if (ratio >= 1.15) chance = 1;
    else if (ratio <= 0.90) chance = 0;
    else chance = (1.15 - ratio) / 0.25;
    const winLoss = Math.max(0, n - Math.max(1, Math.floor(n * 0.6)));
    const loseLoss = n;
    const vault = Math.max(0, Number(MP.snap.vaults?.[String(z.id)]) || 0);
    const cls = chance >= 0.7 ? 'good' : chance >= 0.4 ? 'warn' : 'bad';
    box.innerHTML = T('胜率') + ' <b class="' + cls + '">' + Math.round(chance * 100) + '%</b>'
      + ' · ' + T('战力') + ' <b>' + power + '</b> vs ' + T('防御') + ' <b>' + def + '</b>'
      + '<br>' + T('若胜预计损失') + ' <b>' + winLoss + '</b> ' + T('人') + '；' + T('若败损失') + ' <b>' + loseLoss + '</b> ' + T('人')
      + '<br>' + T('攻占后夺取地块金库') + ' <b>' + vault.toFixed(2) + ' ORE</b>，' + T('按战力分给参战士兵');
  }
  function renderBattles() {
    const box = document.getElementById('mpBattles');
    if (!box) return;
    const list = (MP.snap && MP.snap.battles || []).slice().sort((a, b) => a.resolveAt - b.resolveAt);
    if (!list.length) {
      const empty = '<div class="mp-sec-h">' + esc(T('战斗进行中')) + '</div><div class="mp-empty small">' + esc(T('没有战斗')) + '</div>';
      if (box._html !== empty || !box.innerHTML) { box._html = empty; box.innerHTML = empty; }
      return;
    }
    const html = '<div class="mp-sec-h">' + esc(T('战斗进行中')) + '</div>' + list.slice(0, 8).map((b) => {
      const left = Math.max(0, Math.ceil((b.resolveAt - Date.now()) / 1000));
      const arrive = Math.max(0, Math.ceil(((b.arriveAt || 0) - Date.now()) / 1000));
      return '<div class="mp-battle"><b>' + esc(b.code) + '</b><span>' + esc(arrive > 0 ? T('行军中') : T('攻击中')) + ' · ' + left + 's · ' + esc(b.troops) + ' ' + esc(T('士兵')) + '</span></div>';
    }).join('');
    if (box._html === html && box.innerHTML) { updateMpEstimate(); return; }
    box._html = html;
    box.innerHTML = html;
  }

  function renderBoard() {
    const box = document.getElementById('mpBoard');
    if (!box) return;
    const list = (MP.snap && MP.snap.players || []).slice(0, 10);
    box.innerHTML = '<div class="mp-sec-h">' + esc(T('排行榜')) + '</div>' + list.map((p, i) => '<div class="mp-rank"><span>' + (i + 1) + '</span><b style="color:' + (window.ORE.data && ORE.data.CLAN[p.clan] ? ORE.data.CLAN[p.clan].color : '#aaa') + '">' + esc(p.name) + '</b><em>' + esc(p.power) + '</em></div>').join('');
  }

  function renderFeed() {
    const box = document.getElementById('feedList');
    if (!box) return;
    const events = (MP.snap && MP.snap.events || []).slice().reverse();
    box.innerHTML = (events.length ? events.slice(0, 12).map((ev) => {
      const who = esc(ev.player || '');
      let text = '';
      MP._fxSeen = MP._fxSeen || new Set();
      if (!MP._fxSeen.has(ev.id) && (ev.type === 'battle' || ev.type === 'capture' || ev.type === 'defeat')) { MP._fxSeen.add(ev.id); fxForEvent(ev); }
      if (ev.type === 'join') text = who + ' ' + T('加入了战场');
      else if (ev.type === 'capture') text = who + ' ' + T('占领') + ' <b>' + esc(ev.code) + '</b>';
      else if (ev.type === 'attack') text = who + ' ' + T('攻击') + ' <b>' + esc(ev.code) + '</b>';
      else if (ev.type === 'defeat') text = who + ' ' + T('失败') + ' <b>' + esc(ev.code) + '</b>';
      else if (ev.type === 'battle') text = who + ' ' + T('战斗') + ' <b>' + esc(ev.code) + '</b>';
      else if (ev.type === 'recruit') text = who + ' ' + T('招募');
      else if (ev.type === 'cancel') text = who + ' ' + T('取消');
      else text = who;
      return '<div class="mp-event">' + text + '</div>';
    }).join('') : '<div class="mp-empty small">' + esc(T('暂无战报')) + '</div>');
  }

  function renderTabs() {
    document.querySelectorAll('#mpTabs [data-mptab]').forEach((b) => b.classList.toggle('on', b.dataset.mptab === mpTab));
  }
  function renderArmy() {
    const box = document.getElementById('mpZone');
    const m = me();
    if (!box || !m) return;
    const rows = (m.roster || []).slice().sort((a, b) => (b.atk + b.def + b.spd) - (a.atk + a.def + a.spd));
    box.innerHTML = '<div class="mp-sec-h">' + esc(T('我的士兵')) + ' · ' + rows.length + '</div>'
      + (rows.length ? rows.map((x) => '<div class="mp-soldier" data-mp="soldier" data-id="' + esc(x.id) + '"><b>' + esc(sname(x)) + '</b><span>' + esc(x.clsName) + ' · ' + esc(T('等级')) + ' ' + esc(x.tier) + ' · ' + esc(T('世代')) + ' ' + esc(x.gen) + '</span><em>ATK ' + esc(x.atk) + ' · DEF ' + esc(x.def) + ' · SPD ' + esc(x.spd) + ' · P ' + esc((x.pocket || 0).toFixed(2)) + '</em><i class="' + esc(x.status) + '">' + esc(x.status === 'idle' ? T('待命') : x.status === 'listed' ? T('已挂牌') : x.status === 'pregnant' ? T('孕育中') : x.status === 'attacking' ? T('攻击中') : x.status === 'dead' ? T('阵亡') : x.status) + '</i></div>').join('') : '<div class="mp-empty">' + esc(T('暂无士兵')) + '</div>')
      + '<button class="btn ghost wide mp-burn" data-mp="burn-options" type="button">' + esc(T('烧兵提取（可选士兵）')) + '</button>'
      + (getBurnPending() ? '<button class="btn wide" data-mp="burn-retry" type="button">' + esc(T('领取未完成烧兵 ORE')) + '</button>' : '');
  }
  function renderBreed() {
    const box = document.getElementById('mpZone');
    const m = me();
    if (!box || !m) return;
    const idle = (m.roster || []).filter((x) => x.status === 'idle');
    const males = idle.filter((x) => x.gender === 'm');
    const females = idle.filter((x) => x.gender === 'f');
    const opt = (list) => list.map((x) => '<option value="' + esc(x.id) + '">' + esc(sname(x)) + ' · ' + esc(x.clsName) + ' · ' + esc(T('等级')) + ' ' + esc(x.tier) + '</option>').join('');
    const preg = (m.roster || []).filter((x) => x.status === 'pregnant');
    const married = (m.roster || []).filter((x) => x.spouse);
    const pairCost = (() => {
      const a = document.getElementById('mpBreedM'), b = document.getElementById('mpBreedF');
      const x = a && (m.roster || []).find((s) => s.id === a.value);
      const y = b && (m.roster || []).find((s) => s.id === b.value);
      return x && y ? (x.atk + x.def + x.spd + y.atk + y.def + y.spd) : 0;
    })();
    box.innerHTML = '<div class="mp-sec-h">' + esc(T('婚育')) + '</div>'
      + '<div class="mp-form"><label>' + esc(T('男方')) + '</label><select id="mpBreedM">' + (males.length ? opt(males) : '<option value="">' + esc(T('没有合适男性')) + '</option>') + '</select>'
      + '<label>' + esc(T('女方')) + '</label><select id="mpBreedF">' + (females.length ? opt(females) : '<option value="">' + esc(T('没有合适女性')) + '</option>') + '</select>'
      + '<button class="btn ghost" data-mp="marry" type="button">' + esc(T('结为伴侣')) + ' · 30 ORE</button>'
      + '<button class="btn" data-mp="breed" type="button">' + esc(T('繁衍')) + ' · ' + pairCost + ' ORE</button></div>'
      + (preg.length ? '<div class="mp-sub">' + preg.map((x) => esc(x.name) + ' · ' + esc(T('孕育中')) + ' · ' + Math.max(0, Math.ceil(((x.dueAt || 0) - Date.now()) / 1000)) + 's').join('<br>') + '</div>' : '')
      + (married.length ? '<div class="mp-sub">' + married.map((x) => esc(x.name) + ' · ' + esc(T('配偶')) + ' ' + esc(sname(m.roster.find((s) => s.id === x.spouse) || {})) + ' · ' + esc(T('生育')) + ' ' + esc(x.childCount) + '/' + esc(x.fertility) + ' · ' + esc(T('冷却')) + ' ' + Math.max(0, Math.ceil(((x.cdUntil || 0) - Date.now()) / 3600000)) + 'h').join('<br>') + '</div>' : '');
  }
  function renderMarket() {
    const box = document.getElementById('mpZone');
    const m = me();
    if (!box || !m) return;
    const idle = (m.roster || []).filter((x) => x.status === 'idle');
    const mine = (MP.snap.listings || []).filter((x) => x.sellerId === m.id);
    const all = (MP.snap.listings || []).slice().sort((a, b) => a.price - b.price);
    const opt = idle.map((x) => '<option value="' + esc(x.id) + '">' + esc(sname(x)) + ' · ' + esc(x.clsName) + '</option>').join('');
    box.innerHTML = '<div class="mp-sec-h">' + esc(T('市场')) + ' · ' + all.length + '</div>'
      + '<div class="mp-form"><label>' + esc(T('挂牌出售')) + '</label><select id="mpListS">' + (opt || '<option value="">' + esc(T('没有可挂牌士兵')) + '</option>') + '</select><div class="mp-inline"><input id="mpListP" type="number" min="1" placeholder="' + esc(T('价格')) + ' ORE"><button class="btn" data-mp="market-list" type="button">' + esc(T('挂牌')) + '</button></div></div>'
      + (mine.length ? '<div class="mp-sub">' + mine.map((x) => esc(sname(x.soldier)) + ' · ' + esc(x.price) + ' ORE <button data-mp="market-cancel" data-id="' + esc(x.id) + '">' + esc(T('取消')) + '</button>').join('<br>') + '</div>' : '')
      + '<div class="mp-list">' + (all.length ? all.map((x) => '<div class="mp-listing"><b>' + esc(sname(x.soldier)) + '</b><span>' + esc(x.soldier.clsName) + ' · ATK ' + esc(x.soldier.atk) + '</span><em>' + esc(x.price) + ' ORE</em><button data-mp="market-buy" data-id="' + esc(x.id) + '" type="button" ' + (x.sellerId === m.id ? 'disabled' : '') + '>' + esc(T('购买')) + '</button></div>').join('') : '<div class="mp-empty small">' + esc(T('市场暂无挂牌')) + '</div>') + '</div>'
;
  }
  function renderPool() {
    const box = document.getElementById('mpZone');
    const m = me();
    if (!box || !m) return;
    const pool = MP.snap.pool || { ore: 0, shares: 0 };
    box.innerHTML = '<div class="mp-sec-h">' + esc(T('流动性')) + '</div>'
      + '<div class="mp-zone-grid"><span>POOL ORE</span><b>' + esc(Math.floor(pool.ore || 0)) + '</b><span>LP</span><b>' + esc(Math.floor(m.lpShares || 0)) + '</b></div>'
      + '<div class="mp-form"><label>' + esc(T('添加流动性')) + '</label><div class="mp-inline"><input id="mpPoolN" type="number" min="1" placeholder="ORE"><button class="btn" data-mp="pool-add">' + esc(T('添加')) + '</button></div>'
      + '<label>' + esc(T('移除流动性')) + '</label><div class="mp-inline"><input id="mpPoolR" type="number" min="1" placeholder="LP"><button class="btn ghost" data-mp="pool-remove">' + esc(T('移除')) + '</button></div></div>';
  }
  function showSoldier(id) {
    const m = me();
    const x = m && (m.roster || []).find((s) => s.id === id);
    if (!x) return;
    const old = document.getElementById('mpSoldierModal');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'mpSoldierModal';
    el.className = 'mp-soldier-modal';
    const spouse = (m.roster || []).find((s) => s.id === x.spouse);
    const cd = Math.max(0, Math.ceil(((x.cdUntil || 0) - Date.now()) / 3600000));
    el.innerHTML = '<div class="mp-soldier-card"><button class="mp-x" type="button">×</button>'
      + '<div class="kicker">' + esc(T('士兵详情')) + '</div><h2>' + esc(sname(x)) + '</h2>'
      + '<div class="mp-soldier-grid">'
      + '<div><span>' + esc(T('职业')) + '</span><b>' + esc(x.clsName) + '</b></div>'
      + '<div><span>' + esc(T('品阶')) + '</span><b>' + esc(x.tier) + '</b></div>'
      + '<div><span>' + esc(T('世代')) + '</span><b>' + esc(x.gen) + '</b></div>'
      + '<div><span>' + esc(T('性别')) + '</span><b>' + esc(x.gender === 'm' ? T('男') : T('女')) + '</b></div>'
      + '<div><span>ATK</span><b>' + esc(x.atk) + '</b></div>'
      + '<div><span>DEF</span><b>' + esc(x.def) + '</b></div>'
      + '<div><span>SPD</span><b>' + esc(x.spd) + '</b></div>'
      + '<div><span>' + esc(T('口袋')) + '</span><b>' + esc((x.pocket || 0).toFixed(2)) + '</b></div>'
      + '<div><span>' + esc(T('状态')) + '</span><b>' + esc(x.status) + '</b></div>'
      + '<div><span>' + esc(T('配偶')) + '</span><b>' + esc(spouse ? sname(spouse) : '—') + '</b></div>'
      + '<div><span>' + esc(T('子女')) + '</span><b>' + esc((x.children || []).length) + '</b></div>'
      + '<div><span>' + esc(T('生育次数')) + '</span><b>' + esc(x.childCount) + ' / ' + esc(x.fertility) + '</b></div>'
      + '<div><span>NFT</span><b>#' + esc(x.nftId || '—') + '</b></div>'
      + '<div><span>' + esc(T('冷却')) + '</span><b>' + cd + 'h</b></div>'
      + '</div><p class="mp-note">' + esc(T('父母')) + ': ' + esc((x.parents || []).join(' · ') || '—') + '</p>'
      + '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', (e) => { if (e.target === el || e.target.classList.contains('mp-x')) el.remove(); });
  }
  function renderEconomy() {
    const box = document.getElementById('mpZone');
    if (!box) return;
    const e = MP.snap && MP.snap.economy || {};
    box.innerHTML = '<div class="mp-sec-h">' + esc(T('经济')) + '</div>'
      + '<div class="mp-econ-grid">'
      + '<div><span>' + esc(T('游戏 ORE')) + '</span><b>' + esc((e.gameOre || 0).toLocaleString()) + '</b></div>'
      + '<div><span>' + esc(T('士兵口袋')) + '</span><b>' + esc((e.pockets || 0).toLocaleString()) + '</b></div>'
      + '<div><span>' + esc(T('地块金库')) + '</span><b>' + esc((e.vaults || 0).toLocaleString()) + '</b></div>'
      + '<div><span>LP POOL</span><b>' + esc((e.poolOre || 0).toLocaleString()) + '</b></div>'
      + '<div><span>' + esc(T('矿池剩余')) + '</span><b>' + esc((e.minePool || 0).toLocaleString()) + '</b></div>'
      + '<div><span>' + esc(T('已排放')) + '</span><b>' + esc((e.emitted || 0).toLocaleString()) + '</b></div>'
      + '<div><span>' + esc(T('市场挂牌')) + '</span><b>' + esc(e.listings || 0) + '</b></div>'
      + '<div><span>' + esc(T('玩家')) + '</span><b>' + esc(e.players || 0) + '</b></div>'
      + '</div>'

  }
  function render() {
    if (!hud) return;
    if (mpTab !== 'home') document.body.classList.remove('mp-home');
    renderStats(); renderTabs();
    if (mpTab === 'army') { renderArmy(); document.getElementById('mpBattles').innerHTML=''; document.getElementById('mpBoard').innerHTML=''; }
    else if (mpTab === 'breed') { renderBreed(); document.getElementById('mpBattles').innerHTML=''; document.getElementById('mpBoard').innerHTML=''; }
    else if (mpTab === 'market') { renderMarket(); document.getElementById('mpBattles').innerHTML=''; document.getElementById('mpBoard').innerHTML=''; }
    else { renderZone(); renderBattles(); renderBoard(); }
    renderFeed();
  }

  function updateWorldFx() {
    const map = window.ORE && ORE.world && ORE.world.map;
    if (!map || !MP.snap) return;
    const meClan = me() ? me().clan : '';
    const now = Date.now();
    const all = MP.snap.battles || [];
    const marches = [];
    const battles = [];
    for (const b of all) {
      const from = b.fromZoneId != null ? b.fromZoneId : b.zoneId;
      if (b.arriveAt && now < b.arriveAt) {
        marches.push({ from, to: b.zoneId, departAt: b.startedAt, arriveAt: b.arriveAt, n: b.troops || 1, mine: b.clan === meClan, clan: b.clan });
      } else {
        battles.push({ from, to: b.zoneId, clan: b.clan, troops: b.troops || 1, atkClasses: b.atkClasses || {}, defClasses: b.defClasses || {} });
      }
    }
    try { map.setMarches(marches); map.setBattles(battles); } catch (e) {}
  }
  function fxForEvent(ev) {
    const map = window.ORE && ORE.world && ORE.world.map;
    if (!map || !ev || !ev.code) return;
    const s = G() && G().state;
    const z = s && (s.zones || []).find((x) => x.code === ev.code);
    if (!z) return;
    const color = window.ORE.data && ORE.data.CLAN[ev.clan] ? ORE.data.CLAN[ev.clan].color : '#fff';
    try { map.battle(z.id, color); } catch (e) {}
  }
  function syncBattleResults() {
    const map = window.ORE && ORE.world && ORE.world.map;
    if (!map || !MP.snap || !Array.isArray(MP.snap.results)) return;
    MP._resultSeen = MP._resultSeen || new Set();
    for (const r of MP.snap.results) {
      if (r.t < (MP.joinedAt || 0) - 5000) continue;
      const m = me();
      if (r.playerId && r.playerId !== MP.id && r.defender !== (m && m.clan)) continue;
      const key = r.t + ':' + r.zoneId + ':' + r.attacker;
      if (MP._resultSeen.has(key)) continue;
      MP._resultSeen.add(key);
      try {
        map.battleResult(r.zoneId, {
          attacker: r.attacker, attackerDead: r.attackerDead || 0,
          defender: r.defender, defenderDead: r.defenderDead || 0,
          loot: r.loot || 0,
        });
      } catch (e) {}
    }
  }
  function syncWorldRows() {
    const s = G() && G().state;
    const map = window.ORE && ORE.world && ORE.world.map;
    if (!s || !map || !MP.snap || !MP.snap.zoneStats) return;
    const m = me();
    if (m) { s.soldiers = (m.roster || []).map((x) => Object.assign({}, x, { nft: x.nftId, clan: m.clan, status: x.status === 'attacking' ? 'marching' : x.status, zone: x.zoneId })); s._idx = new Map(s.soldiers.map((x) => [x.id, x])); }
    const rows = s.zones.map((z) => {
      const zs = MP.snap.zoneStats[String(z.id)] || {};
      const mine = m && (MP.snap.owners[String(z.id)] || z.owner) === m.clan;
      const unit = mine && zs.garrison > 0 ? (m.roster || []).find((x) => x.status === 'garrison' && Number(x.zoneId) === Number(z.id)) : null;
      return {
        owner: MP.snap.owners[String(z.id)] || z.owner,
        garrison: zs.garrison || 0,
        def: zs.defense || 0,
        atk: zs.garrisonPower || 0,
        fort: MP.snap.forts?.[String(z.id)] || 0,
        vault: MP.snap.vaults?.[String(z.id)] || 0,
        borderBonus: z.borderBonus, terrain: z.terrainName || null,
        avatar: unit ? unit.id : null,
      };
    });
    for (const z of s.zones) {
      const zs = MP.snap.zoneStats[String(z.id)] || {};
      z.garrison = zs.garrison || 0;
      z.garrisonIds = (MP.snap.garrisons?.[String(z.id)] || []).slice();
      z.vault = MP.snap.vaults?.[String(z.id)] || 0;
      z.fort = MP.snap.forts?.[String(z.id)] || 0;
    }
    s.marches = (MP.snap.battles || []).filter((b) => b.arriveAt > Date.now()).map((b) => ({
      id: b.id, clan: b.clan, n: b.troops || 1, from: b.fromZoneId != null ? b.fromZoneId : b.zoneId,
      to: b.zoneId, departAt: b.startedAt, arriveAt: b.arriveAt, mine: m && b.clan === m.clan,
    }));
    s.battles = (MP.snap.battles || []).filter((b) => b.arriveAt <= Date.now()).map((b) => ({
      id: b.id, clan: b.clan, n: b.troops || 1, from: b.fromZoneId != null ? b.fromZoneId : b.zoneId,
      to: b.zoneId, startAt: b.startedAt, endAt: b.resolveAt, mine: m && b.clan === m.clan,
      atkClasses: b.atkClasses || null, defClasses: b.defClasses || null,
    }));
    const rates = s.zones.map((z) => (MP.snap.zoneStats[String(z.id)]?.rate || 0));
    try { map.setMe(s.clan); map.setZones(rows); map.setRates(rates); } catch (e) {}
  }
  function applyState(snap) {
    if (!snap) return;
    if (snap.owners) {
      MP.snap = snap;
      const s = G() && G().state;
      if (s) {
        let changed = false;
        for (const z of s.zones) {
          const key = String(z.id);
          if (!Object.prototype.hasOwnProperty.call(snap.owners, key)) continue;
          if (z.owner !== snap.owners[key]) { z.owner = snap.owners[key]; changed = true; }
        }
        if (changed && G()) {
          try {
            G().syncMap();
            if (window.ORE.world && ORE.world.map) ORE.world.map.setMe(s.clan);
            syncWorldRows();
          } catch (e) {}
        }
      }
    } else MP.snap = snap;
    syncWorldRows();
    syncBattleResults();
    ensureHud();
    updateWorldFx();
    render();
  }

  function walletProvider() {
    return (window.ORE.ui && ORE.ui.walletProvider) || window.ethereum || null;
  }
  function showAuth(message) {
    if (authEl) return;
    const hasWallet = !!walletProvider();
    authEl = document.createElement('div');
    authEl.className = 'mp-auth';
    authEl.innerHTML = '<div class="mp-auth-card">'
      + '<div class="mp-auth-kicker">◈ ' + esc(T('多人同服')) + '</div>'
      + '<h2>' + esc(T('用钱包签名登录')) + '</h2>'
      + '<p>' + esc(T('NFT 决定多人模式初始兵力。签名不会发送交易，也不会扣 Gas。')) + '</p>'
      + '<div class="mp-auth-actions"><button class="btn" id="mpAuthGo" type="button">' + esc(hasWallet ? T('连接钱包并签名') : T('未检测到钱包')) + '</button><button class="btn ghost" id="mpAuthBack" type="button">' + esc(T('退出多人')) + '</button></div>'
      + '<div class="mp-auth-msg" id="mpAuthMsg">' + esc(message || T('一个钱包只能加入一个势力')) + '</div>'
      + '</div>';
    document.body.appendChild(authEl);
    const go = document.getElementById('mpAuthGo');
    if (!hasWallet) go.disabled = true;
    else go.addEventListener('click', loginWithWallet);
    const back = document.getElementById('mpAuthBack');
    if (back) back.addEventListener('click', () => { const u = new URL(location.href); u.searchParams.delete('mp'); location.href = u.toString(); });
  }
  async function switchToBsc(provider) {
    const id = await provider.request({ method: 'eth_chainId' });
    if (String(id).toLowerCase() === '0x61') return;
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x61' }] });
    } catch (e) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{ chainId: '0x61', chainName: 'BSC Testnet', nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 }, rpcUrls: ['https://bsc-testnet-rpc.publicnode.com'], blockExplorerUrls: ['https://testnet.bscscan.com'] }],
      });
    }
  }
  let ethersLoading = null, vaultInfo = null;
  function loadEthers() {
    if (window.ethers) return Promise.resolve(window.ethers);
    if (ethersLoading) return ethersLoading;
    ethersLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/ethers.umd.min.js';
      s.onload = () => resolve(window.ethers);
      s.onerror = () => reject(new Error('ethers load failed'));
      document.head.appendChild(s);
    });
    return ethersLoading;
  }
  async function walletEthereum() {
    const provider = walletProvider();
    if (!provider) throw new Error(T('未检测到钱包'));
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (!accounts || !accounts.length) throw new Error('no wallet');
    await switchToBsc(provider);
    return { provider, address: String(accounts[0]).toLowerCase() };
  }
  async function waitReceipt(provider, hash) {
    for (let i = 0; i < 90; i++) {
      const r = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] });
      if (r) return r;
      await new Promise((x) => setTimeout(x, 1200));
    }
    throw new Error('tx timeout');
  }
  async function sendTx(provider, to, data) {
    const accounts = await provider.request({ method: 'eth_accounts' });
    const from = accounts[0];
    const hash = await provider.request({ method: 'eth_sendTransaction', params: [{ from, to, data }] });
    await waitReceipt(provider, hash);
    return hash;
  }
  async function getVaultInfo() {
    if (vaultInfo) return vaultInfo;
    const r = await fetch(base + '/vault/info');
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.error || 'vault unavailable');
    vaultInfo = j;
    return j;
  }
  async function loginWithWallet() {
    if (authBusy) return;
    const provider = walletProvider();
    if (!provider) return showAuth(T('未检测到钱包'));
    authBusy = true;
    if (authEl) authEl.classList.add('busy');
    const msg = document.getElementById('mpAuthMsg');
    const setMsg = (v) => { if (msg) msg.textContent = v; };
    try {
      setMsg(T('连接钱包...'));
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      if (!accounts || !accounts.length) throw new Error('no account');
      await switchToBsc(provider);
      const address = String(accounts[0]).toLowerCase();
      setMsg(T('请求签名...'));
      const nr = await fetch(base + '/nonce?address=' + encodeURIComponent(address));
      const nonce = await nr.json();
      if (!nr.ok) throw new Error(nonce.error || 'nonce failed');
      const msgHex = '0x' + Array.from(new TextEncoder().encode(nonce.message)).map((b) => b.toString(16).padStart(2, '0')).join('');
      const signature = await provider.request({ method: 'personal_sign', params: [msgHex, address] });
      const s = G().state;
      if (!s || s.phase !== 'playing' || !s.clan) throw new Error('enlist first');
      const manifest = { seed: s.worldSeed, zones: s.zones.map((z) => ({ id: z.id, code: z.code, kind: z.kind, home: z.home || z.sector || z.owner, weight: z.weight || 1, pos: z.vCenter || null, nb: z.nb || [] })) };
      const name = (window.ORE.i18n && ORE.i18n.current !== 'zh-Hant') ? ORE.i18n.tr((s.commander && s.commander.name) || 'Commander') : ((s.commander && s.commander.name) || 'Commander');
      setMsg(T('验证 NFT 与登录...'));
      const r = await fetch(base + '/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, signature, clan: s.clan, name, seed: s.worldSeed, manifest }),
      });
      const snap = await r.json();
      if (!r.ok || !snap.ok) throw new Error(snap.error || 'login failed');
      pid = snap.player.id;
      MP.id = pid;
      MP.token = snap.token || '';
      MP.joinedAt = Date.now();
      MP.joined = true;
      joined = true;
      if (authEl) { authEl.remove(); authEl = null; }
      applyState(snap);
      ensureHud();
      connectEvents();
      if (snap.offlineMs > 5000 && window.ORE.ui) ORE.ui.toast(T('离线收益已结算') + ' · ' + Math.floor(snap.offlineMs / 60000) + ' min', 'good');
      if (window.ORE.ui && ORE.ui.toast) ORE.ui.toast('NFT ×' + (snap.nft || 0) + ' · ' + T('已进入多人同服'), 'good');
    } catch (e) {
      setMsg(String(e && (e.shortMessage || e.message) || e));
      if (authEl) authEl.classList.remove('busy');
    } finally { authBusy = false; }
  }
  async function discoverReturningPlayer() {
    if (MP._returningChecked || MP._returningBusy || joined || authEl) return;
    const provider = walletProvider();
    if (!provider) return;
    MP._returningBusy = true;
    try {
      const accounts = await provider.request({ method: 'eth_accounts' });
      if (!accounts || !accounts.length) return;
      const address = String(accounts[0]).toLowerCase();
      MP._returningChecked = true;
      const r = await fetch(base + '/who?address=' + encodeURIComponent(address));
      const j = await r.json();
      if (!r.ok || !j.ok || !j.exists) return;
      const s = G() && G().state;
      if (!s) return;
      MP.returning = { address, clan: j.clan, name: j.name };
      s.phase = 'playing';
      s.clan = j.clan;
      s.commander = j.name || s.commander;
      s.worldSeed = s.worldSeed || (window.ORE_MP_CONFIG || {}).seed || 424242;
      try { G().syncMap(); } catch (e) {}
      try { if (window.ORE.ui && ORE.ui.showCommand) ORE.ui.showCommand(); } catch (e) {}
      tryAuth();
    } catch (e) {} finally { MP._returningBusy = false; }
  }
  function tryAuth() {
    if (joined || joining || authEl) return;
    const s = G() && G().state;
    if (!s || s.phase !== 'playing' || !s.clan) return;
    showAuth('');
  }
  function connectEvents() {
    if (source) source.close();
    source = new EventSource(base + '/events?playerId=' + encodeURIComponent(pid));
    source.onmessage = (ev) => {
      try { const snap = JSON.parse(ev.data); MP.joined = true; applyState(snap); } catch (e) {}
    };
    source.onerror = () => {};
  }

  async function doAttack(zoneId) {
    const range = document.getElementById('mpAttackR');
    const label = document.getElementById('mpAttackN');
    const troops = range ? Number(range.value) : Number(label && label.textContent) || 0;
    if (troops < 1) return;
    try {
      const r = await fetch(base + '/attack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: pid, token: MP.token, zoneId: Number(zoneId), troops }) });
      const j = await r.json();
      if (!r.ok || !j.ok) { if (window.ORE.ui) ORE.ui.toast(j.error || 'attack failed', 'bad'); return; }
      applyState(j);
    } catch (e) { if (window.ORE.ui) ORE.ui.toast('server unavailable', 'bad'); }
  }

  async function syncNFTs() {
    try {
      const r = await fetch(base + '/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: pid, token: MP.token }) });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'sync failed');
      applyState(j);
      if (window.ORE.ui) {
        ORE.ui.chainSetMsg('已同步链上 NFT：' + (j.nft || 0) + ' 个');
        if (ORE.ui.chainRender) ORE.ui.chainRender();
        ORE.ui.toast('NFT 已同步 · ' + (j.nftTokenIds || []).join(', '), 'good');
      }
      return j;
    } catch (e) { if (window.ORE.ui) ORE.ui.toast(String(e.message || e), 'bad'); }
  }
  async function mintChild(birthId) {
    try {
      const birth = ((MP.snap && MP.snap.births) || []).find((x) => String(x.id) === String(birthId));
      const fee = birth ? Number(birth.fee || 0) : 0;
      let quote = null;
      const pendingRes = await fetch(base + '/birth/pending', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: pid, token: MP.token, birthId }) });
      if (pendingRes.ok) { const pj = await pendingRes.json(); if (pj.ok) quote = pj; }
      if (!quote) {
        let feeTx;
        if (fee > 0) feeTx = await payOre(fee, T('生育费用'));
        const qr = await fetch(base + '/birth/mint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: pid, token: MP.token, birthId, txHash: feeTx }) });
        quote = await qr.json();
        if (!qr.ok || !quote.ok) throw new Error(quote.error || 'birth quote failed');
      }
      const eth = await loadEthers();
      const { provider } = await walletEthereum();
      const browser = new eth.BrowserProvider(provider);
      const signer = await browser.getSigner();
      const abi = ['function mintChildPaid((uint16,uint16,uint16,uint16,uint16,uint32,uint32,uint16,uint64,string),uint256,uint256,bytes) returns (uint256)'];
      const nft = new eth.Contract(quote.nft, abi, signer);
      const tx = await nft.mintChildPaid(quote.data, BigInt('0x' + quote.nonce), quote.deadline, quote.signature);
      await tx.wait();
      const r = await fetch(base + '/birth/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: pid, token: MP.token, birthId, txHash: tx.hash }) });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'birth confirm failed');
      applyState(j);
      syncArmyMirror();
      if (window.ORE.ui) { ORE.ui.toast('子嗣 NFT #' + j.tokenId + ' 已由玩家钱包铸造', 'good'); ORE.ui.closeModal(); }
    } catch (e) { if (window.ORE.ui) ORE.ui.toast(String(e.shortMessage || e.message || e), 'bad'); }
  }
  async function doRecruit() {
    try {
      const input = document.getElementById('mpRecruitN');
      const count = Math.max(1, Math.min(20, Math.floor(Number(input && input.value) || 1)));
      const q = await fetch(base + '/recruit/batch/prepare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: pid, token: MP.token, count }) });
      const quote = await q.json();
      if (!q.ok || !quote.ok) throw new Error(quote.error || 'recruit quote failed');
      const eth = await loadEthers();
      const { provider } = await walletEthereum();
      const browser = new eth.BrowserProvider(provider);
      const signer = await browser.getSigner();
      const abi = ['function mintPaidBatch((uint16,uint16,uint16,uint16,uint16,uint32,uint32,uint16,uint64,string)[],uint256,uint256,bytes) payable returns (uint256)'];
      const nft = new eth.Contract(quote.nft, abi, signer);
      const tx = await nft.mintPaidBatch(quote.data, BigInt('0x' + quote.nonce), quote.deadline, quote.signature, { value: BigInt(quote.fee) });
      await tx.wait();
      const r = await fetch(base + '/recruit/batch/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: pid, token: MP.token, nonce: quote.nonce, txHash: tx.hash }) });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'recruit confirm failed');
      applyState(j);
      syncArmyMirror();
      if (window.ORE.ui) ORE.ui.toast('批量招募成功 · ' + (j.minted || []).join(',') + ' · ' + (count * 0.0000000001).toFixed(10) + ' BNB', 'good');
    } catch (e) { if (window.ORE.ui) ORE.ui.toast(String(e.shortMessage || e.message || e), 'bad'); }
  }
  function adjustAttack(mode) {
    const r = document.getElementById('mpAttackR');
    if (!r) return;
    const max = Number(r.max) || 1;
    if (mode === '+') r.value = Math.min(max, Number(r.value) + 1);
    else if (mode === '-') r.value = Math.max(1, Number(r.value) - 1);
    else if (mode === '1') r.value = max;
    else if (mode === 'need') r.value = Math.max(1, Math.min(max, Math.ceil(Number(r.max) / 8)));
    else r.value = Math.max(1, Math.min(max, Math.floor(max * Number(mode || 0))));
    const n = document.getElementById('mpAttackN'); if (n) n.textContent = r.value;
    updateMpEstimate();
  }
  function openGarrison(zoneId) {
    zoneId = Number(zoneId);
    const m = me();
    if (!m) return;
    const z = zone(zoneId);
    if (!z) return;
    const gids = (MP.snap.garrisons && MP.snap.garrisons[String(zoneId)]) || [];
    const cur = (m.roster || []).filter((x) => x.status === 'garrison' && Number(x.zoneId) === Number(zoneId));
    const idle = m.troops || 0;
    const max = Math.min(80 - gids.length, idle);
    const clan = window.ORE.data && ORE.data.CLAN[m.clan];
    const color = clan ? clan.color : '#f2ce4b';
    ORE.ui.openRaw({
      type: 'mpGarrison',
      kicker: 'GUARD · ' + T('调防'),
      title: z.name || z.code,
      sub: z.kind === 'base' ? T('基地不可被攻击，可以存放预备队，也可以直接出兵。') : T('驻军提供防御。无驻军的地块会很快被占领。'),
      body: '<div class="z-stats" style="margin-top:0"><div><span>' + T('当前驻军') + '</span><b>' + gids.length + '</b><em>' + T('上限') + ' 80</em></div><div><span>' + (z.kind === 'base' ? T('地块类型') : T('地块防御')) + '</span><b>' + (z.kind === 'base' ? T('基地') : Math.round((MP.snap.defenses?.[String(zoneId)] || 0) + gids.length * 2)) + '</b><em>' + (z.kind === 'base' ? T('不可攻击') : T('含驻军')) + '</em></div><div><span>' + T('待命士兵') + '</span><b>' + idle + '</b><em>' + T('可调派') + '</em></div></div>'
        + '<div class="ex-slider"><div class="ex-s-h"><b>' + T('派驻数量') + '</b><span id="mpGarrisonN">' + Math.min(10, max) + '</span></div><input type="range" id="mpGarrisonRange" min="1" max="' + Math.max(1, max) + '" value="' + Math.min(10, Math.max(1, max)) + '"></div>'
        + '<div style="display:flex;gap:6px"><button class="btn" type="button" id="mpGarrisonGo" ' + (max ? '' : 'disabled') + '>' + T('派驻') + '</button><button class="btn ghost" type="button" id="mpGarrisonWithdraw" ' + (gids.length ? '' : 'disabled') + '>' + T('撤回全部') + '</button><button class="btn ghost" data-act="close" type="button">' + T('关闭') + '</button></div>'
        + '<div class="sect" style="margin-top:14px"><div class="sect-h"><h3>' + T('驻军名单') + '</h3><span>' + cur.length + ' ' + T('士兵') + '</span></div><div class="ex-list" style="max-height:150px">' + (cur.slice(0, 40).map((x) => '<span class="ex-chip"><i style="background:' + color + '"></i>' + esc(sname(x)) + ' · DEF ' + esc(x.def) + '</span>').join('') || '<div class="empty">' + T('无驻军') + '</div>') + '</div></div>'
        + '<div class="note" style="margin-top:10px">' + (z.kind === 'base' ? T('基地驻军是安全的预备队；从这里也可以直接出兵。') : T('驻军按防御从高到低调派。撤回会立刻清空该地块驻军，请留意战报中的敌军行军。')) + '</div>',
      footer: '<div class="spacer"></div><button class="btn" data-act="close">' + T('完成') + '</button>',
    });
    const range = document.getElementById('mpGarrisonRange');
    if (range) range.oninput = () => { const n = document.getElementById('mpGarrisonN'); if (n) n.textContent = range.value; };
    const go = document.getElementById('mpGarrisonGo');
    if (go) go.onclick = async () => { await doStation(zoneId, range && range.value); ORE.ui.closeModal(); };
    const wd = document.getElementById('mpGarrisonWithdraw');
    if (wd) wd.onclick = async () => { await doWithdraw(zoneId); ORE.ui.closeModal(); };
  }
  function syncArmyMirror() {
    const m = me();
    const s = G() && G().state;
    if (!m || !s) return;
    const mapStatus = (x) => (x.status === 'attacking' ? 'marching' : x.status);
    s.phase = 'playing';
    s.clan = m.clan;
    s.player = Object.assign({}, s.player || {}, { ore: m.ore, lp: m.lpShares || 0, name: m.name });
    s.selected = selected;
    s.soldiers = (m.roster || []).map((x) => Object.assign({}, x, { name: sname(x), nft: x.nftId, clan: m.clan, status: mapStatus(x), zone: x.zoneId }));
    s._idx = new Map(s.soldiers.map((x) => [x.id, x]));
    s.dead = (m.roster || []).filter((x) => x.status === 'dead').map((x) => ({ soldier: Object.assign({}, x, { name: sname(x), nft: x.nftId }), reviveAt: x.reviveAt || 0, diedAt: x.reviveAt ? x.reviveAt - 600000 : 0 }));
    s.births = (MP.snap.births || []).map((b) => {
      const f = (m.roster || []).find((x) => x.id === b.fatherId);
      const mo = (m.roster || []).find((x) => x.id === b.motherId);
      return Object.assign({}, b, { fatherName: f ? sname(f) : '—', motherName: mo ? sname(mo) : '—' });
    });
    for (const z of s.zones) {
      const owner = MP.snap.owners[String(z.id)];
      if (owner) z.owner = owner;
      z.garrison = (MP.snap.garrisons?.[String(z.id)] || []).length;
      z.garrisonIds = (MP.snap.garrisons?.[String(z.id)] || []).slice();
    }
  }
  function mpMarketBody() {
    const m = me();
    if (!m) return '';
    const listings = (MP.snap && MP.snap.listings) || [];
    const mine = listings.filter((l) => l.sellerId === m.id);
    const others = listings.filter((l) => l.sellerId !== m.id);
    const idle = (m.roster || []).filter((x) => x.status === 'idle' && !x.spouse && !x.pregnant);
    const opt = idle.map((x) => '<option value="' + esc(x.id) + '">' + esc(sname(x)) + ' · ' + esc(x.clsName) + ' · ' + T('战力') + ' ' + esc(x.atk + x.def + x.spd) + ' · ' + T('口袋') + ' ' + esc((x.pocket || 0).toFixed(2)) + '</option>').join('');
    const card = (l, own) => {
      const so = l.soldier || {};
      return '<div class="lcard"><span class="pav">⚔</span><div class="lc-b"><b>' + esc(sname(so)) + '</b><span>' + esc(so.clsName || '') + ' · ' + (so.gen ? T('第') + so.gen + T('代') : '') + ' · #' + esc(so.nftId || so.id) + '</span><span>' + T('战力') + ' ' + esc((so.atk || 0) + (so.def || 0) + (so.spd || 0)) + ' · ' + T('口袋') + ' ' + esc(Number(so.pocket || 0).toFixed(2)) + ' ORE</span>'
        + '<div class="lc-f"><span class="lc-price">' + esc(l.price) + ' <em>ORE</em></span>' + (own ? '<button data-act="market-cancel" data-id="' + esc(l.id) + '">' + T('下架') + '</button>' : '<button data-act="market-buy" data-id="' + esc(l.id) + '">' + T('买入') + '</button>') + '</div></div></div>';
    };
    return '<div class="mkt-top"><div class="mkt-kpi"><span>' + T('我的 ORE') + '</span><b>' + esc(Math.floor(m.ore)) + '</b></div><div class="mkt-kpi"><span>' + T('市场挂牌') + '</span><b>' + listings.length + '</b></div><div class="mkt-kpi"><span>' + T('我的挂牌') + '</span><b>' + mine.length + '</b></div><div class="mkt-kpi"><span>' + T('待命士兵') + '</span><b>' + idle.length + '</b></div></div>'
      + '<div class="sect"><div class="sect-h"><h3>' + T('我的挂牌') + '</h3><span>' + mine.length + '</span></div>' + (mine.length ? '<div class="listing-grid">' + mine.map((l) => card(l, true)).join('') + '</div>' : '<div class="empty">' + T('没有挂牌') + '</div>') + '</div>'
      + '<div class="sect"><div class="sect-h"><h3>' + T('挂牌出售') + '</h3><span>' + T('成交后士兵口袋 ORE 随士兵转移') + '</span></div><div class="grid-2" style="align-items:end"><div class="field"><label>' + T('选择士兵（仅待命 / 未婚）') + '</label><select class="search" id="listSoldier">' + (opt || '<option value="">' + T('没有可挂牌士兵') + '</option>') + '</select></div><div class="field"><label>' + T('标价（ORE）') + '</label><div style="display:flex;gap:5px"><input id="listPrice" type="number" step="1" min="1" value="100"><button class="btn sm" data-act="market-list-go">' + T('挂牌') + '</button></div></div></div></div>'
      + '<div class="sect"><div class="sect-h"><h3>' + T('市场在售') + '</h3><span>' + others.length + '</span></div><div class="listing-grid">' + (others.length ? others.map((l) => card(l, false)).join('') : '<div class="empty">' + T('市场暂无挂牌') + '</div>') + '</div></div>';
  }
  function openMpMarket() {
    if (!MP.snap) return;
    mpTab = 'market';
    ORE.ui.openModal('market');
  }
  function openMpBreed(tab) {
    if (!MP.snap) return;
    syncArmyMirror();
    ORE.ui.tab.breed = tab || 'match';
    ORE.ui.breed = { m: null, f: null };
    ORE.ui.openModal('breed');
  }
  function openMpArmy() {
    if (!MP.snap) return;
    syncArmyMirror();
    ORE.ui.army.page = 1;
    ORE.ui.openModal('army');
  }
  async function doStation(zoneId, count) {
    const el = document.getElementById('mpGarrisonRange');
    await post('/station', { zoneId: Number(zoneId), count: Math.max(1, Math.floor(Number(count || (el && el.value)) || 1)) });
  }
  async function doWithdraw(zoneId) {
    await post('/withdraw', { zoneId: Number(zoneId), count: 9999 });
  }
  function burnPendingKey() { return 'ore.burn.pending.' + pid; }
  function saveBurnPending(txHash, payout) { try { localStorage.setItem(burnPendingKey(), JSON.stringify({ txHash, payout })); } catch (e) {} }
  function clearBurnPending() { try { localStorage.removeItem(burnPendingKey()); } catch (e) {} }
  function getBurnPending() { try { return JSON.parse(localStorage.getItem(burnPendingKey()) || 'null'); } catch (e) { return null; } }
  async function claimBurnPayout(payout, txHash) {
    const eth = await loadEthers();
    const { provider } = await walletEthereum();
    const browser = new eth.BrowserProvider(provider);
    const signer = await browser.getSigner();
    const pool = new eth.Contract(payout.pool, ['function claim(uint256 amount,uint256 nonce,uint256 deadline,bytes signature)'], signer);
    const tx = await pool.claim(BigInt(payout.amount), BigInt(payout.nonce), payout.deadline, payout.signature);
    await tx.wait();
    clearBurnPending();
    if (window.ORE.ui) ORE.ui.toast('烧兵 ORE 已领取 · ' + tx.hash.slice(0, 10) + '…', 'good');
  }
  async function retryBurnPayout() {
    let rec = getBurnPending();
    if (!rec) { ORE.ui.toast('没有待领取的烧兵 ORE', 'gold'); return; }
    try {
      let payout = rec.payout;
      if (!payout) {
        const r = await fetch(base + '/burn/payout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: pid, token: MP.token, txHash: rec.txHash }) });
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j.error || 'payout unavailable');
        payout = j.payout; rec.payout = payout; saveBurnPending(rec.txHash, payout);
      }
      await claimBurnPayout(payout, rec.txHash);
    } catch (e) { ORE.ui.toast(String(e.message || e), 'bad'); }
  }
  async function doBurn(ids) {
    // Reconcile first: the server roster can still contain an NFT that was
    // transferred away. Burning that stale tokenId would revert the whole batch.
    try {
      const sr = await fetch(base + '/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: pid, token: MP.token }) });
      const sj = await sr.json();
      if (sr.ok && sj.ok) applyState(sj);
    } catch (e) {}
    const m = me();
    const want = ids && ids.length ? new Set(ids.map(String)) : null;
    const list = (m && m.roster || []).filter((x) => x.nftId && x.status !== 'listed' && x.status !== 'pregnant' && x.status !== 'dead' && (!want || want.has(String(x.id))));
    if (!list.length) { if (window.ORE.ui) ORE.ui.toast('no eligible NFT soldiers', 'bad'); return; }
    if (!window.confirm('Burn ' + list.length + ' NFT soldier(s) and withdraw pockets?')) return;
    try {
      const { provider } = await walletEthereum();
      const eth = await loadEthers();
      const info = await getVaultInfo();
      const ids = list.map((x) => BigInt(x.nftId));
      const erc721 = new eth.Interface(['function setApprovalForAll(address operator,bool approved)']);
      const burner = new eth.Interface(['function burnBatch(uint256[] tokenIds)']);
      // One approval for the whole collection avoids N wallet confirmations and
      // leaves no partially approved batch when the user rejects one popup.
      await sendTx(provider, info.nft, erc721.encodeFunctionData('setApprovalForAll', [info.burner, true]));
      const hash = await sendTx(provider, info.burner, burner.encodeFunctionData('burnBatch', [ids]));
      const r = await fetch(base + '/burn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: pid, token: MP.token, txHash: hash }) });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'burn failed');
      applyState(j);
      syncArmyMirror();
      if (j.payout) {
        saveBurnPending(hash, j.payout);
        try { await claimBurnPayout(j.payout, hash); }
        catch (e) {
          if (window.ORE.ui) ORE.ui.toast('烧兵完成，但 ORE 领取未完成；可在军团点“领取未完成烧兵 ORE”重试', 'bad');
        }
      } else if (window.ORE.ui) ORE.ui.toast('烧兵完成 · 口袋 0 ORE', 'gold');
      if (window.ORE.ui && ORE.ui.closeModal) ORE.ui.closeModal();
      try { const r2 = await fetch(base + '/wallet?address=' + encodeURIComponent((me() || {}).id.slice(2))); const j2 = await r2.json(); if (j2.ok && j2.ore != null && me()) me().chainOre = j2.ore; } catch (e) {}
    } catch (e) { if (window.ORE.ui) ORE.ui.toast(String(e.message || e), 'bad'); }
  }
  async function post(endpoint, data) {
    try {
      const r = await fetch(base + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ playerId: pid, token: MP.token }, data || {})) });
      const j = await r.json();
      if (!r.ok || !j.ok) { if (window.ORE.ui) ORE.ui.toast(j.error || 'action failed', 'bad'); return null; }
      applyState(j); return j;
    } catch (e) { if (window.ORE.ui) ORE.ui.toast('server unavailable', 'bad'); return null; }
  }
  async function payOre(amount, label) {
    const eth = await loadEthers();
    const { provider } = await walletEthereum();
    const info = await getVaultInfo();
    const iface = new eth.Interface(['function transfer(address,uint256) returns (bool)']);
    const value = eth.parseEther(String(amount));
    if (window.ORE.ui) ORE.ui.toast((label || T('支付')) + ' ' + amount + ' ORE…', 'gold');
    return await sendTx(provider, info.ore, iface.encodeFunctionData('transfer', [info.burn || info.vault, value]));
  }
  async function marryPair(a, b) {
    try {
      const hash = await payOre(30, T('结婚费用'));
      await post('/marry', { aId: a, bId: b, txHash: hash });
    } catch (e) { if (window.ORE.ui) ORE.ui.toast(String(e.message || e), 'bad'); }
  }
  async function doMarry() {
    const f = document.getElementById('mpBreedF'), m = document.getElementById('mpBreedM');
    if (!f || !m || !f.value || !m.value) return;
    await marryPair(m.value, f.value);
  }
  async function doBreed() {
    const f = document.getElementById('mpBreedF'), m = document.getElementById('mpBreedM');
    if (!f || !m || !f.value || !m.value) return;
    await post('/breed', { fatherId: m.value, motherId: f.value });
  }
  async function doMarketList() {
    const s = document.getElementById('mpListS'), p = document.getElementById('mpListP');
    if (!s || !p || !s.value) return;
    const price = Math.floor(Number(p.value) || 0);
    if (price < 1) return;
    await post('/market/list', { soldierId: s.value, price });
  }
  async function doMarketBuy(id) { await post('/market/buy', { listingId: id }); }
  async function doMarketCancel(id) { await post('/market/cancel', { listingId: id }); }
  async function doPoolAdd() {
    const el = document.getElementById('mpPoolN');
    const amount = Math.floor(Number(el && el.value) || 0);
    if (amount > 0) await post('/pool/add', { amount });
  }
  async function doPoolRemove() {
    const el = document.getElementById('mpPoolR');
    const shares = Math.floor(Number(el && el.value) || 0);
    if (shares > 0) await post('/pool/remove', { shares });
  }
  setInterval(tryAuth, 900);
  setInterval(() => { if (joined && MP.snap && mpTab === 'war') { renderBattles(); renderZone(); } }, 1000);
  setInterval(async () => {
    if (!joined) return;
    const m = me();
    if (m && /^w:0x[0-9a-f]{40}$/i.test(m.id)) {
      try {
        const r = await fetch(base + '/wallet?address=' + encodeURIComponent(m.id.slice(2)));
        const j = await r.json();
        if (r.ok && j.ok && j.ore != null) { m.chainOre = j.ore; renderStats(); }
      } catch (e) {}
    }
  }, 60000);
  setInterval(() => {
    if (!joined) return;
    fetch(base + '/heartbeat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pid, token: MP.token }) }).catch(() => {});
  }, 16000);
  discoverReturningPlayer();
  setInterval(discoverReturningPlayer, 1400);
  tryAuth();
})();
