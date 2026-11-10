'use strict';
const fs=require('fs'),path=require('path'),{ethers}=require('ethers');
const root=path.join(__dirname,'..');
const RPC=process.env.BSC_TESTNET_RPC||'https://bsc-testnet-rpc.publicnode.com';
const key=JSON.parse(fs.readFileSync('/tmp/ore-zone-deployer.json','utf8')).privateKey;
const art=n=>JSON.parse(fs.readFileSync(path.join(root,'build',n+'.json'),'utf8'));
(async()=>{
 const p=new ethers.JsonRpcProvider(RPC,97,{staticNetwork:true});const w=new ethers.Wallet(key,p);
 const state=await (await fetch('http://127.0.0.1:8091/state')).json();
 const roster=[];for(const pl of state.players||[])for(const so of pl.roster||[])if(so.nftId&&!roster.find(x=>String(x.nftId)===String(so.nftId)))roster.push(Object.assign({wallet:String(pl.id||'').replace(/^w:/,'')},so));
 console.log('migrate roster',roster.length,roster.map(x=>x.nftId+':'+x.wallet.slice(0,6)).join(','));
 const deploy=async(name,args)=>{const a=art(name);const f=new ethers.ContractFactory(a.abi,a.bytecode,w);const c=await f.deploy(...args);const tx=c.deploymentTransaction();await c.waitForDeployment();console.log(name,await c.getAddress());return {c,addr:await c.getAddress(),tx:tx.hash};};
 const nft=await deploy('OreSoldierV3',['https://ore.zone/nft/']);
 const burner=await deploy('OreBurner',[nft.addr]);
 const market=await deploy('OreMarket',['0xD222B7BC58AF20a5EE2bF877A9008091Da3D00E5',nft.addr]);
 for(const so of roster){
   const d={atk:Math.max(1,Math.round(so.atk||10)),def:Math.max(1,Math.round(so.def||10)),spd:Math.max(1,Math.round(so.spd||10)),gen:Math.max(1,Math.round(so.gen||1)),power:Math.max(1,Math.round(so.power||(so.atk+so.def+so.spd)||30)),fatherId:0,motherId:0,factor:1000,bornAt:Math.floor(Date.now()/1000),cls:String(so.cls||'vanguard')};
   const tx=await nft.c.migrateWithData(so.wallet,BigInt(so.nftId),d);await tx.wait();console.log('migrated',so.nftId,so.wallet,so.name);
 }
 const out={chainId:97,deployedAt:new Date().toISOString(),nft:nft.addr,burner:burner.addr,market:market.addr,ore:state.ore||'0xD222B7BC58AF20a5EE2bF877A9008091Da3D00E5',migrated:roster.map(x=>String(x.nftId)),tx:{nft:nft.tx,burner:burner.tx,market:market.tx}};
 fs.writeFileSync(path.join(root,'build','deployment-v3.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
})().catch(e=>{console.error(e.shortMessage||e.message||e);process.exit(1)});
