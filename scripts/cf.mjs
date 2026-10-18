import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const values={};
// Prefer CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID from the environment (scripts/publish.py sets them).
const file=process.env.CF_CREDENTIALS_FILE||'/dev/null';
for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
 const m=line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);if(!m)continue;
 let value=m[2];if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);values[m[1]]=value;
}
const env={...process.env,CLOUDFLARE_API_TOKEN:process.env.CLOUDFLARE_API_TOKEN||values.CLOUDFLARE_API_TOKEN||values.API_TOKEN,CLOUDFLARE_ACCOUNT_ID:process.env.CLOUDFLARE_ACCOUNT_ID||values.CLOUDFLARE_ACCOUNT_ID||values.VPS_ACCOUNT_ID||values.VPS_ACOUNT_ID,NODE_OPTIONS:'--dns-result-order=ipv4first',NO_COLOR:'1',CF_QUIET:'1'};
const result=spawnSync('cf',process.argv.slice(2),{env,stdio:'inherit'});process.exit(result.status??1);
