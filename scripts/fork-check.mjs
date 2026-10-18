import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createWalletClient,http,parseEther,parseAbi,encodeFunctionData,toHex} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {root,rpc,local,chain,publicClient as c,artifact,readJournal,infrastructure as i,products,stringify} from './config.mjs';
if(!local)throw Error('This script ONLY runs on a local fork; never mainnet');
const j=readJournal();assert(j?.ready&&j.local);const contract=j.contracts;
const key=fs.readFileSync(process.env.BOT_SIGNER_FILE||`${process.env.HOME}/.config/botchain-wave1/deployer.env`,'utf8').match(/^DEPLOYER_PRIVATE_KEY=(.*)$/m)[1];
const owner=privateKeyToAccount(key),w=createWalletClient({account:owner,chain,transport:http(rpc)});
const abi=parseAbi(['function transfer(address,uint256) returns(bool)','function approve(address,uint256) returns(bool)','function balanceOf(address) view returns(uint256)','function deposit() payable']);
const read=(name,fn,args=[],address=contract[name])=>c.readContract({address,abi:artifact(name).abi,functionName:fn,args});
const receipts=[];
async function tx(abi,address,functionName,args=[],value=0n){const {request}=await c.simulateContract({abi,address,functionName,args,value,account:owner});const hash=await w.writeContract(request);const r=await c.waitForTransactionReceipt({hash});assert.equal(r.status,'success');receipts.push({functionName,hash,gasUsed:String(r.gasUsed)});return r;}
const write=(name,fn,args=[],value=0n,address=contract[name])=>tx(artifact(name).abi,address,fn,args,value);
await c.request({method:'anvil_setBalance',params:[owner.address,toHex(parseEther('100'))]});
// Fork only: borrow USDT from a real holder by impersonation. The live chain is never changed.
async function fundUSDT(n){const holder='0x64F418471a1A7932a190E10da5A8551dB5AbeC05';
 await c.request({method:'anvil_impersonateAccount',params:[holder]});await c.request({method:'anvil_setBalance',params:[holder,toHex(parseEther('1'))]});
 const hash=await c.request({method:'eth_sendTransaction',params:[{from:holder,to:i.USDT,gas:'0x30d40',data:encodeFunctionData({abi,functionName:'transfer',args:[owner.address,n]})}]});
 assert.equal((await c.waitForTransactionReceipt({hash})).status,'success');await c.request({method:'anvil_stopImpersonatingAccount',params:[holder]});}
const results={};
for(const p of products)if(p.fork){results[p.slug]=await p.fork({c,abi,i,tx,write,read,contract,owner,fundUSDT,rpc});console.log(`${p.name}: fork flow passed`);}
fs.writeFileSync(new URL('deployments/fork-verification.json',root),stringify({localOnly:true,chainId:677,checkedAt:new Date().toISOString(),...results,receipts}));console.log('Fork checks passed. No mainnet writes.');
