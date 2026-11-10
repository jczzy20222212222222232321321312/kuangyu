'use strict';
const fs=require('fs'),path=require('path'),{ethers}=require('ethers');
const root=path.join(__dirname,'..');
const RPC=process.env.BSC_TESTNET_RPC||'https://bsc-testnet-rpc.publicnode.com';
const key=process.env.PRIVATE_KEY||JSON.parse(fs.readFileSync('/tmp/ore-zone-deployer.json','utf8')).privateKey;
const ORE='0xD222B7BC58AF20a5EE2bF877A9008091Da3D00E5';
const NFT='0x712716b1a7a991a372d951A6873f42665918BA9a';
(async()=>{
 const p=new ethers.JsonRpcProvider(RPC,97,{staticNetwork:true});const w=new ethers.Wallet(key,p);console.log('balance',ethers.formatEther(await p.getBalance(w.address)));
 const a=JSON.parse(fs.readFileSync(path.join(root,'build','OreMarket.json'),'utf8'));
 const f=new ethers.ContractFactory(a.abi,a.bytecode,w);const c=await f.deploy(ORE,NFT);const tx=c.deploymentTransaction();console.log('tx',tx.hash);await c.waitForDeployment();const address=await c.getAddress();console.log('market',address);
 const out={chainId:97,deployedAt:new Date().toISOString(),market:address,ore:ORE,nft:NFT,deployer:w.address,txHash:tx.hash};fs.writeFileSync(path.join(root,'build','deployment-market.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
})().catch(e=>{console.error(e.shortMessage||e.message||e);process.exit(1)});
