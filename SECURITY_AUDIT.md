# 矿域 安全审计（客户端数值 / 领取 / 矿池）

审计时间：2026-11-04  
范围：`index.html`、`js/*.js`、`server/claim-server.js`、`contracts/*.sol`  
目标：检查是否可以篡改页面数值、伪造士兵、绕过 NFT 销毁、从 Vault / MinePool 多领 ORE。

## 当前修复状态（重要）

本轮修复后的默认运行状态是 **安全模式**：

```text
/claim        -> 503 payouts disabled
/burn-payout  -> 503 payouts disabled
```

原因是当前游戏账本仍完全在客户端，无法在不改架构的情况下证明玩家上报的 ORE 和士兵口袋是真实的。安全模式下：

- 游戏本地仍可玩
- 链上 NFT / 合约仍可读取
- **不会再向 Vault / MinePool 发起可被篡改金额的领取**
- 只有在隔离的测试网才可显式启动：

```bash
ALLOW_UNSAFE_PAYOUTS=1 node server/claim-server.js
```

这不是长期方案，只是防止漏洞继续可用。

## 结论

**有严重漏洞。** 当前架构是“客户端持有游戏账本 + 签名服务信任客户端上报金额”，不能抵抗直接调用 API 或修改 `localStorage` 的玩家。

我已修复其中两个可直接扩大损失的入口，但**核心信任模型仍未修复**，不能当作生产环境使用。

---

## 已修复

### 1. 同一笔销毁交易可重复领取

旧逻辑只检查：

- 销毁交易成功
- 日志里有 `Transfer(player -> 0xdead)`

但没有记录这笔 `burnTx` 是否已经领过。攻击者可以用同一笔销毁交易反复调用 `/burn-payout`，每次冷却结束后再领一次。

已增加：

- `usedBurnTxs`
- `pendingBurnTxs`
- 同一笔 `burnTx` 第二次请求直接返回 `burn tx already paid`

实测：

```text
第一次 burn-payout：ok
同一 burnTx 第二次：{"error":"burn tx already paid"}
```

### 2. 领取时可随意把整个矿池结算到 Vault

旧 `/claim` 接受客户端任意 `settleAmount`，最大可释放 80,000,000 ORE 到 Vault。

已限制：

```text
settleAmount <= 本次 claim amount
```

游戏端同步改为：

```text
settleAmount = min(待结算产出, 本次领取量)
```

这样不能再用 0.000001 ORE 的领取把整个矿池冲进 Vault。

---

## 仍未修复的严重问题

### C1. `/claim` 可以为任意地址签发任意金额

当前 `/claim` 的金额来自客户端请求，服务端没有权威游戏账本。

实测：

```text
player = 0x4444...4444
amount = 1 ORE
游戏状态：不存在
结果：服务端返回 ok + 有效 EIP-712 签名
```

也就是说，任何能访问 `:8090` 的人都能为自己的地址拿到签名，不需要玩、不需要 NFT、不需要士兵。

现有约束只能降低速度：

- 单笔上限 10,000,000 ORE
- 同一地址 15 秒冷却
- 同一地址每日 2,000 ORE
- 签名 nonce 内存去重

但攻击者可以生成大量地址，每个地址都能拿每日额度；服务重启后内存计数还会重置。

**这是可实际从 Vault 取走 ORE 的入口。**

### C2. `/burn-payout` 的赔付金额仍由客户端决定

服务端能验证：

- 销毁交易成功
- 销毁日志来自当前士兵 NFT 集合
- NFT 从该玩家转入 `0xdead`
- 赔付不超过 `销毁数量 × 50 ORE`

但它**不知道士兵口袋里实际有多少 ORE**。攻击者可以烧一个空口袋 NFT，然后按 50 ORE/NFT 领取。

这不是“按士兵实际口袋余额赔付”，而是“按销毁数量领取固定上限”。

### C3. 页面数值完全可改

游戏状态保存在：

```text
localStorage["orezone.save.v9"]
```

玩家可以直接改：

- `player.ore`
- `soldier.pocket`
- `zones[].vault`
- `econ.minePool`
- `econ.onchainNet`
- 市场、军队、地块归属

然后刷新页面。UI、收益计算和 `/claim` 请求都会使用被修改的值。

浏览器控制台也可以直接执行：

```js
ORE.game.state.player.ore = 9999999;
ORE.game.save();
```

服务端没有对游戏状态做任何权威校验。

### C4. 反滥用计数只在内存

这些都在 `server/claim-server.js` 的 `Map` / `Set` 中：

- `usedNonces`
- `lastClaimAt`
- `dailyClaimed`
- `lastPayoutAt`
- `dailyPaid`
- `usedBurnTxs`

服务重启后全部清空。已修复的 burnTx 去重也会随重启失效。

### C5. API 无鉴权且开放跨域

- 监听 `0.0.0.0:8090`
- `access-control-allow-origin: *`
- 没有登录、会话、API key 或 IP 限制
- 同一局域网/公网可达即可调用

任何网页都可以从浏览器向该地址发起请求。

---

## 时间篡改测试

### 已确认

在修复前，打开游戏后连续三次把浏览器时间向前拨 1 天并调用 tick：

```text
第 1 次：minePool -266,666 ORE
第 2 次：minePool -265,777 ORE
第 3 次：minePool -264,891 ORE
```

三次操作在几秒内从矿池产生了约 **797,000 ORE**，没有真实经过 3 天。

影响的时间字段包括：

- 每日预算 / `dayStart`
- 士兵复活 `reviveAt`
- 婚育冷却 / 出生
- 行军 / 攻城 `arriveAt` / `endAt`
- 市场挂牌过期
- 离线收益 `lastTick`

### 已修复

- 新增签名服务 `GET /time`
- 游戏时钟改为 **服务器时间 + performance.now 单调时钟**
- 页面打开期间向前拨系统时间会被时钟跳变保护拦截
- 刷新后重新从服务器时间同步，不再直接信任本地时钟
- 市场过期改为使用游戏时钟

修复后同样的三次拨钟测试：

```text
dayStart 不变
每日预算不重置
minePool 没有出现 26 万级扣减
```

### 残余风险

如果 `/time` 被屏蔽、签名服务不可达，或玩家直接修改页面 JS，客户端仍可能重新使用本地时间。彻底修复必须把时间判定放到服务端权威账本。

## 合约侧检查

### OreBurner

```solidity
address public immutable collection;
transferFrom(msg.sender, DEAD, tokenId)
```

- 只能销毁构造时固定的士兵 NFT 合约
- 不能转给除 `0xdead` 以外的地址
- 不会跨 NFT 系列授权
- 玩家需要 `setApprovalForAll(burner, true)`，授权范围就是该士兵集合

这部分符合“只授权一次、只作用于这个士兵系列”的约束。

### OreVault

- EIP-712 域绑定 chainId + Vault 地址
- 每个 `(player, nonce)` 只能使用一次
- 金额和 player 都进入签名
- 合约本身没有发现可绕过签名的直接取款路径

### OreMinePool

- `release` 只允许 owner/signer
- 没有任意地址直接取款函数

合约风险主要在**签名服务**，不是合约本身。

---

## 建议

### 生产环境必须做

1. **不要让客户端决定领取金额**
   - 服务端保存玩家 ORE 账本
   - 服务端验证产出、战斗、婚育、市场
   - `/claim` 只读取服务端账本余额

2. **服务端权威游戏状态**
   - 当前 `localStorage` 只能作为缓存
   - 所有经济动作提交服务端结算
   - 客户端只显示服务端返回结果

3. **鉴权**
   - 钱包登录 + 服务端 session
   - 禁止匿名调用 `/claim`、`/burn-payout`
   - 绑定地址与 session

4. **持久化反滥用状态**
   - burnTx 去重
   - nonce
   - 日限额
   - 冷却
   - 写入数据库/Redis，重启不丢

5. **关闭公网裸签名服务**
   - 只允许反向代理/内网
   - 限制 CORS 到游戏域名
   - 独立 signer 服务 + 最小热钱包余额

6. **burn-payout 改为按实际口袋余额**
   - 需要服务端权威士兵账本
   - 不能只按 NFT 数量 × 固定上限

### 临时缓解

如果暂时不上服务端账本：

- 立即把 `/claim` 的每日额度降到很小
- 只允许白名单地址
- 停掉公网 `8090`
- 把 `OreMinePool` / `OreVault` 的 signer 余额控制在可接受损失内
- 不要把该版本当作正式服

---

## 相关文件

- `server/claim-server.js`
- `js/ui.js`：`oreClaim` / `burnPayout` / `oreBurnPayoutApi`
- `js/game.js`：`burnPayout` / `extract` / `resolvePlayerAttack`
- `contracts/OreVault.sol`
- `contracts/OreMinePool.sol`
- `contracts/OreBurner.sol`
