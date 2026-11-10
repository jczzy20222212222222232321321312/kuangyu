require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const RPC = process.env.BSC_TESTNET_RPC || 'https://bsc-testnet-rpc.publicnode.com';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const BASE_URI = process.env.BASE_URI || '';

async function main() {
  if (!PRIVATE_KEY) throw new Error('Missing PRIVATE_KEY in .env');
  const artifact = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'OreSoldier.json'), 'utf8'));
  const provider = new ethers.JsonRpcProvider(RPC, 97, { staticNetwork: true });
  const net = await provider.getNetwork();
  if (net.chainId !== 97n) throw new Error('RPC is not BSC testnet (chainId 97), got ' + net.chainId);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log('deployer:', wallet.address);
  console.log('balance :', ethers.formatEther(await provider.getBalance(wallet.address)), 'tBNB');
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(BASE_URI);
  const tx = contract.deploymentTransaction();
  console.log('tx hash :', tx.hash);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log('contract:', address);
  console.log('explorer:', 'https://testnet.bscscan.com/address/' + address);
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'deployment.json'), JSON.stringify({
    chainId: 97, address, txHash: tx.hash, deployer: wallet.address, baseURI: BASE_URI,
  }, null, 2));
}
main().catch((e) => { console.error(e.shortMessage || e.message); process.exit(1); });
