/* 矿域 矿域 — emissions, AMM liquidity, fee routing & ledger */
(function () {
'use strict';
const ORE = (window.ORE = window.ORE || {});
const U = ORE.util, D = ORE.data, E = D.ECON;

function initEcon() {
  const now = Date.now();
  return {
    totalSupply: E.totalSupply,
    minePoolInitial: E.minePoolInitial,
    minePool: E.minePoolInitial,
    dayStart: now,
    dayBudget: E.minePoolInitial * E.minePoolDailyRate,
    dayEmitted: 0,
    totalEmitted: 0,
    poolOre: E.poolOre,
    poolEth: E.poolEth,
    treasuryOre: E.treasuryOre,
    treasuryEth: E.treasuryEth,
    minted: E.poolOre + E.treasuryOre,
    burned: 0,
    onchainNet: 0,
    chainSettled: 0,
    lpTotal: 1000,
    polLp: 1000,
    volumeEth: 0,
    volumeOre: 0,
    fees: { lp: 0, burn: 0, treasury: 0, total: 0, lpOre: 0, burnedOre: 0 },
    flow: {
      minted: 0, extracted: 0, looted: 0, burnedOre: 0, lpAddedEth: 0, lpAddedOre: 0,
      buybackOre: 0, treasuryOreIn: 0, marketVolume: 0, feesEth: 0,
      soldiersBurned: 0, soldiersBorn: 0, soldiersSold: 0,
    },
    priceHist: [],
    lastSample: 0,
  };
}

function price(s) { return s.econ.poolOre > 0 ? s.econ.poolEth / s.econ.poolOre : 0; }
function supply(s) { return Math.max(0, s.econ.minted - s.econ.burned); }
function lpValueEth(s) { return s.econ.lpTotal > 0 ? (s.econ.poolEth * 2 * s.player.lp) / s.econ.lpTotal : 0; }
function polValueEth(s) { return s.econ.lpTotal > 0 ? (s.econ.poolEth * 2 * s.econ.polLp) / s.econ.lpTotal : 0; }

function rollDay(s, now) {
  if (!s.econ.dayStart) s.econ.dayStart = now;
  if (s.econ.minePool == null) s.econ.minePool = E.minePoolInitial;
  if (s.econ.dayBudget == null) s.econ.dayBudget = s.econ.minePool * E.minePoolDailyRate;
  let guard = 0;
  while (now >= s.econ.dayStart + E.dayMs && guard++ < 400) {
    s.econ.dayStart += E.dayMs;
    s.econ.dayBudget = Math.max(0, s.econ.minePool) * E.minePoolDailyRate;
    s.econ.dayEmitted = 0;
  }
}
function emissionPerMin(s, now) {
  const t = now == null ? ((ORE.game && ORE.game.clockNow) ? ORE.game.clockNow() : Date.now()) : now;
  rollDay(s, t);
  return (s.econ.dayBudget || 0) / (E.dayMs / 60000);
}
function totalWeight(s) { return s.totalWeight || E.poolOre; }
function zoneRate(s, zone, now) {
  if (!zone.owner) return 0;
  return (zone.weight * emissionPerMin(s, now)) / totalWeight(s);
}
function ownerRate(s, clan, now) {
  let r = 0;
  for (const z of s.zones) if (z.owner === clan) r += zoneRate(s, z, now);
  return r;
}
function playerRate(s, now) { return ownerRate(s, s.clan, now); }

function extractionCap(soldier, clan) {
  let v = E.extractBase + soldier.atk * E.extractAtk + soldier.def * E.extractDef + (soldier.tier || 0) * E.extractTier;
  if (clan === 'dune') v *= 1.12;
  const params = ORE.game && ORE.game.state && ORE.game.state.params;
  if (params) v *= params.extraction;
  return Math.round(v);
}
function soldierPower(soldier, clan, mode) {
  const atk = soldier.atk * (clan === 'ember' ? 1.1 : 1);
  const def = soldier.def * (clan === 'tide' ? 1.12 : 1);
  if (mode === 'atk') return atk * 1.15 + soldier.spd * 0.25;
  if (mode === 'def') return def * 1.15 + soldier.spd * 0.1;
  return atk + def + soldier.spd;
}

function mintToChest(s, owner, amount) {
  if (amount <= 0) return 0;
  let added = 0;
  if (owner === s.clan) {
    const room = E.chestCap - s.player.chest;
    added = Math.min(room, amount);
    s.player.chest += added;
  } else {
    const ai = s.ai[owner];
    if (!ai) return 0;
    const room = E.aiChestCap - ai.chest;
    added = Math.min(room, amount);
    ai.chest += added;
  }
  if (added > 0) {
    s.econ.minted += added;
    s.econ.flow.minted += added;
  }
  return added;
}

function produce(s, dtMs, now) {
  if (!(dtMs > 0)) return;
  rollDay(s, now);
  const e = s.econ;
  const budgetLeft = Math.max(0, (e.dayBudget || 0) - (e.dayEmitted || 0));
  let amount = Math.min(budgetLeft, (e.dayBudget || 0) * (dtMs / E.dayMs), e.minePool || 0);
  if (amount <= 0) return;
  e.minePool = Math.max(0, (e.minePool || 0) - amount);
  e.dayEmitted = (e.dayEmitted || 0) + amount;
  e.totalEmitted = (e.totalEmitted || 0) + amount;
  e.minted += amount;
  e.flow.minted += amount;

  const tw = totalWeight(s);
  for (const z of s.zones) {
    if (!z.owner) continue;
    const share = (amount * (z.weight || 0)) / tw;
    if (share <= 0) continue;
    const vaultPart = share * 0.2;
    const pocketPart = share * 0.8;
    z.vault = (z.vault || 0) + vaultPart;
    if (z.owner === s.clan) {
      const ids = z.garrisonIds || [];
      let totalPower = 0;
      const rows = [];
      for (const id of ids) {
        const so = ORE.game && ORE.game.soldier ? ORE.game.soldier(id) : null;
        if (!so) continue;
        const pow = soldierPower(so, s.clan);
        rows.push({ so, pow }); totalPower += pow;
      }
      if (totalPower > 0) {
        for (const r of rows) r.so.pocket = (r.so.pocket || 0) + pocketPart * r.pow / totalPower;
      } else {
        z.vault += pocketPart;
      }
    } else {
      const ai = s.ai[z.owner];
      if (ai) {
        if ((z.garrison || 0) > 0) ai.pocket = (ai.pocket || 0) + pocketPart;
        else z.vault += pocketPart;
      } else {
        z.vault += pocketPart;
      }
    }
  }
}

function spendOre(s, amount, sink) {
  if (amount <= 0) return true;
  if (s.player.ore < amount) return false;
  s.player.ore -= amount;
  let burn = 0, treasury = 0;
  if (sink === 'breed') { burn = amount * E.breedBurn; treasury = amount - burn; }
  else if (sink === 'marry') { burn = amount * E.marriageBurn; treasury = amount - burn; }
  else if (sink === 'fort') { burn = amount; }
  else { burn = amount * 0.5; treasury = amount - burn; }
  s.econ.burned += burn;
  s.econ.treasuryOre += treasury;
  s.econ.flow.burnedOre += burn;
  s.econ.flow.treasuryOreIn += treasury;
  return true;
}

function quoteSell(s, oreIn) {
  const fee = oreIn * E.swapFee;
  const net = oreIn - fee;
  const ethOut = (s.econ.poolEth * net) / (s.econ.poolOre + net);
  const newOre = s.econ.poolOre + oreIn;
  const newEth = s.econ.poolEth - ethOut;
  const oldP = price(s), newP = newEth / newOre;
  return { fee, ethOut, impact: newP / oldP - 1, newPrice: newP };
}
function quoteBuy(s, ethIn) {
  const fee = ethIn * E.swapFee;
  const net = ethIn - fee;
  const oreOut = (s.econ.poolOre * net) / (s.econ.poolEth + net);
  const newOre = s.econ.poolOre - oreOut;
  const newEth = s.econ.poolEth + ethIn;
  const oldP = price(s), newP = newEth / newOre;
  return { fee, oreOut, impact: newP / oldP - 1, newPrice: newP };
}

function sellOre(s, oreIn) {
  if (!(oreIn > 0)) return { ok: false, error: '输入数量' };
  if (oreIn > s.player.ore + 1e-9) return { ok: false, error: 'ORE 余额不足' };
  const q = quoteSell(s, oreIn);
  s.player.ore -= oreIn;
  s.econ.poolOre += oreIn;
  s.econ.poolEth -= q.ethOut;
  s.player.eth += q.ethOut;
  s.econ.volumeOre += oreIn;
  s.econ.volumeEth += q.ethOut;
  s.econ.flow.marketVolume += q.ethOut;
  return { ok: true, out: q.ethOut, fee: q.fee, impact: q.impact, price: q.newPrice };
}

function buyOre(s, ethIn) {
  if (!(ethIn > 0)) return { ok: false, error: '输入数量' };
  if (ethIn > s.player.eth + 1e-9) return { ok: false, error: 'ETH 余额不足' };
  const q = quoteBuy(s, ethIn);
  s.player.eth -= ethIn;
  s.econ.poolEth += ethIn;
  s.econ.poolOre -= q.oreOut;
  s.player.ore += q.oreOut;
  s.econ.volumeEth += ethIn;
  s.econ.volumeOre += q.oreOut;
  s.econ.flow.marketVolume += ethIn;
  return { ok: true, out: q.oreOut, fee: q.fee, impact: q.impact, price: q.newPrice };
}

function addLiquidity(s, oreIn) {
  if (!(oreIn > 0)) return { ok: false, error: '输入 ORE 数量' };
  if (oreIn > s.player.ore) return { ok: false, error: 'ORE 余额不足' };
  const p = price(s);
  const ethIn = oreIn * p;
  if (ethIn > s.player.eth + 1e-9) return { ok: false, error: 'ETH 余额不足（按当前价格配对）' };
  const shares = s.econ.lpTotal > 0 ? (s.econ.lpTotal * oreIn) / s.econ.poolOre : Math.sqrt(oreIn * ethIn);
  s.player.ore -= oreIn;
  s.player.eth -= ethIn;
  s.econ.poolOre += oreIn;
  s.econ.poolEth += ethIn;
  s.econ.lpTotal += shares;
  s.player.lp += shares;
  s.econ.flow.lpAddedEth += ethIn;
  s.econ.flow.lpAddedOre += oreIn;
  return { ok: true, ethIn, shares };
}
function removeLiquidity(s, pct) {
  if (!(pct > 0) || s.player.lp <= 0) return { ok: false, error: '没有 LP' };
  const shares = s.player.lp * U.clamp(pct, 0, 1);
  const oreOut = (s.econ.poolOre * shares) / s.econ.lpTotal;
  const ethOut = (s.econ.poolEth * shares) / s.econ.lpTotal;
  s.player.lp -= shares;
  s.econ.lpTotal -= shares;
  s.econ.poolOre -= oreOut;
  s.econ.poolEth -= ethOut;
  s.player.ore += oreOut;
  s.player.eth += ethOut;
  return { ok: true, oreOut, ethOut, shares };
}

/**
 * Route an ETH marketplace fee:
 *  40% -> protocol-owned liquidity (paired with treasury ORE)
 *  30% -> buy $ORE and burn it
 *  30% -> treasury
 */
function routeEthFee(s, feeEth) {
  if (!(feeEth > 0)) return null;
  const lpEth = feeEth * E.feeLp;
  const burnEth = feeEth * E.feeBurn;
  const treasEth = feeEth - lpEth - burnEth;
  const out = { lpEth: 0, lpOre: 0, burnEth: 0, burnOre: 0, treasuryEth: treasEth };
  const p = price(s);

  // protocol-owned liquidity, matched with treasury ORE at the current price
  if (lpEth > 0 && p > 0) {
    const wantOre = lpEth / p;
    const oreIn = Math.min(s.econ.treasuryOre, wantOre);
    const ethIn = oreIn * p;
    if (oreIn > 0 && ethIn > 0) {
      const shares = (s.econ.lpTotal * oreIn) / s.econ.poolOre;
      s.econ.treasuryOre -= oreIn;
      s.econ.poolOre += oreIn;
      s.econ.poolEth += ethIn;
      s.econ.lpTotal += shares;
      s.econ.polLp += shares;
      out.lpEth = ethIn; out.lpOre = oreIn;
      s.econ.fees.lp += ethIn;
      s.econ.fees.lpOre += oreIn;
      s.econ.flow.lpAddedEth += ethIn;
      s.econ.flow.lpAddedOre += oreIn;
    }
    // any unmatched ETH stays in the treasury
    out.treasuryEth += Math.max(0, lpEth - out.lpEth);
  } else {
    out.treasuryEth += lpEth;
  }

  // buyback & burn
  if (burnEth > 0) {
    const q = quoteBuy(s, burnEth);
    s.econ.poolEth += burnEth;
    s.econ.poolOre -= q.oreOut;
    s.econ.burned += q.oreOut;
    s.econ.fees.burn += burnEth;
    s.econ.fees.burnedOre += q.oreOut;
    s.econ.flow.buybackOre += q.oreOut;
    s.econ.flow.burnedOre += q.oreOut;
    out.burnEth = burnEth; out.burnOre = q.oreOut;
  }
  s.econ.treasuryEth += out.treasuryEth;
  s.econ.fees.treasury += out.treasuryEth;
  s.econ.fees.total += feeEth;
  s.econ.flow.feesEth += feeEth;
  return out;
}

function sellSoldier(s, priceEth, sellerIsPlayer) {
  const fee = priceEth * (s.params ? s.params.fee : E.marketFee);
  if (sellerIsPlayer) s.player.eth += priceEth - fee;
  const route = routeEthFee(s, fee);
  s.econ.flow.soldiersSold += 1;
  s.econ.flow.marketVolume += priceEth;
  return { fee, net: priceEth - fee, route };
}

function sampleHistory(s, now) {
  if (!s.econ.priceHist) s.econ.priceHist = [];
  if (now - (s.econ.lastSample || 0) < 10000) return;
  s.econ.lastSample = now;
  s.econ.priceHist.push({
    t: now,
    p: price(s),
    s: supply(s),
    lp: s.econ.poolEth * 2,
    chest: (s.soldiers || []).reduce((a, x) => a + (x.pocket || 0), 0),
  });
  if (s.econ.priceHist.length > 260) s.econ.priceHist.splice(0, s.econ.priceHist.length - 260);
}

function metrics(s) {
  const p = price(s);
  const sup = supply(s);
  const pockets = (s.soldiers || []).reduce((a, x) => a + (x.pocket || 0), 0);
  const vaults = (s.zones || []).reduce((a, z) => a + (z.vault || 0), 0);
  const aiPocket = Object.values(s.ai || {}).reduce((a, x) => a + (x.pocket || 0), 0);
  const circulating = s.player.ore + (s.econ.treasuryOre || 0) + (s.econ.poolOre || 0) + pockets + vaults + aiPocket;
  return {
    price: p,
    supply: sup,
    totalSupply: s.econ.totalSupply || E.totalSupply,
    minePool: s.econ.minePool,
    minePoolInitial: s.econ.minePoolInitial,
    dayBudget: s.econ.dayBudget,
    dayEmitted: s.econ.dayEmitted,
    marketCap: sup * p,
    locked: vaults,
    playerChest: s.player.ore,
    playerPocket: pockets,
    playerVault: s.player.ore,
    aiChest: aiPocket,
    circulating,
    lpEth: s.econ.poolEth,
    lpOre: s.econ.poolOre,
    lpValue: s.econ.poolEth * 2,
    polLp: s.econ.polLp,
    burned: s.econ.burned,
    minted: s.econ.minted,
    treasuryOre: s.econ.treasuryOre,
    treasuryEth: s.econ.treasuryEth,
    playerLpValue: lpValueEth(s),
    playerLpShare: s.econ.lpTotal > 0 ? s.player.lp / s.econ.lpTotal : 0,
    polShare: s.econ.lpTotal > 0 ? s.econ.polLp / s.econ.lpTotal : 0,
    emission: emissionPerMin(s),
    playerRate: playerRate(s),
    totalWeight: totalWeight(s),
    alive: (s.soldiers || []).length,
  };
}

function balanceCheck(s) {
  const pockets = (s.soldiers || []).reduce((a, x) => a + (x.pocket || 0), 0);
  const vaults = (s.zones || []).reduce((a, z) => a + (z.vault || 0), 0);
  const aiPocket = Object.values(s.ai || {}).reduce((a, x) => a + (x.pocket || 0), 0);
  const total = s.player.ore + (s.econ.treasuryOre || 0) + (s.econ.poolOre || 0) + pockets + vaults + aiPocket + (s.econ.onchainNet || 0);
  return { total, supply: supply(s), diff: total - supply(s) };
}

ORE.econ = {
  initEcon, price, supply, lpValueEth, polValueEth,
  emissionPerMin, zoneRate, ownerRate, playerRate, totalWeight,
  extractionCap, soldierPower,
  mintToChest, produce, spendOre,
  quoteSell, quoteBuy, sellOre, buyOre, addLiquidity, removeLiquidity,
  routeEthFee, sellSoldier, sampleHistory, metrics, balanceCheck,
  E,
};
})();
