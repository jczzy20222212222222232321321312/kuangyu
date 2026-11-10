# ORE 链上化（BSC Testnet）

## 已部署合约

| 合约 | 地址 |
|---|---|
| ORE ERC20 | `0xD222B7BC58AF20a5EE2bF877A9008091Da3D00E5` |
| OreVault（金库 + 签名领取） | `0xfd6518D066ceddd5b4Bd100cAa17B7Fa504fFC62` |
| Batch Burner | `0xc3DD4CFf1fc205974cF69b5B64D1FFc9405Bb917` |
| OreMinePool | `0x24Fe1fBAaAeE078ff918f8aFF8DE1AD58B7F8506` |
| Claim signer | `0x754620D96e48B93df1A6aFF57FFA98d732EB667a` |
| 链 | BSC Testnet / 97 |
| ORE 总量 | 100,000,000 ORE |
| Vault 当前余额 | 约 20,000,052.343 ORE |
| 矿池当前余额 | 约 79,999,947.657 ORE |

区块浏览器：

- [ORE Token](https://testnet.bscscan.com/address/0xD222B7BC58AF20a5EE2bF877A9008091Da3D00E5)
- [OreVault](https://testnet.bscscan.com/address/0xfd6518D066ceddd5b4Bd100cAa17B7Fa504fFC62)

部署交易：

```text
ORE Token: 0x2c5d3fdcb4aa6c21d1aff5793e2b0a9bb9849c8fd0f70b56f4730ec532ae8d7d
OreVault:  0x13a3fd78107e121479b3736dcd88b49ac88123090be813de954d26503eb64a74
MinePool:  0xcec0e19eb80d2ed8393d566fdbfa0f6d845e3224303df0f5353c638aed10569f
OreBurner: 0x688e1f6d9e5c518242c4a31f10819fd9464fc160f2d3c08d59d9de5f4e3a1c3d
```

## 批量烧兵

`OreBurner` 允许把一批 NFT 用**一笔交易**转入销毁地址：

```solidity
setApprovalForAll(OreBurner, true)   // 仅第一次需要
burnBatch([1,2,3,...,100])           // 一次交易，最多 500 个
```

游戏里选中多个 NFT 士兵后，首次会先弹一次授权交易；授权完成后，选中的 NFT 会合并成一笔 `burnBatch` 交易。之后每次批量烧兵都只需要一笔交易。

## 架构

```text
100,000,000 ORE
├─ OreVault     20,000,000（初始流通/领取金库）
└─ OreMinePool  80,000,000（每日产矿储备）
        │
        │ 领取时结算：把本地已产出量 release 到 Vault
        ▼
   OreVault ── claim(signature) ──► 玩家钱包
        ▲                              │
        └──────── deposit ─────────────┘
```

游戏侧保留本地 ORE 账本，但用 `econ.onchainNet` 记录“已提到链上 / 已从链上充回”的净额：

```text
本地账本 + onchainNet = 100,000,000
```

- **提取到钱包**：本地 `player.ore` 减少，`onchainNet` 增加，Vault 转 ORE 给玩家。
- **从钱包充值**：本地 `player.ore` 增加，`onchainNet` 减少，玩家 ORE 转入 Vault。
- 结算后 `EC.balanceCheck()` 的 `diff` 应保持 0。

## Claim 签名服务

ERC20 由 Vault 和 OreMinePool 持有；Vault 只认 EIP-712 签名。领取时，服务端先把“本地已产出但未结算”的 ORE 从矿池释放到 Vault，再签发 Vault 领取签名。

启动：

```bash
cd kuangyu
node server/claim-server.js
# 默认 0.0.0.0:8090
```

环境变量：

```bash
CLAIM_SIGNER_KEY=0x...       # 或 CLAIM_SIGNER_FILE=/path/key.json
ORE_VAULT=0xfd6518D066ceddd5b4Bd100cAa17B7Fa504fFC62
PORT=8090
```

健康检查：

```bash
curl http://127.0.0.1:8090/health
```

游戏内点击 **提取** → 页面请求 `/claim` → 服务端 EIP-712 签名 → 钱包调用 `OreVault.claim`。

## 资产同步

顶部“矿池剩余”在连接钱包后直接读取 OreMinePool 的 ORE 余额；链上面板显示钱包 ORE、Vault ORE 和矿池 ORE。领取时结算，因此两次领取之间的链上矿池可能高于本地实时矿池，下一次领取会先补齐。

士兵 ID 与链上 tokenId 是同一个值：NFT `#1` → 游戏士兵 `id=1` → 花名册 `#1`。

链上资产面板提供 **同步链上资产** 按钮，一次同步：

- `tokensOfOwner` → 游戏 NFT 军团
- 钱包 ORE 余额
- Vault ORE 余额
- 本地个人金库
- `EC.balanceCheck()` 的本地账本差额
- 上次同步时间

连接钱包、切换账户、铸造、领取、充值后也会自动刷新资产。

## 已验证的真实链上交易

矿池结算（1 ORE 从池释放到 Vault）：

```text
settle tx: 0x93c41c4f81b0b5a1953c0ebd0ef02d874a69c04e91bca7a7ca9e552aaddc5c13
```

签名领取（1 ORE）：

```text
claim tx: 0x74220a40cc3d9164289fe42f4afaa51338dd2d2608496b50b088186d9741d85a
```

领取时链上结算测试：

```text
settle tx: 0xf00100d248b12bf4a435d896c48abc7318487b4cf46487e10dcdfed8226baf86
```

最终余额约为：

```text
ORE totalSupply: 100,000,000
Vault:           20,000,052.343
MinePool:        79,999,947.657
```

## 游戏内入口

**设置 / 左侧铸造按钮 → BSC 测试网面板**：

- 钱包链上 ORE 余额
- 游戏个人金库 ORE
- Vault ORE 余额
- 提取数量 + 提取
- 充值数量 + 充值
- 本地 ↔ 链上对账行
- 个人金库下方显示最近 ORE Tx / 烧兵 Tx

## 安全边界

这是 **BSC Testnet 单机 Demo**：

- `server/claim-server.js` 持有 signer 私钥，不能部署到不可信公网。
- `/claim` 没有登录态，也没有服务端游戏账本校验；任何人都可以请求签名（上限 10,000,000 ORE/笔）。
- 生产环境必须增加：
  1. 服务端登录/会话
  2. 服务端游戏账本和反作弊
  3. claim nonce 持久化与限额
  4. 独立 KMS/HSM 签名机
  5. 合约审计与 BscScan 源码验证
- 当前 ORE / Vault 合约未在 BscScan 验证。
- 不要使用主网私钥。
