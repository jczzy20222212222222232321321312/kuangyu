/* OreVault EIP-712 claim signer — BSC Testnet demo backend.
 * Run:  node server/claim-server.js
 * Env:  CLAIM_SIGNER_KEY (hex) or CLAIM_SIGNER_FILE
 *       ORE_VAULT, PORT
 * This is a testnet demo signer, not a production custody service.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

function loadEthers() {
  const candidates = [process.env.ETHERS_UMD, path.join(__dirname, '..', 'vendor', 'ethers.umd.min.js'), '/tmp/ethers.umd.min.js'];
  for (const p of candidates) {
    if (!p || !fs.existsSync(p)) continue;
    const vm = require('vm');
    const code = fs.readFileSync(p, 'utf8');
    const ctx = { console, fetch, Headers, Request, Response, AbortController, TextEncoder, TextDecoder, setTimeout, clearTimeout, URL };
    ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
    vm.createContext(ctx); vm.runInContext(code, ctx);
    if (ctx.ethers) return ctx.ethers;
  }
  try { return require('ethers'); } catch (e) {}
  throw new Error('ethers not found: set ETHERS_UMD');
}

const { Wallet, getAddress, isAddress, JsonRpcProvider, Contract } = loadEthers();
const PORT = Number(process.env.PORT || 8090);
const VAULT = process.env.ORE_VAULT || '0x7dEf540A66Bf6Ba6377cF43e4a31b1758d18c26c';
const MINE_POOL = process.env.ORE_MINE_POOL || '0x1C88b562556944FF9944eB58e69Ca21451aAA28a';
const COLLECTION = process.env.ORE_SOLDIER || '0x400e42D03dCf80D31fE45B57Daf3E0504a9dA240';
const DEAD = '0x000000000000000000000000000000000000dEaD';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const MAX_ORE_PER_SOLDIER = BigInt(process.env.MAX_ORE_PER_SOLDIER || '50'); // 每个被销毁士兵最多赔付
const PAYOUT_COOLDOWN_MS = Number(process.env.PAYOUT_COOLDOWN_MS || 30000);
const DAILY_CAP_ORE = BigInt(process.env.DAILY_CAP_ORE || '500');
const lastPayoutAt = new Map();
const usedNonces = new Set();
const lastClaimAt = new Map();
const dailyClaimed = new Map();
const CLAIM_COOLDOWN_MS = Number(process.env.CLAIM_COOLDOWN_MS || 15000);
const CLAIM_DAILY_CAP = BigInt(process.env.CLAIM_DAILY_CAP_ORE || '2000');
const dailyPaid = new Map(); // addr -> { day, wei }
const usedBurnTxs = new Set();
const pendingBurnTxs = new Set();
const RPC = process.env.BSC_TESTNET_RPC || 'https://bsc-testnet-rpc.publicnode.com';
const CHAIN_ID = 97;
// SAFE DEFAULT: the current client-authoritative game cannot safely authorize
// withdrawals. Only enable this in an isolated testnet environment.
const ALLOW_UNSAFE_PAYOUTS = process.env.ALLOW_UNSAFE_PAYOUTS === '1';

function loadKey() {
  if (process.env.CLAIM_SIGNER_KEY) return process.env.CLAIM_SIGNER_KEY;
  const file = process.env.CLAIM_SIGNER_FILE || '/tmp/ore-zone-deployer.json';
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return data.privateKey;
}

const provider = new JsonRpcProvider(RPC, 97, { staticNetwork: true });
const signer = new Wallet(loadKey(), provider);
const poolAbi = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'OreMinePool.abi'), 'utf8'));
const pool = new Contract(MINE_POOL, poolAbi, signer);
const domain = { name: 'OreVault', version: '1', chainId: CHAIN_ID, verifyingContract: VAULT };
const types = { Claim: [
  { name: 'player', type: 'address' },
  { name: 'amount', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
] };

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'POST, GET, OPTIONS',
    'cache-control': 'no-store',
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method === 'GET' && req.url === '/time') {
    return send(res, 200, { ok: true, now: Date.now(), chainId: CHAIN_ID });
  }
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, { ok: true, signer: signer.address, vault: VAULT, minePool: MINE_POOL, collection: COLLECTION, chainId: CHAIN_ID, unsafePayouts: ALLOW_UNSAFE_PAYOUTS });
  }
  if (req.method === 'POST' && req.url === '/claim') {
    if (!ALLOW_UNSAFE_PAYOUTS) return send(res, 503, { error: 'payouts disabled: client-authoritative ledger is not safe; set ALLOW_UNSAFE_PAYOUTS=1 only for isolated testnet' });
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 8192) req.destroy(); });
    req.on('end', async () => {
      try {
        const b = JSON.parse(raw || '{}');
        if (!isAddress(b.player || '')) return send(res, 400, { error: 'invalid player' });
        const player = getAddress(b.player);
        const amount = BigInt(b.amount);
        const nonce = BigInt(b.nonce);
        const deadline = BigInt(b.deadline || Math.floor(Date.now() / 1000) + 600);
        if (amount <= 0n) return send(res, 400, { error: 'amount' });
        if (amount > 10000000n * 10n ** 18n) return send(res, 400, { error: 'amount cap' });
        if (nonce <= 0n) return send(res, 400, { error: 'nonce' });
        // 反滥用：同一 nonce 不复用 + 冷却 + 日限额（金额仍以客户端上报为准，属已知局限）
        const nkey = player.toLowerCase() + ':' + nonce.toString();
        if (usedNonces.has(nkey)) return send(res, 400, { error: 'nonce used' });
        const lastC = lastClaimAt.get(player) || 0;
        if (Date.now() - lastC < CLAIM_COOLDOWN_MS) return send(res, 429, { error: 'too frequent' });
        const cday = new Date().toISOString().slice(0, 10);
        const crec = dailyClaimed.get(player);
        const cUsed = crec && crec.day === cday ? crec.wei : 0n;
        if (cUsed + amount > CLAIM_DAILY_CAP * 10n ** 18n) return send(res, 429, { error: 'daily cap' });
        if (deadline < BigInt(Math.floor(Date.now() / 1000))) return send(res, 400, { error: 'deadline' });
        let settleTx = null;
        let settled = 0n;
        const settleAmount = BigInt(b.settleAmount || 0);
        if (settleAmount > 0n) {
          // A claim may only settle the ORE it is about to pay out. This prevents
          // an unauthenticated caller from flushing the whole mine pool to Vault.
          if (settleAmount > amount) return send(res, 400, { error: 'settle exceeds claim' });
          if (settleAmount > 80000000n * 10n ** 18n) return send(res, 400, { error: 'settle amount cap' });
          const tx = await pool.release(VAULT, settleAmount);
          const rec = await tx.wait();
          if (!rec || rec.status !== 1) return send(res, 500, { error: 'settle transaction failed' });
          settleTx = tx.hash;
          settled = settleAmount;
        }
        const signature = await signer.signTypedData(domain, types, { player, amount, nonce, deadline });
        usedNonces.add(nkey);
        lastClaimAt.set(player, Date.now());
        dailyClaimed.set(player, { day: cday, wei: cUsed + amount });
        return send(res, 200, {
          ok: true, player, amount: amount.toString(), nonce: nonce.toString(),
          deadline: deadline.toString(), signature, signer: signer.address,
          vault: VAULT, minePool: MINE_POOL, settleTx, settled: settled.toString(), chainId: CHAIN_ID, domain, types,
        });
      } catch (e) {
        return send(res, 400, { error: e.shortMessage || e.message || 'bad request' });
      }
    });
    return;
  }
  // 烧兵后直接从矿池把 ORE 打到玩家钱包。
  // 安全约束：必须提供已确认的销毁交易；赔付上限 = 销毁数量 × MAX_ORE_PER_SOLDIER；带冷却与日限额。
  if (req.method === 'POST' && req.url === '/burn-payout') {
    if (!ALLOW_UNSAFE_PAYOUTS) return send(res, 503, { error: 'payouts disabled: client-authoritative ledger is not safe; set ALLOW_UNSAFE_PAYOUTS=1 only for isolated testnet' });
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 8192) req.destroy(); });
    req.on('end', async () => {
      try {
        const b = JSON.parse(raw || '{}');
        if (!isAddress(b.player || '')) return send(res, 400, { error: 'invalid player' });
        const player = getAddress(b.player);
        const amount = BigInt(b.amount);
        if (amount <= 0n) return send(res, 400, { error: 'amount' });
        if (typeof b.burnTx !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(b.burnTx)) {
          return send(res, 400, { error: 'burnTx required' });   // 不再有 allowUnverified 后门
        }
        const burnKey = b.burnTx.toLowerCase();
        if (usedBurnTxs.has(burnKey) || pendingBurnTxs.has(burnKey)) {
          return send(res, 400, { error: 'burn tx already paid' });
        }

        // 冷却
        const last = lastPayoutAt.get(player) || 0;
        if (Date.now() - last < PAYOUT_COOLDOWN_MS) return send(res, 429, { error: 'too frequent' });

        // 日限额
        const day = new Date().toISOString().slice(0, 10);
        const rec0 = dailyPaid.get(player);
        const usedToday = rec0 && rec0.day === day ? rec0.wei : 0n;
        if (usedToday + amount > DAILY_CAP_ORE * 10n ** 18n) return send(res, 429, { error: 'daily cap' });

        // 校验销毁交易：回执成功 + 至少一个 Transfer(player → 0xdead) + 统计唯一 tokenId
        const rec = await provider.getTransactionReceipt(b.burnTx).catch(() => null);
        if (!rec) return send(res, 400, { error: 'burn tx not found' });
        if (rec.status !== 1) return send(res, 400, { error: 'burn tx failed' });
        const lower = player.toLowerCase();
        const dead = DEAD.toLowerCase();
        const burned = new Set();
        for (const log of rec.logs || []) {
          if (String(log.address).toLowerCase() !== COLLECTION.toLowerCase()) continue;
          if (!log.topics || log.topics[0].toLowerCase() !== TRANSFER_TOPIC) continue;
          const from = '0x' + log.topics[1].slice(26).toLowerCase();
          const to = '0x' + log.topics[2].slice(26).toLowerCase();
          if (from === lower && to === dead && log.topics[3]) burned.add(BigInt(log.topics[3]).toString());
        }
        if (!burned.size) return send(res, 400, { error: 'no burn Transfer in tx' });

        // 赔付上限：按「本次销毁的 NFT 数量 × 每士兵上限」封顶
        const cap = BigInt(burned.size) * MAX_ORE_PER_SOLDIER * 10n ** 18n;
        if (amount > cap) {
          return send(res, 400, { error: 'amount exceeds cap', burned: burned.size, cap: cap.toString() });
        }

        pendingBurnTxs.add(burnKey);
        let tx, rc;
        try {
          tx = await pool.release(player, amount);
          rc = await tx.wait();
          if (!rc || rc.status !== 1) return send(res, 500, { error: 'release failed' });
          usedBurnTxs.add(burnKey);
        } catch (e) {
          return send(res, 500, { error: 'release failed: ' + (e.shortMessage || e.message || 'unknown') });
        } finally {
          pendingBurnTxs.delete(burnKey);
        }

        lastPayoutAt.set(player, Date.now());
        dailyPaid.set(player, { day, wei: usedToday + amount });
        return send(res, 200, {
          ok: true, player, amount: amount.toString(), txHash: tx.hash, burnTx: b.burnTx,
          burned: burned.size, cap: cap.toString(), signer: signer.address, minePool: MINE_POOL,
        });
      } catch (e) {
        return send(res, 400, { error: e.shortMessage || e.message || 'bad request' });
      }
    });
    return;
  }
  send(res, 404, { error: 'not found' });
});
server.listen(PORT, '0.0.0.0', () => {
  console.log('ORE claim signer', signer.address, 'vault', VAULT, 'port', PORT + (ALLOW_UNSAFE_PAYOUTS ? ' (UNSAFE payouts ENABLED)' : ' (safe mode: payouts disabled)'));
});
