# Internal Security Review — ORE.ZONE Multiplayer

This is an **internal** review, not an independent third-party audit.

## Covered

- Wallet nonce challenge and signature verification
- Session token required for state-changing actions
- NFT balance and tokenId binding
- NFT mint transfer validation for recruit
- OreVault deposit event validation
- EIP-712 withdrawal signature; only deposited ORE is withdrawable
- Server-owned ORE, troop, roster, battle and breeding state
- Adjacency, base protection, attack cooldown, single active attack
- Market/breeding/staking validation
- PostgreSQL persistence and audit_log
- Redis session/presence keys
- TLS reverse proxy (self-signed)
- Input size limits and per-IP rate limit

## Adversarial checks run

| Attempt | Result |
|---|---|
| Login with bad signature | 401 |
| Reuse nonce | rejected |
| Same wallet joins another faction | 409 |
| Recruit without mint tx | 400 |
| Reuse mint/burn/deposit tx | 409 |
| Free starter ORE withdrawal | 400 |
| `/claim` instead of battle | 410 |
| Client-supplied battle result | ignored |
| Client-supplied ORE amount | server rejects/validates |
| Station on enemy tile | rejected |
| Withdraw another player's garrison | no matching soldiers |
| Market buy own listing | rejected |
| Withdraw more LP shares than owned | rejected |
| Server restart | PostgreSQL state survived |
| Redis keys | session/presence observed |

## Known risks / not production-ready

1. **Session token is bearer** in browser memory; XSS could steal it.
2. **CORS `*`**; should be pinned to the deployment origin.
3. **Public RPC** is trusted for NFT/ORE reads; use a dedicated BSC RPC.
4. **No per-account quota** beyond IP rate limiting.
5. **Single PostgreSQL/Redis node** no HA or failover.
6. **Self-signed TLS** only.
7. **No external audit**.
8. **Economy is still simplified** relative to single-player.
9. **Market settles in server GAME ORE**, not a fully on-chain order book.
10. **Admin/DB access** can alter state; no signed append-only ledger.
11. **No NTP/clock-skew test**.
12. **No load test**.

## Conclusion

The current build blocks the obvious client-side balance/time manipulations and
validates on-chain mint/deposit events. It is still a testnet prototype and
must not custody real funds until the remaining items are addressed.
