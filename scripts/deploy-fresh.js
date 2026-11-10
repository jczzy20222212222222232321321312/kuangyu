/* Deploy a fresh BSC Testnet stack:
 * ORE 100,000,000; 80,000,000 to OreMinePool; 10,000,000 to OreVault;
 * 10,000,000 retained by deployer. NFT token ids start at 1 and are the
 * canonical soldier ids used by the game server.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const root = path.join(__dirname, '..');
const RPC = process.env.BSC_TESTNET_RPC || 'https://bsc-testnet-rpc.publicnode.com';
const KEY = process.env.PRIVATE_KEY || JSON.parse(fs.readFileSync(process.env.DEPLOYER_FILE || '/tmp/ore-zone-deployer.json', 'utf8')).privateKey;
const SUPPLY = 100_000_000n * 10n ** 18n;
const POOL = 80_000_000n * 10n ** 18n;
const VAULT = 10_000_000n * 10n ** 18n;
const BASE_URI = process.env.BASE_URI || 'https://ore.zone/nft/';
const art = (name) => JSON.parse(fs.readFileSync(path.join(root, 'build', name + '.json'), 'utf8'));
async function main() {
  const provider = new ethers.JsonRpcProvider(RPC, 97, { staticNetwork: true });
  const net = await provider.getNetwork();
  if (net.chainId !== 97n) throw new Error('not BSC testnet: ' + net.chainId);
  const wallet = new ethers.Wallet(KEY, provider);
  console.log('deployer', wallet.address);
  console.log('balance', ethers.formatEther(await provider.getBalance(wallet.address)));
  const deploy = async (name, args) => {
    const a = art(name);
    const f = new ethers.ContractFactory(a.abi, a.bytecode, wallet);
    const c = await f.deploy(...args);
    const tx = c.deploymentTransaction();
    console.log(name, 'tx', tx.hash, 'gas', tx.gasLimit?.toString());
    await c.waitForDeployment();
    const address = await c.getAddress();
    console.log(name, address);
    return { c, address, txHash: tx.hash };
  };
  const token = await deploy('OreToken', [SUPPLY]);
  const soldier = await deploy('OreSoldier', [BASE_URI]);
  const vault = await deploy('OreVault', [token.address, wallet.address]);
  const pool = await deploy('OreMinePool', [token.address, wallet.address]);
  const burner = await deploy('OreBurner', [soldier.address]);
  console.log('funding...');
  let tx = await token.c.transfer(pool.address, POOL); await tx.wait(); console.log('pool funded', POOL.toString());
  tx = await token.c.transfer(vault.address, VAULT); await tx.wait(); console.log('vault funded', VAULT.toString());
  const out = {
    chainId: 97, deployedAt: new Date().toISOString(), deployer: wallet.address,
    ore: token.address, soldier: soldier.address, vault: vault.address,
    minePool: pool.address, burner: burner.address,
    totalSupply: SUPPLY.toString(), poolFunded: POOL.toString(), vaultFunded: VAULT.toString(),
    deployerRetained: (SUPPLY - POOL - VAULT).toString(),
    txHashes: { ore: token.txHash, soldier: soldier.txHash, vault: vault.txHash, minePool: pool.txHash, burner: burner.txHash },
  };
  fs.writeFileSync(path.join(root, 'build', 'deployment-fresh.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}
main().catch((e) => { console.error(e.shortMessage || e.message || e); process.exit(1); });
