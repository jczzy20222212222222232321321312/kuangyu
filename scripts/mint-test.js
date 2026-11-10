require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const RPC = process.env.BSC_TESTNET_RPC || 'https://bsc-testnet-rpc.publicnode.com';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ADDRESS = process.env.CONTRACT_ADDRESS;

async function main() {
  if (!PRIVATE_KEY || !ADDRESS) throw new Error('Set PRIVATE_KEY and CONTRACT_ADDRESS in .env');
  const artifact = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'OreSoldier.json'), 'utf8'));
  const provider = new ethers.JsonRpcProvider(RPC, 97, { staticNetwork: true });
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const c = new ethers.Contract(ADDRESS, artifact.abi, wallet);

  console.log('wallet minted:', (await c.walletMinted(wallet.address)).toString());
  console.log('total supply :', (await c.totalSupply()).toString(), '/ 10000');
  const tx = await c['mint(uint256)'](10);
  console.log('mint tx      :', tx.hash);
  await tx.wait();
  console.log('wallet minted:', (await c.walletMinted(wallet.address)).toString());
  console.log('balanceOf    :', (await c.balanceOf(wallet.address)).toString());
  console.log('total supply :', (await c.totalSupply()).toString());
  try {
    const over = await c['mint(uint256)'](1);
    await over.wait();
    console.log('ERROR: 11th mint unexpectedly succeeded');
    process.exitCode = 2;
  } catch (e) {
    console.log('11th mint reverted (expected):', e.shortMessage || 'reverted');
  }
}
main().catch((e) => { console.error(e.shortMessage || e.message); process.exit(1); });
