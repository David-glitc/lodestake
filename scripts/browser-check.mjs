import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {products,stringify} from './config.mjs';
// BOT_SITE_BASE checks published sites, e.g. https://{slug}-botchain.example.workers.dev; default is `npm run preview`.
const base=(p,index)=>process.env.BOT_SITE_BASE?process.env.BOT_SITE_BASE.replace('{slug}',p.slug):`http://127.0.0.1:${8771+index}`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
fs.mkdirSync('evidence',{recursive:true});const results=[];
try{
 for(const [index,product] of products.entries())for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const noOverflow=async where=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${product.name} ${where} overflows at ${width}`);
  // Landing page and the BOT Chain footer requirement.
  let response=await page.goto(base(product,index)+'/',{waitUntil:'networkidle'});assert.equal(response.status(),200);
  assert.equal(await page.locator('h1').textContent(),product.line);
  for(const id of ['how','features','onchain','faq'])assert(await page.locator(`#${id}`).count(),`${product.name} missing #${id}`);
  const footer=page.locator('footer');
  assert(await footer.locator('img[alt="BOT Chain"]').evaluate(img=>img.complete&&img.naturalWidth>0),'BOT Chain logo did not load');
  assert(await footer.locator('a[href="https://www.botchain.ai/"]').count()>=2,'BOT Chain website link missing');
  assert.equal(await footer.locator('a[href="https://scan.botchain.ai/"]').count(),1,'Explorer link missing');
  assert.equal(await footer.locator(`a[href^="https://github.com/"]`).count(),1,'GitHub link missing');
  await noOverflow('landing');await page.screenshot({path:`evidence/${product.slug}-landing-${width}.png`,fullPage:true});
  // App page.
  await page.locator('.hero a.button.primary').click();await page.waitForURL(/\/app\/$/);
  await page.locator('#status').filter({hasText:/Deployment pending|Connected to BOT Chain/}).waitFor();
  const pending=(await page.locator('#status').textContent()).includes('Deployment pending');
  if(pending){const submit=page.locator('button[type=submit]');for(let n=0;n<await submit.count();n++)assert(await submit.nth(n).isDisabled());}
  await page.getByRole('button',{name:'Connect wallet'}).click();await page.locator('#status').filter({hasText:'No wallet found'}).waitFor();
  assert(await page.locator('footer img[alt="BOT Chain"]').count());
  await noOverflow('app');await page.screenshot({path:`evidence/${product.slug}-app-${width}.png`,fullPage:true});
  assert.deepEqual(errors,[]);results.push({product:product.name,width,landing:200,app:true,botchainFooter:true,overflow:false,pageErrors:errors,pending,walletMissingHandled:true});await context.close();
 }
 fs.writeFileSync('evidence/browser-check.json',stringify({checkedAt:new Date().toISOString(),base:process.env.BOT_SITE_BASE||'local preview',results}));console.log(`Passed ${results.length} browser checks.`);
}finally{await browser.close();}
