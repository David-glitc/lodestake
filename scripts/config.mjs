import fs from 'node:fs';
import {defineChain,createPublicClient,http} from 'viem';
import list from './products/index.mjs';
export const root=new URL('../',import.meta.url);
export const rpc=process.env.BOT_RPC_URL||'https://rpc.botchain.ai';
export const local=/^http:\/\/(127\.0\.0\.1|localhost):/.test(rpc);
export const chain=defineChain({id:677,name:'BOT Chain',nativeCurrency:{name:'BOT',symbol:'BOT',decimals:18},rpcUrls:{default:{http:[rpc]}},blockExplorers:{default:{name:'BOTScan',url:'https://scan.botchain.ai'}}});
export const publicClient=createPublicClient({chain,transport:http(rpc,{timeout:30000,retryCount:2})});
export const infrastructure={USDT:'0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C',WBOT:'0xD5452816194a3784dBa983426cCe7c122F4abd30',router:'0x07032d47A1b9f8460cBeE9dC17c1d3E438693929',quoter:'0x034A705b36067cff99ABf5C662Be881cBd8d0176',fee:3000};
export const products=list;
// Links shown on every site. Fill in X handles once the official accounts exist.
export const site={owner:'David-glitc',x:JSON.parse(fs.existsSync(new URL('social.json',root))?fs.readFileSync(new URL('social.json',root)):'{}')};
const sources=Object.assign({},...list.map(p=>p.artifacts||{}));
export const artifact=name=>JSON.parse(fs.readFileSync(new URL(`contracts/out/${sources[name]||name}.sol/${name}.json`,root)));
export const journalURL=new URL(`deployments/${local?'local':'mainnet'}.json`,root);
export const readJournal=()=>fs.existsSync(journalURL)?JSON.parse(fs.readFileSync(journalURL)):null;
export const stringify=value=>JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n';
/** Contract names a product deploys, found by dry-running its deploy step. */
export async function deployedNames(p){const names=[];await p.deploy({deploy:async n=>{names.push(n);return '0x'+'0'.repeat(40);},configure:async()=>{},account:{address:'0x'+'0'.repeat(40)},i:infrastructure});return names;}
