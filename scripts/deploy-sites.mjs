import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {products,root,stringify} from './config.mjs';
if(process.env.BOT_BUILD_LOCAL==='1')throw Error('Refusing to publish a local fork build');
const output=[];
for(const p of products){
 const publicConfig=JSON.parse(fs.readFileSync(new URL(`dist/${p.slug}/deployment.json`,root)));
 if(publicConfig.local)throw Error('Refusing to publish local contract addresses');
 const cwd=fileURLToPath(new URL(`sites/${p.slug}/`,root));
 const result=spawnSync('node',[fileURLToPath(new URL('scripts/cf.mjs',root)),'deploy','--prebuilt',...(process.argv.includes('--dry-run')?['--dry-run']:[])],{cwd,encoding:'utf8',maxBuffer:8*1024*1024});
 if(result.status!==0){console.error(result.stdout,result.stderr);process.exit(result.status||1);}
 console.log(result.stdout);output.push({product:p.name,worker:`${p.slug}-botchain`,output:result.stdout.trim(),contractsReady:publicConfig.ready});
}
if(!process.argv.includes('--dry-run'))fs.writeFileSync(new URL('deployments/cloudflare.json',root),stringify(output));
