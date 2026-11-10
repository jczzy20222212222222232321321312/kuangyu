# ORE.ZONE Security / Functional Test Report

Date: 2026-11-07
Environment: local self-hosted PostgreSQL 18.6 + Redis + Node 24
Status: **prototype hardening, not an independent audit**

## Confirmed passing

| Test | Result |
|---|---|
| Wallet signature nonce | Issued, one-time, expires |
| Bad wallet signature | `401 bad signature` |
| Same wallet joins second faction | `409 faction cannot be changed` |
| Legacy `/claim` bypass | `410 use /attack` |
| Legacy `/join` without wallet | `410 wallet login required` |
| NFT balance read | BSC Testnet `eth_call` |
| NFT token ids | `tokensOfOwner` used; mock test mapped 18,11,42,77,99 to roster |
| MP mint button | One shared button opens the single-player chain modal |
| NFT sync | `POST /sync` reads tokensOfOwner and binds token ids |
| Recruit without mint tx | `400 mint transaction hash required` |
| Recruit tx replay | Rejected by credited tx guard |
| Recruit recipient | Mint Transfer must be to logged-in wallet |
| On-chain ORE read | `/wallet` returns token balance |
| Chain ORE / game ORE split | HUD displays both |
| Free ORE withdrawal guard | `400 only deposited ORE is withdrawable` |
| Invalid deposit tx | Rejected; tx receipt required |
| OreVault signer | `/vault/info` returns signer/vault/chain |
| Multiplayer UI shell | Single-player-style top/panel/feed; server-authoritative data |
| Faction selection first | Reload after playing returns to lobby before wallet login |
| Local PostgreSQL + Redis | Real services; session keys and persistence observed |
| TLS reverse proxy | HTTPS static + `/world/*` API/SSE proxied; self-signed |
| OreVault withdraw guard | Free starter ORE cannot be withdrawn |
| PostgreSQL persistence | Player survived server restart |
| Redis session/presence | Keys `ore:session:<wallet>`, `ore:presence:<wallet>` observed |
| Server-owned battle | 30s resolve, owner changed, state broadcast |
| Server-owned roster | Classes, gender, tier, generation, ATK/DEF/SPD |
| Breeding endpoint | Marry + breed; fertility, related check, cooldown, inherited stats and birth delivery verified |
| Breeding test | gen-2 child delivered; roster 5 → 6; mother returned to idle |
| Station/withdraw | Station 2, withdraw 1; garrison and idle counts updated |
| Tile production | Pockets/vault tick implemented; server broadcast |
| Travel time | `arriveAt` + 30s resolve; march-only map layer, siege units after arrival |
| March visibility | UI attack click creates a march; only knights during movement |
| Daily emission | 1% mine pool distributed to vaults |
| Internal security review | See SECURITY_AUDIT_INTERNAL.md |
| Soldier detail | Full roster modal fields |
| Burn extraction | Requires NFT Transfer to dead address; pocket credited |
| Market endpoint | List/buy transfers server roster |
| LP endpoint | Add/remove shares |
| Client ORE tamper | No client endpoint accepts a resulting balance |
| Client battle result tamper | Battle result is computed server-side |
| Client birth timer tamper | `dueAt` is server-side |

## Not tested / not complete

- TLS and reverse proxy: not deployed (internal HTTP only)
- Managed PostgreSQL/Redis cluster: local single-node only
- Multi-node failover, replication, split brain
- Independent third-party security audit
- 1:1 single-player UI reuse: still custom MP HUD
- Exact single-player breeding parity: server is still simplified
- On-chain ORE market: market uses GAME ORE, not OreVault escrow
- Load/concurrency testing
- NTP/clock-skew test
- Real-fund test: forbidden at this stage

## Local DB verification

```text
[storage] PostgreSQL: postgres://***@127.0.0.1:55432/orezone
[storage] Redis: redis://127.0.0.1:56379
```

Real services were used, not PGlite, for the final check.

## Automated smoke test

`test/mp-smoke.js` passed:

- wallet login
- NFT roster
- marry/breed
- station/withdraw
- fortify
- LP add/remove
- market list
- recruit requires mint tx
- free ORE withdraw rejected
- burn requires tx
- attack has travel arrival

Run with a mock-NFT test server:
```bash
NFT_MOCK_COUNT=5 NFT_MOCK_IDS=18,11,42,77,99 node server/local-dev.js
MP_URL=http://127.0.0.1:8091 node test/mp-smoke.js
```

## Concurrent load test

`test/mp-load.js` passed with 10 wallets:

```text
logged in 10
online 10 players 10 owners 240
load test finished
```

This is a smoke load test, not a capacity benchmark.

## Tile display math

Verified against the server on a weight-1 tile:

```text
base defense       13
garrison count      2
garrison power     92
displayed defense 105
production/min    6.60
```

## Capture garrison

After capturing a tile the surviving attackers are now placed into
`state.garrisons[zoneId]`, not returned to idle. Verified on target 79:

```text
before  garrison 0  defense 16  rate 6.60
after   garrison 3  defense 155 rate 6.60
```

## Battle result overlay

The server records battle results:

```json
[{"zoneId":79,"attacker":"ember","attackerDead":5,"defender":"tide","defenderDead":0,"loot":0}]
```

The map layer renders these as non-overlapping result cards.

## Economy model

- 80,000,000 starting mine pool
- day budget = 1% of remaining pool
- tile weight = distance from owner base
- 80% to garrison pockets by power
- 20% to tile vault
- capture vault to surviving attackers by power

## Daily accrual

- day budget is 1% of the remaining mine pool
- base tiles rate = 0
- 80% pocket / 20% vault is accrued continuously to the current garrison

## Unminted child quarantine

Any roster soldier without an on-chain `nftId` is removed from the active
roster and moved to a pending birth. It does not count toward troops, defense
or attacks. It can only become active again after a verified NFT mint.

## Conclusion

The current build is safer than the original client-authoritative prototype, but it
is **not** a production financial system. Do not attach real payouts.
