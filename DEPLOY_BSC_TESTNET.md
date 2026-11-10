# Ore Soldier · BSC Testnet 免费铸造

## 合约规则

- 总量：**10,000** 个士兵 NFT
- 价格：**0 tBNB**，免费铸造
- 每个地址**生命周期最多铸造 10 个**（转出已铸造的 NFT 也不会重置额度）
- 无 owner 预留、无白名单、无付费 mint
- 标准：ERC-721 Metadata
- 网络：**BSC Testnet，chainId 97**

## 已部署（BSC Testnet）

| 项目 | 值 |
|---|---|
| 合约地址 | **0x712716b1a7a991a372d951A6873f42665918BA9a** |
| 网络 | BSC Testnet · chainId 97 |
| 部署交易 | `0xf37b2616ea3c9bc039310c947db8e24d8a9443331ac4d9ac52b79a2b7347f714` |
| 部署者 | `0x754620D96e48B93df1A6aFF57FFA98d732EB667a` |
| 区块 | 140616227 |
| 当前总铸造 | 10 / 10,000 |
| 当前剩余 | 9,980 |
| 浏览器 | https://testnet.bscscan.com/address/0x712716b1a7a991a372d951A6873f42665918BA9a |

铸造测试：部署者地址铸造了 **10** 个（Token #1–#10），第 11 次 `mint(1)` 已确认 revert。

生命周期上限测试：

- 部署者将 Token #1 转给 `0x1111111111111111111111111111111111111111` 后，再调用 `mint(1)` 仍然 revert，证明额度按“历史铸造量”而不是当前余额计算。
- 当前部署者持有 9 个，测试接收地址持有 1 个；总量 20 / 10,000，剩余 9,980。
- 如需自己测试，请使用另一个 BSC 测试网地址；部署者地址的 10 个额度已用完。

合约源码：`contracts/OreSoldier.sol`  
编译产物：`build/OreSoldier.json`  
部署记录：`build/deployment.json`

## 游戏内入口

游戏内 **设置 → BSC 测试网士兵** 已加入钱包面板：

- 检测/连接 OKX Wallet、Binance Web3、MetaMask、Trust Wallet、Coinbase、Rabby、Bitget（EIP-6963 / EIP-1193）
- 自动提示切换 BSC Testnet
- WalletConnect 扫码暂未接入
- 读取 `balanceOf`、`walletMinted`、`totalSupply`
- 免费铸造 10 个
- BscScan 链接

链上 NFT 不会改变单机军团数据，目前是独立测试。

## 合约编译设置（用于 BscScan 验证）

- Compiler: Solidity **0.8.38**
- Optimization: **enabled, 200 runs**
- Constructor argument: 空字符串 `""`
- 源码：`contracts/OreSoldier.sol`

## 一键部署

```bash
npm install
cp .env.example .env
# 编辑 .env，填入 BSC 测试网私钥
npm run deploy:bsc-testnet
```

`.env`：

```env
BSC_TESTNET_RPC=https://bsc-testnet-rpc.publicnode.com
PRIVATE_KEY=0xYOUR_TESTNET_PRIVATE_KEY
BASE_URI=
CONTRACT_ADDRESS=0x712716b1a7a991a372d951A6873f42665918BA9a
```

部署成功后会生成 `build/deployment.json`，包含合约地址和交易哈希。

## 领取测试 BNB

部署地址需要少量测试网 BNB（通常 0.001–0.01 tBNB 足够）：

- https://faucet.chainstack.com/bnb-testnet-faucet
- https://faucet.quicknode.com/binance-smart-chain/bnb-testnet
- https://www.bnbchain.org/en/testnet-faucet

## 铸造测试

```bash
# 先部署，或把已有地址填入 .env
CONTRACT_ADDRESS=0x712716b1a7a991a372d951A6873f42665918BA9a npm run mint:test
```

脚本会：

1. 查询该地址已铸造数量
2. 免费 mint 10 个
3. 再尝试 mint 1 个，预期因每个地址上限 10 而 revert

注意：部署者 `0x7546…` 的 10 个额度已用于测试，请换一个新的 BSC 测试网地址。

## Remix 方式

### 交互已部署合约（无需重新部署）

1. 打开 https://remix.ethereum.org
2. 新建 `OreSoldier.sol`，粘贴 `contracts/OreSoldier.sol`
3. Compiler 选择 **0.8.38**，开启 optimize（200 runs）
4. Environment 选 **Injected Provider - MetaMask**
5. 网络切到 **BSC Testnet**
6. 在 Deploy 面板选择 **At Address**，填入：
   `0x712716b1a7a991a372d951A6873f42665918BA9a`
7. 调用 `mint(uint256)`，参数填 `10`

### 重新部署

1. 同上编译
2. Deploy 时 `baseURI_` 可填空字符串
3. 部署后调用 `mint(10)`

> 当前合约未在 BscScan 提交源码验证；用 Remix 直接 At Address 即可读写。

## 安全

- 仅使用测试网私钥，不要使用主网私钥。
- `.env` 已加入 `.gitignore`。
- 这是测试合约，未审计，不建议直接用于主网资产。
