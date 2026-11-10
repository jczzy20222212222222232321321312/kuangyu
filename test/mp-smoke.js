/* Multiplayer server smoke test.
 * Requires the server to run with NFT_MOCK_COUNT/IDS for a deterministic roster.
 * Usage: MP_URL=http://127.0.0.1:8091 node test/mp-smoke.js
 */
'use strict';
const { Wallet } = require('ethers');
const BASE = (process.env.MP_URL || 'http://127.0.0.1:8091').replace(/\/$/, '');
const ok = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('ok -', m); };
async function post(path, body) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
}
(async () => {
  const w = Wallet.createRandom();
  const address = w.address.toLowerCase();
  const n = await (await fetch(BASE + '/nonce?address=' + address)).json();
  const sig = await w.signMessage(n.message);
  const zones = Array.from({ length: 240 }, (_, id) => ({
    id, code: 'T' + id, kind: id % 80 === 0 ? 'base' : 'mine',
    home: ['tide', 'ember', 'dune'][id % 3], weight: 1,
    pos: [Math.cos(id * 0.7), Math.sin(id * 0.7), Math.cos(id * 1.3)],
    nb: id ? [id - 1, (id + 1) % 240] : [1, 239],
  }));
  const login = await post('/login', { address, signature: sig, clan: 'ember', name: 'Smoke', seed: 424242, manifest: { zones } });
  ok(login.status === 200 && login.body.ok, 'wallet login');
  const p = login.body.player, token = login.body.token, pid = p.id;
  const auth = (b) => Object.assign({ playerId: pid, token }, b);
  ok(Array.isArray(p.roster) && p.roster.length > 0, 'NFT roster created');
  const pairM = p.roster.find((x) => x.gender === 'm'), pairF = p.roster.find((x) => x.gender === 'f');
  if (pairM && pairF) {
    ok((await post('/marry', auth({ aId: pairM.id, bId: pairF.id }))).body.ok, 'marry');
    ok((await post('/breed', auth({ aId: pairM.id, bId: pairF.id }))).body.ok, 'breed');
  }
  const own = zones.find((z) => login.body.owners[z.id] === 'ember' && z.kind === 'mine');
  const station = await post('/station', auth({ zoneId: own.id, count: 1 }));
  ok(station.body.ok, 'station');
  ok((await post('/withdraw', auth({ zoneId: own.id, count: 1 }))).body.ok, 'withdraw');
  ok((await post('/pool/add', auth({ amount: 10 }))).body.ok, 'lp add');
  ok((await post('/pool/remove', auth({ shares: 1 }))).body.ok, 'lp remove');
  const state = await (await fetch(BASE + '/state')).json();
  const meNow = state.players.find((x) => x.id === pid);
  const idle = meNow && (meNow.roster || []).find((x) => x.status === 'idle' && !x.spouse);
  if (idle) { const ml = await post('/market/list', auth({ soldierId: idle.id, price: 10 })); if (!ml.body.ok) console.error('market', ml); ok(ml.body.ok, 'market list'); }
  ok((await post('/recruit', auth({}))).status === 400, 'recruit requires mint tx');
  ok((await post('/vault/withdraw', auth({ amount: 1 }))).status === 400, 'free ORE non-withdrawable');
  ok((await post('/burn', auth({}))).status === 400, 'burn requires tx');
  const target = zones.find((z) => z.kind === 'mine' && login.body.owners[z.id] !== 'ember' && z.nb.some((n2) => login.body.owners[n2] === 'ember'));
  if (target && meNow && meNow.troops > 0) {
    const a = await post('/attack', auth({ zoneId: target.id, troops: 1 }));
    if (!a.body.ok) console.error('attack', a);
    ok(a.body.ok && a.body.battle && a.body.battle.arriveAt > Date.now(), 'attack has travel arrival');
  }
  console.log('smoke test passed');
})().catch((e) => { console.error(e); process.exit(1); });
