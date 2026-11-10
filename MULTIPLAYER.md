# 矿域 Shared World — server-authoritative

This is the server-authoritative multiplayer mode. The server owns and persists
the map, player ORE, troops, soldier roster, attacks, battle results, breeding,
market listings and the liquidity pool. The browser only signs actions and
renders snapshots.

There are **no independent player bases** and **no world sharding** in this
build. Territory is faction-owned and all players share one 240-tile world.

## Run

Install the server dependency once:

```bash
pnpm install
```

Terminal 1 — static game:

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```

Terminal 2 — world server:

```bash
node server/world-server.js
```

Open:

```text
http://<host>:8080/index.html?mp=1
```

LAN example:

```text
http://192.168.10.108:8080/index.html?mp=1
```

Solo link:

```text
http://192.168.10.108:8080/index.html
```

The lobby has a **多人同服** button.

- The Legion tab opens a single-player-style `modal_army` shell backed by server data:
  filters, gender, sort, pagination, cards, dead cards and footer actions.

- Breeding tab opens a single-player-style `modal_breed` shell: BLOODLINE
  title, 結緣/產房 tabs, male/female pick lists, pair card, fertility and
  costs. Marry/breed actions are routed to `/marry` and `/breed`.

## Terminology

"Single-player-style" means only the visual shell and modal layout were
reused. Multiplayer is **not** running single-player logic:

- UI: single-player-style HTML/CSS
- State: server-authoritative PostgreSQL
- Auth: wallet signature
- Economy/NFT: BSC Testnet contracts
- Market pocket ORE: server ledger transferred with the soldier

## Home

- Multiplayer opens on a Home tab with a single-player-style hero:
  `三族争矿。链上为兵。烧兵取矿。`, faction cards, rules and mint CTA.
- The duplicate multiplayer mint CTA is hidden while Home is active.

## Minting

- The shared world has one prominent `Mint soldier · BSC Testnet` button.
- It opens the same single-player-style on-chain mint modal, backed by the multiplayer server and V2 NFT contract.
- After a successful mint, the client calls `POST /sync`; the server reads
  `tokensOfOwner`, creates soldiers with the exact token ids, and removes
  soldiers whose NFTs are no longer owned.

## Returning players

- On page load the client checks `eth_accounts` (without prompting) and calls
  `GET /who?address=...`.
- If the address already has a server player, the faction-selection hero is
  skipped and the wallet-signature login opens directly with the existing clan.
- New wallets still see the faction selection.

## Login

Multiplayer always opens with the faction-selection lobby. A previous local
playing save is not hydrated into the shared world; the server remains
authoritative and the wallet session handles re-entry.

1. Choose a faction in the lobby.
2. In multiplayer mode, the server asks for a wallet.
3. The browser requests `eth_requestAccounts`, switches to BSC Testnet (97),
   and calls `personal_sign` on a server-issued one-time message.
4. The server verifies the signature with `ethers.verifyMessage`, consumes the
   nonce, and returns a session token.
5. Wallet address is the player identity. There is no guest login in this mode.
6. The server reads both the Soldier NFT balance and its token ids (`tokensOfOwner`) from BSC Testnet RPC. The initial roster is created from the actual token ids, **1 NFT = 1 initial soldier**, capped at 10.

Signing is free: no transaction, no gas.

If the wallet has 0 NFTs it starts with **0 soldiers** but still has 10,000 ORE
to recruit from the server.

## UI shell

Multiplayer now uses a single-player-style UI shell:

- the same top bar
- the same left command panel
- the same right war feed
- the same language selector and wallet chip
- the same mobile bottom-sheet layout

The multiplayer-only tabs (War / Legion / Breeding / Market / Liquidity)
are embedded inside the single-player left panel. The custom full-screen
multiplayer HUD is no longer used.

## On-chain ORE / OreVault

- The HUD shows the wallet's real on-chain ORE balance read from
  `0xD222B7BC58AF20a5EE2bF877A9008091Da3D00E5`.
- Wallet ORE can be deposited into OreVault from the Market tab.
- The server verifies the `Deposited(address,uint256)` event and credits game ORE.
- Only **deposited ORE** is withdrawable. The free starter game ORE is not
  withdrawable.
- Withdrawals are signed by the server EIP-712 signer and claimed from OreVault.
- The market still settles in server GAME ORE; deposits make that ledger partially
  backed by escrow. A fully on-chain order book is not implemented.

## One wallet, one faction

The server binds a player to the wallet address:

- wallet A joining `ember` cannot later join `tide` in the same world.
- Different wallets can choose different factions; those are separate players.
- Opening three different wallets is not the same as one wallet joining three
  factions. The latter is rejected with `faction cannot be changed`.
- The auth screen also states the one-wallet-one-faction rule.

## Server-owned systems

- 240-tile map ownership and per-tile defense
- Player ORE, troops, power, kills, captures
- Soldier roster: class, gender, tier, generation, ATK/DEF/SPD
- Attacks: selected idle soldiers, 30-second resolution, server battle math
- Recruitment: must mint the Soldier NFT on-chain; the server verifies the mint Transfer event and tokenId, then creates the bound soldier. No free off-chain recruit.
- Faction territory income every 5 seconds
- Breeding: male + female, 100 ORE, 45-second gestation, inherited stats
- Soldier market: list/buy/cancel, 5% fee to the LP pool
- Liquidity pool: add/remove ORE liquidity, LP shares
- Leaderboard, online presence, events, audit log
- PostgreSQL persistence (managed `DATABASE_URL`, or local embedded PostgreSQL)
- Redis for session/presence (managed `REDIS_URL`, or local Redis)

## Attack rules

- Target must be an unowned-by-you mine adjacent to your faction territory
- Base tiles are unattackable
- The server selects the requested number of idle soldiers and deducts them
  immediately
- A battle resolves after 30 seconds against tile defense
- Win: faction ownership changes, tile defense resets, attacker gets 500 ORE,
  60% of committed soldiers survive
- Lose: committed soldiers die; tile defense is reduced
- One active attack per player; short cooldown between attacks

## Recruitment / NFT mint

Recruiting is no longer a free server-side troop increment. The client must call
`OreSoldier.mint(uint256)` from the logged-in wallet. The server then:

1. fetches the transaction receipt
2. verifies the NFT contract Transfer event
3. verifies the recipient is the logged-in wallet
4. verifies the tokenId is new
5. creates a roster soldier bound to that tokenId

A player cannot recruit for another wallet: the mint recipient must equal the
logged-in wallet, and the recruit endpoint requires that player's session token.

- Tile hover tooltips are driven by server `zoneStats`: owner, rate,
  garrison, defense and vault.

- Own garrisoned tiles render the single-player mining avatar: soldier
  portrait, faction flag, ATK badge, animated pickaxe on the tile boundary and floating +ORE text.
  Data comes from server `zoneStats` and garrison rosters.

## Travel, economy, offline and daily

- Multiplayer battles are fed into the single-player map animation layer:
  marching route, knights, arrival rings and battle marks.
- During movement only the marching knights and route are drawn. Siege units and
  battle marks appear only after `arriveAt`; battle classes are supplied by the server.
- The attack button reads the single-player-style slider (`mpAttackR`), not a
  removed numeric label, so a click always sends a non-zero march.
- The server supplies `fromZoneId`, `startedAt` and `arriveAt` so the client
  cannot fake movement timing.

- Attack creates a march with a server-side `arriveAt` based on the distance
  from the nearest owned tile. Battle resolves 30 seconds after arrival.
- Tile production, garrison pockets and vaults are simulated server-side.
- Daily emission: 1% of the remaining mine pool is distributed to tile vaults
  once per calendar day.
- Offline time is computed from the server `lastSeen`; pocket/vault production
  continues while the server runs.
- The Economy tab shows game ORE, pockets, vaults, LP pool, mine pool, emitted
  amount, listings and players.
- Clicking a soldier opens a full detail panel: class, tier, generation, gender,
  stats, pocket, status, spouse, children, fertility, NFT id and cooldown.

## Tile production / pockets / vault

- The 1% daily budget is released at the start of the UTC day and accrued
  continuously to the current garrison/vault, so a tile stationed later still
  starts earning from that moment.
- Base tiles do not produce.
- If a mine has no garrison, its 80% soldier share stays in the tile vault.

- The total daily emission is 1% of the remaining mine pool.
- It is split across owned mine tiles by distance weight; farther from the
  owner base = higher weight.
- 80% of each tile share goes to stationed soldiers by ATK+DEF+SPD.
- 20% goes to the tile vault; if no soldier is stationed, the 80% also stays
  in the tile vault.
- Capturing a tile distributes its vault to surviving attackers by power into
  their pockets. There is no flat capture bonus.

- Each owned mine produces server ORE every 5 seconds based on its map weight.
- 80% goes to the soldiers stationed on that tile, split by their ATK+DEF+SPD.
- 20% goes to the tile vault.
- If no soldier is stationed, the 80% also goes to the tile vault.
- A successful capture takes the current tile vault.
- Soldiers carry a pocket balance; burning the NFT withdraws that pocket to
  server ORE.
- Pocket ORE is not chain-withdrawable until it is backed by an OreVault deposit.

## Station / withdraw

- A player can station idle soldiers on their faction's mine tiles.
- Stationed soldiers leave the idle pool and defend that tile.
- Withdraw returns them to idle.
- Enemy capture kills stationed defenders; they enter a 10-minute revive queue.
- Dead soldiers automatically return to idle after the revive timer.

## Breeding (single-player rules)

- Select an idle male and an idle female
- Marry first: 30 ORE; both must be idle, unmarried, unrelated and not pregnant
- Fertility is 3–5 births per soldier
- Breed only a married pair; cost is the sum of both soldiers' power
- Both parents get a 24-hour cooldown
- Mother is `pregnant` for 45 seconds
- Child gender/class/tier are generated by the single-player probabilities
- Tier: 16% upgrade, 36% downgrade by one, 18% downgrade by two
- Stats: (father + mother) × 1.0–1.2, independently per stat
- Child has its own fertility, generation, parents, ancestors and pocket=0
- After delivery the mother returns to idle; both parents keep the 24h cooldown
- Child can later marry or be listed on the market

## Market

- List an idle soldier at a price in server ORE
- Other players buy it with ORE
- 5% fee goes to the LP pool; seller receives the rest
- Server transfers the soldier and recalculates both rosters

## Liquidity

- Add ORE to the pool and mint LP shares
- Remove LP shares for a proportional ORE amount
- Market fees increase pool ORE

## Database / configuration

There are two modes.

### Local self-hosted

```bash
node server/local-dev.js
```

This starts:

- real PostgreSQL 18 (embedded binary) on port `55432`
- real Redis on port `56379`
- the game server on port `8091`

It is one local primary node per service. It is not a managed HA cluster.

Data directories:

```text
server/pgdata-real/     PostgreSQL cluster
```

Redis is an in-memory local instance.

### Managed PostgreSQL + Redis

Set:

```text
DATABASE_URL=postgres://user:pass@host:5432/orezone
REDIS_URL=redis://host:6379
```

Then run:

```bash
node server/world-server.js
```

Without `DATABASE_URL` the server falls back to embedded PGlite; without
`REDIS_URL` it falls back to an in-memory Redis adapter for development.

Other environment:

```text
PORT=8091
HOST=0.0.0.0
WORLD_SEED=424242
PGDATA=server/pgdata-real
DEV_PG_PORT=55432
DEV_REDIS_PORT=56379
NFT_CONTRACT=0x712716b1a7a991a372d951A6873f42665918BA9a
NFT_RPC=https://bsc-testnet-rpc.publicnode.com
CORS_ORIGIN=*
OFFLINE_MS=45000
BATTLE_MS=30000
RECRUIT_COST=100
START_ORE=10000
NONCE_TTL=300000
```

Development-only NFT override:

```text
NFT_MOCK_COUNT=5
NFT_MOCK_IDS=18,11,42,77,99
```

Never enable those in production.

Reset local data:

```bash
rm -rf server/pgdata-real
```

## Local TLS reverse proxy

Optional self-signed proxy:

```bash
node server/tls-proxy.js
```

```text
https://localhost:8443/          -> static game
https://localhost:8443/world/*   -> game API/SSE
```

Open `https://localhost:8443/index.html?mp=1&server=/world`.

This is a development certificate, not a public CA certificate. Production
must use Nginx/Caddy with a real domain certificate.

## Anti-cheat / security

Implemented:

- One-time nonce with expiry
- Wallet signature verification
- Random server session token required for actions
- Server-authoritative troops, ORE, roster, defenses and battles
- Server validates adjacency, faction, base protection, cooldowns and ownership
- No client-supplied price/stat/battle results
- PostgreSQL persistence and audit log
- Request body limits and per-IP rate limiting
- CORS and input sanitization

Not production-grade yet:

- TLS / reverse proxy
- Per-account action quotas and anomaly detection
- Wallet session delegation / reconnect tokens
- Independent security audit
- NFT balance and token ids are read via a public RPC; the server uses `tokensOfOwner` and stores the real token ids in the roster. Production should still use your own BSC RPC and add contract-level ownership checks per action.
- This mode does not use the existing ORE claim payouts; do not attach real
  value yet

## Scaling

No hard-coded player cap. One Node process, one PostgreSQL primary and one
Redis instance in the local development stack (no sharding). Suitable for a
small private test group. For public scale, use a managed PostgreSQL/Redis
cluster, reverse proxy, WebSocket/delta sync and load testing.
