/* Small concurrent multiplayer load/consistency test.
 * Usage: MP_URL=http://127.0.0.1:8091 PLAYERS=10 node test/mp-load.js
 * Requires NFT_MOCK_COUNT/IDS on the test server.
 */
'use strict';
const { Wallet } = require('ethers');
const BASE = (process.env.MP_URL || 'http://127.0.0.1:8091').replace(/\/$/, '');
const N = Math.max(1, Number(process.env.PLAYERS || 10));
async function post(path, body) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
}
(async () => {
  const zones = Array.from({ length: 240 }, (_, id) => ({ id, code: 'L' + id, kind: id % 80 === 0 ? 'base' : 'mine', home: ['tide', 'ember', 'dune'][id % 3], weight: 1, pos: [Math.cos(id * 0.4), Math.sin(id * 0.4), Math.cos(id * 0.9)], nb: id ? [id - 1, (id + 1) % 240] : [1, 239] }));
  const players = [];
  for (let i = 0; i < N; i++) {
    const w = Wallet.createRandom(), address = w.address.toLowerCase();
    const n = await (await fetch(BASE + '/nonce?address=' + address)).json();
    const sig = await w.signMessage(n.message);
    const r = await post('/login', { address, signature: sig, clan: ['tide', 'ember', 'dune'][i % 3], name: 'Load' + i, seed: 424242, manifest: { zones } });
    if (!r.body.ok) throw new Error('login ' + i + ' ' + JSON.stringify(r.body));
    players.push({ p: r.body.player, token: r.body.token });
  }
  console.log('logged in', players.length);
  await Promise.all(players.map(async (x, i) => {
    const own = zones.find((z) => x.p.clan === z.home && z.kind === 'mine');
    const a = await post('/station', { playerId: x.p.id, token: x.token, zoneId: own.id, count: 1 });
    if (!a.body.ok) console.log('station', i, a.body.error);
    const wdr = await post('/withdraw', { playerId: x.p.id, token: x.token, zoneId: own.id, count: 1 });
    if (!wdr.body.ok) console.log('withdraw', i, wdr.body.error);
    const target = zones.find((z) => z.kind === 'mine' && z.home !== x.p.clan);
    const atk = await post('/attack', { playerId: x.p.id, token: x.token, zoneId: target.id, troops: 1 });
    if (!atk.body.ok) console.log('attack', i, atk.body.error);
  }));
  await new Promise((r) => setTimeout(r, 2500));
  const state = await (await fetch(BASE + '/state')).json();
  console.log('online', state.online, 'players', state.players.length, 'owners', Object.keys(state.owners).length, 'economy', state.economy);
  console.log('load test finished');
})().catch((e) => { console.error(e); process.exit(1); });
