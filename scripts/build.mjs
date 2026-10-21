import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {root,products,artifact,infrastructure,site,deployedNames,assetLinks,siteURL,stringify} from './config.mjs';
const base=fileURLToPath(root);
const journalPath=new URL(`deployments/${process.env.BOT_BUILD_LOCAL==='1'?'local':'mainnet'}.json`,root);
const journal=fs.existsSync(journalPath)?JSON.parse(fs.readFileSync(journalPath)):{chainId:677,contracts:{},ready:false};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ext=(href,label)=>`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
const scan=a=>`https://scan.botchain.ai/address/${a}`;
const web=file=>fs.readFileSync(path.join(base,'web',file),'utf8');
for(const p of products){
 const dir=path.join(base,'dist',p.slug);fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(path.join(dir,'app'),{recursive:true});
 const repoURL=`https://github.com/${site.owner}/${p.repo}`,x=site.x[p.slug];
 const address=journal.contracts[p.contract],launched=journal.ready&&journal.launched?.[p.slug];
 const config={slug:p.slug,name:p.name,contract:p.contract,tokens:p.tokens||[],assetLinks,chainId:677,rpc:journal.local?'http://127.0.0.1:8677':'https://rpc.botchain.ai',contracts:journal.contracts,infrastructure,ready:journal.ready,local:!!journal.local};
 const abis=Object.fromEntries(p.abis.map(n=>[n,artifact(n).abi]));
 await build({stdin:{contents:`import './products/${p.slug}.js';`,resolveDir:path.join(base,'web'),sourcefile:'entry.js'},outfile:path.join(dir,'app.js'),bundle:true,minify:true,format:'esm',target:'es2022',define:{APP:JSON.stringify(config),ABIS:JSON.stringify(abis)}});
 const footer=`<footer class="site-footer"><div><a class="built" href="https://www.botchain.ai/" target="_blank" rel="noopener noreferrer"><span>Built on</span><img src="/botchain.svg" alt="BOT Chain" width="150" height="30"></a></div><div><h2>BOT Chain</h2><nav aria-label="BOT Chain">${ext('https://www.botchain.ai/','BOT Chain Website')}${ext('https://scan.botchain.ai/','BOTScan Explorer')}${address?ext(scan(address),`${p.name} contract`):'<a href="/#contracts">Contracts (at launch)</a>'}${ext('https://dex.botchain.ai/','BDEX')}</nav></div><div><h2>${esc(p.name)}</h2><nav aria-label="${esc(p.name)}"><a href="/app/">Launch app</a>${ext(repoURL,'GitHub')}${x?ext(`https://x.com/${x.replace(/^@/,'')}`,`X ${x.startsWith('@')?x:'@'+x}`):''}<a href="/deployment.json">Deployment record</a></nav></div><p class="legal">${esc(p.name)} · BOT Chain edition · Chain ID 677. Smart contracts are open source and unaudited; use small amounts.</p></footer>`;
 const fill=(html,extra={})=>{for(const [k,v] of Object.entries({NAME:esc(p.name),DESCRIPTION:esc(p.description),LINE:esc(p.line),EYEBROW:esc(p.eyebrow),SYMBOL:esc(p.symbol),REPO_URL:esc(repoURL),FOOTER:footer,...extra}))html=html.replaceAll(`__${k}__`,v);return html;};
 const facts=[['Network','BOT Chain mainnet · 677'],['App contract',address?ext(scan(address),address):'Deploying soon'],['Explorer',ext('https://scan.botchain.ai/','scan.botchain.ai')],['Source code',ext(repoURL,`github.com/${site.owner}/${p.repo}`)],['Launch',launched?`Officially launched on BOT Chain Mainnet · ${new Date(launched).toISOString().slice(0,10)}`:'Mainnet launch pending'],['Wallets','BO Wallet, MetaMask, any EVM wallet']];
 const launch=launched?`<aside class="launch" aria-label="Launch announcement"><strong>Officially launched on BOT Chain Mainnet</strong><span>${new Date(launched).toISOString().slice(0,10)} · ${ext(scan(address),'View contract on BOTScan')}</span></aside>`:`<aside class="launch pending" aria-label="Launch status"><strong>Mainnet launch pending</strong><span>Contracts are tested on a mainnet fork and deploy soon. The app unlocks when they are live.</span></aside>`;
 const names=await deployedNames(p);
 const contractRows=names.map(n=>{const a=journal.contracts[n];return `<div class="contract"><strong>${esc(n)}</strong>${a?ext(scan(a),a):'<span class="pending">Address appears here at mainnet launch</span>'}</div>`;}).join('');
 const assetRows=(p.assets||[]).map(k=>assetLinks[k]).filter(Boolean).map(a=>`<li><a href="${esc(a.href)}" target="_blank" rel="noopener noreferrer" title="${esc(a.name)}">${esc(a.label)} ↗</a></li>`).join('');
 const L=p.landing;
 fs.writeFileSync(path.join(dir,'index.html'),fill(web('landing.html'),{
  LAUNCH:launch,
  STEPS:L.steps.map(([t,d])=>`<li><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`).join(''),
  FEATURES:L.features.map(([t,d])=>`<div><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join(''),
  FACTS:facts.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${v.startsWith('<a')?v:esc(v)}</dd></div>`).join(''),
  FAQ:L.faq.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join(''),
  CONTRACTS:contractRows,ASSETS:assetRows,
 }));
 fs.writeFileSync(path.join(dir,'app','index.html'),fill(web('app.html'),{CONTRACTS:contractRows,ASSETS:assetRows}));
 fs.writeFileSync(path.join(dir,'404.html'),fill(web('landing.html').replace(/<main id="main">[\s\S]*<\/main>/,'<main id="main" class="band"><h1>Page not found</h1><p><a href="/">Back to __NAME__</a></p></main>'),{LAUNCH:'',CONTRACTS:'',ASSETS:''}));
 fs.writeFileSync(path.join(dir,'style.css'),web('style.css')+`\n:root{--accent:${p.color}}\n`);
 fs.copyFileSync(path.join(base,'web/botchain.svg'),path.join(dir,'botchain.svg'));
 fs.writeFileSync(path.join(dir,'icon.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#111613"/><path d="M32 8 54 20v24L32 56 10 44V20Z" fill="${p.color}"/></svg>`);
 fs.writeFileSync(path.join(dir,'deployment.json'),stringify({product:p.name,chainId:677,ready:journal.ready,launched:launched||null,contracts:Object.fromEntries((await deployedNames(p)).filter(n=>journal.contracts[n]).map(n=>[n,journal.contracts[n]])),infrastructure,local:!!journal.local,source:repoURL}));
 fs.writeFileSync(path.join(dir,'_headers'),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Cache-Control: public, max-age=60\n');
 const out=path.join(base,'sites',p.slug,'.cloudflare/output/v0');fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(path.join(out,'workers/default'),{recursive:true});
 fs.cpSync(dir,path.join(out,'workers/default/assets'),{recursive:true});
 fs.writeFileSync(path.join(out,'config.json'),stringify({buildContext:{isPreview:false,mode:'production'}}));
 fs.writeFileSync(path.join(out,'workers/default/worker.config.json'),stringify({name:`${p.slug}-botchain`,compatibilityDate:'2026-10-07',workersDev:true,domains:[],observability:{enabled:false},assets:{htmlHandling:'auto-trailing-slash',notFoundHandling:'404-page'}}));
 console.log(`${p.name}: built (${journal.ready?'contracts configured':'awaiting mainnet deployment'})`);
}
