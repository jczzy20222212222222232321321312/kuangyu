# ORE.ZONE 安全与数值审计

## 已测试的攻击面

| 测试 | 结果 |
|---|---|
| 登录 body 注入 `ore:999999` | 被忽略，初始仍为 10,000 |
| `pool/add` 同时注入 `ore/pocket` | 只按 `amount` 扣款，其他字段无效 |
| `vault/withdraw` 注入 `now/deadline` | 服务器拒绝，只有 deposited ORE 可提 |
| `attack` 注入 `arriveAt/resolveAt/now` | 服务器自己计算行军和战斗时间 |
| 首次登录伪造 240 地块 manifest | 返回 `map manifest mismatch` |
| 无 mint 招募 | 400 |
| 免费 ORE 提现 | 400 |
| `/claim` 绕过战斗 | 410 |
| 同钱包换阵营 | 409 |
| 重放 mint/deposit/burn tx | `depositTxs` 拦截 |
| 市场购买自己的挂牌 | 拒绝 |
| 超额移除 LP | 拒绝 |

## 已修复

- 首次登录的 map manifest 现在固定校验 canonical `MAP_HASH`。
- NFT 被外部转走时，`/sync` 会把该士兵口袋 ORE 退回游戏 ORE，避免口袋永久锁死。
- 烧兵现在通过 `OreMinePool.release` 把口袋 ORE 直接打进钱包。
- 烧兵使用一次 `setApprovalForAll`，避免逐 token 授权中途失败。
- NFT V2 已迁移旧 tokenId 1–10。

## 仍需注意

1. `CLAIM_SIGNER_KEY` / deployer key 是本机文件；泄露即可伪造提现签名。
2. 服务器进程和数据库管理员仍能直接改账本；当前没有 append-only 签名账本。
3. `CORS` 仍为 `*`，生产应锁定域名。
4. 冷却时间 `attackAt/claimAt` 在内存中，进程重启会重置，不是链上时间锁。
5. 链上 `OreMarket` 直接卖 NFT 不会携带游戏内士兵口袋 ORE；网页市场仍走服务器才能保留口袋。
6. 没有独立第三方审计。
7. 当前为 BSC 测试网。

## 时间

客户端不能提交服务器时间。每日预算、孕育、冷却、行军、战斗结算、NFT 领取期限全部由服务器时间或链上区块时间决定。

## 2026-11-08 修复

- CORS 从 `*` 改为来源白名单；`CORS_ORIGIN` 可配置。
- 攻击/占领冷却写入玩家 `lastAttackAt/lastClaimAt`，服务器重启不再清空。
- 签名私钥文件权限收紧为 `600`。
- `/sync` 在 NFT 被外部转走时把口袋 ORE 退回游戏 ORE，避免锁死。

## 第二轮检查补充

- 修复 `/sync` 移除 NFT 后 `state.garrisons` 残留 ID 导致的幽灵驻军。
- 修复每日预算跨天后剩余部分未分配的问题。
- CORS 白名单已实测：允许来源返回 ACAO，陌生来源不返回。
- 首次登录地图哈希已实测：伪造 manifest 返回 400。
- 攻击/占领冷却写入玩家数据，重启不清空。
- 私钥文件权限已改为 600。
- 客户端注入 `ore/pocket/now/arriveAt/resolveAt` 均被忽略。

## V3 / 链上市场测试

- V3 士兵属性已上链，迁移 tokenId 1–11。
- 服务器铸造新兵成功，合约返回 tokenId。
- 生娃：等待孕育完成后 `/birth/mint` 由服务器调用 `mintChild`，孩子属性、世代、factor 上链。
- 游戏市场：卖家口袋 100 ORE 被转入 minePool，买家士兵 pocket=0，属性保留。
- 链上市场：卖家 V3 NFT 成交后，买家 `/sync` 领取原士兵对象，属性保留、pocket=0。
- 发现并修复：`/sync` 的 NFT RPC 缓存 60 秒导致链上成交后立即同步看不到新 NFT。

## 2026-11-08 口袋规则与 V3 回归

- 卖出/转移士兵时，口袋 ORE 直接清零丢弃，不返还买家或卖家，也不回到 minePool。
- 游戏市场测试：pocket 100 → 直接清零，买家 pocket=0。
- V3 生娃测试：等待孕育完成，服务器 `mintChild` 成功，属性和 factor 上链。
- 链上市场测试：NFT 成交后买家 `/sync` 取回原士兵对象，属性保留、pocket=0。
- 修复 `/sync` 的 60 秒 NFT 缓存导致链上成交后同步不到。
- V3 公开 `mint()` 没有属性，服务器现在拒绝把 atk=0 的 V3 NFT 变成游戏士兵。

## 第三轮全功能回归

- 登录/pool 注入 `ore:999999,pocket:999999`：只按 amount 扣款，余额未被改写。
- 无 deposited 的 vault withdraw：400。
- V3 招募：tokenId 33–37 正常上链。
- 游戏市场：pocket 100 → 买家 pocket 0，minePool 仍为 79,200,000。
- 链上锁定/解锁：200。
- 结婚：钱包转 30 ORE 到黑洞后成功，paid=30。
- 生娃：birth fee=376，钱包转 376 ORE 到黑洞后成功，tokenId=38。
- 驻防/撤回：200。
- NFT 元数据：/nft/1、/nft/1.svg 返回 200，CORS 正确。

## 只保留两个余额的调整

- 已移除流动性 tab、经济 tab、市场内 ORE VAULT 充值/提现区、链上弹窗充值/提现区。
- `/vault/deposit`、`/vault/withdraw`、`/pool/add`、`/pool/remove` 均返回 410。
- 保留烧兵领取：测试服务器实际烧兵 tokenId 40，pocket 100 ORE，`/burn` 返回 payoutTx，钱包 ORE +100。

## 新栈和 Vault 关闭

- 新 ORE/V3/Vault/MinePool/Burner/Market 已部署。
- Vault 的 10,000,000 ORE 已通过 EIP-712 claim 转回 dev 钱包。
- Vault 余额为 0，signer 已改为 0x...dEaD，合约关闭使用。
- `/vault/info` 不再返回 Vault。
- 当前分配：MinePool 79,999,950，dev 19,999,738，测试费用/销毁约 312。

## 链上市场并发/取消实测（新栈）

- 两个买家同时 buy 同一 listing：两个交易都广播，最终 NFT owner 只有一个；另一个交易 revert。
- 成交后赢家 `/sync` 取回原士兵对象，属性保留，pocket=0。
- 卖家调用 OreMarket.cancel 后 NFT 回到卖家钱包。
- 尚未实现前端取消挂牌按钮。
