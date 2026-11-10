'use strict';
const fs=require('fs'),path=require('path'),{ethers}=require('ethers');
const root=path.join(__dirname,'..');
const RPC=process.env.BSC_TESTNET_RPC||'https://bsc-testnet-rpc.publicnode.com';
const key=process.env.PRIVATE_KEY||JSON.parse(fs.readFileSync('/tmp/ore-zone-deployer.json','utf8')).privateKey;
const OLD='0x429a28cF913deD2E025F9e75589EEdD05ab2386e';
const art=n=>JSON.parse(fs.readFileSync(path.join(root,'build',n+'.json'),'utf8'));
(async()=>{
 const p=new ethers.JsonRpcProvider(RPC,97,{staticNetwork:true});const w=new ethers.Wallet(key,p);
 console.log('deployer',w.address,'balance',ethers.formatEther(await p.getBalance(w.address)));
 const old=new ethers.Contract(OLD,['function totalSupply() view returns(uint256)','function ownerOf(uint256) view returns(address)'],p);
 const total=Number(await old.totalSupply()); const holders=[],ids=[];
 for(let id=1;id<=total;id++){ try{const owner=await old.ownerOf(id); holders.push(owner); ids.push(id);}catch(e){} }
 console.log('migrate ids',ids.length);
 const a=art('OreSoldierV2'); const f=new ethers.ContractFactory(a.abi,a.bytecode,w); const c=await f.deploy('https://ore.zone/nft/'); const tx=c.deploymentTransaction(); console.log('nft tx',tx.hash); await c.waitForDeployment(); const nft=await c.getAddress(); console.log('nft',nft);
 const b=art('OreBurner'); const bf=new ethers.ContractFactory(b.abi,b.bytecode,w); const bc=await bf.deploy(nft); const btx=bc.deploymentTransaction(); console.log('burner tx',btx.hash); await bc.waitForDeployment(); const burner=await bc.getAddress(); console.log('burner',burner);
 let mtx=null; if(ids.length){ const args=ethers.AbiCoder.defaultAbiCoder(); const mig=await c.migrate(holders,ids); mtx=mig.hash; console.log('migrate tx',mtx); await mig.wait(); }
 const out={chainId:97,deployedAt:new Date().toISOString(),deployer:w.address,oldNft:OLD,nft,burner,totalMigrated:ids.length,migrationTx:mtx,nftTx:tx.hash,burnerTx:btx.hash,holders,ids};
 fs.writeFileSync(path.join(root,'build','deployment-nft-v2.json'),JSON.stringify(out,null,2)); console.log(JSON.stringify(out,null,2));
})().catch(e=>{console.error(e.shortMessage||e.message||e);process.exit(1)});
