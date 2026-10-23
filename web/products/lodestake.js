import {$,config,state,esc,fmt,button,form,amount,read,tx,approve,client,tokenAbi,wrapForms,chainTime,asset,status,start} from '../core.js';
const trim=v=>{const [a,b='']=v.split('.');return b?`${a}.${b.slice(0,4).replace(/0+$/,'')||'0'}`.replace(/\.0$/,''):a;};
let lastResult='—',selectedTile=4,round=null,roundId=0n,clockOffset=0,timer=null,played=0,mineTile=null;
// The current round only rolls over when someone settles it. If its window has closed, open the next one first:
// request settlement, wait the five-block reveal delay, then finalize. Anyone may do this.
async function openNextRound(){
 const r=await read('Lodestake','getRound',[await read('Lodestake','currentRoundId')]);
 if(!r.settleRequested){status('This round closed. Opening the next round (1 of 2)…');await tx('Lodestake','requestSettle');}
 const ready=Number((await read('Lodestake','getRound',[await read('Lodestake','currentRoundId')])).requestBlock)+5;
 status('Waiting five blocks for the reveal…');while(Number(await client.getBlockNumber())<ready)await new Promise(r=>setTimeout(r,800));
 status('Settling the closed round (2 of 2)…');await tx('Lodestake','finalizeSettle');
}
async function stake(f){
 const n=amount(f.stake);
 let r=await read('Lodestake','getRound',[await read('Lodestake','currentRoundId')]);
 if(await chainTime()>=Number(r.endTime)||r.settleRequested)await openNextRound();
 const id=await read('Lodestake','currentRoundId');if(state.account&&await read('Lodestake','playerRoundTotal',[id,state.account])>0n)throw Error('You already hold a tile this round. Wait for the next round.');
 await approve(config.infrastructure.WBOT,config.contracts.Lodestake,n);await tx('Lodestake','deploy',[selectedTile,n]);
}
function pick(n){selectedTile=n;for(const b of document.querySelectorAll('[data-tile]'))b.setAttribute('aria-pressed',String(Number(b.dataset.tile)===n));const p=$('picked-tile');if(p)p.textContent=`Tile ${n+1}`;}
function controls(){
 $('list-title').textContent=`Round`;
 $('controls').innerHTML='<h2>Your play</h2><p>Tap a tile on the board, set your stake, and deploy before the clock runs out.</p>'
  +`<div class="picked"><span>Selected</span><strong id="picked-tile">Tile ${selectedTile+1}</strong></div>`
  +form('stake',`<label for="stake">Stake (WBOT)</label><input id="stake" name="stake" value="0.01" inputmode="decimal" autocomplete="off" required><div class="chips" role="group" aria-label="Quick stake">${['0.01','0.05','0.1','0.5'].map(v=>`<button type="button" data-amt="${v}" aria-pressed="${v==='0.01'}">${v}</button>`).join('')}</div><p class="hint" id="stake-bal">Connect a wallet to see your WBOT balance.</p>`,'Deploy on this tile',stake)
  +wrapForms();
 $('controls').addEventListener('click',e=>{const b=e.target.closest('[data-amt]');if(!b)return;$('stake').value=b.dataset.amt;for(const x of document.querySelectorAll('[data-amt]'))x.setAttribute('aria-pressed',String(x===b));});
 $('records').addEventListener('click',e=>{const b=e.target.closest('[data-tile]');if(b)pick(Number(b.dataset.tile));});
 $('rules').innerHTML='<ul><li>One tile per wallet per round; a round lasts two minutes from when it opens.</li><li>5% of losing stakes goes to the treasury. Winners split the rest in proportion to their stake on the winning tile.</li><li>Solo rounds refund the full stake. Anyone can settle a closed round; staking after the window opens the next round for you first.</li><li>The winner comes from a fixed future block hash, not a VRF. Validators can influence this randomness.</li><li>If settlement expires after 256 blocks, every player receives a refund. House staking is disabled.</li></ul>';
}
function tick(){const el=$('clock');if(!el||!round)return;const left=Number(round.endTime)-Math.floor(Date.now()/1000+clockOffset);
 const box=el.closest('div');if(left>0){el.textContent=`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;box.classList.remove('closed');}
 else{el.textContent=round.settleRequested?'Settling':'Closed';box.classList.add('closed');}}
async function render(){
 const now=await chainTime();clockOffset=now-Date.now()/1000;
 roundId=await read('Lodestake','currentRoundId');round=await read('Lodestake','getRound',[roundId]);const totals=await read('Lodestake','getTileTotals',[roundId]);
 const pool=round.totalDeployed,open=now<Number(round.endTime)&&!round.settleRequested;played=Number(round.uniquePlayers);
 mineTile=null;if(state.account){const mine=await Promise.all([...Array(9)].map((_,n)=>read('Lodestake','playerTileDeposits',[roundId,state.account,n])));const t=mine.findIndex(v=>v>0n);if(t>=0)mineTile=t;
  const bal=await client.readContract({address:config.infrastructure.WBOT,abi:tokenAbi,functionName:'balanceOf',args:[state.account]});const h=$('stake-bal');if(h)h.innerHTML=`Balance: ${esc(trim(fmt(bal)))} ${asset('WBOT')}`;}
 $('list-title').textContent=`Round #${roundId}`;
 let html=`<div class="hud"><div><span>Clock</span><strong id="clock">—</strong></div><div><span>Pool</span><strong>${trim(fmt(pool))} WBOT</strong></div><div><span>Players</span><strong>${played}</strong></div></div>`;
 html+=`<div class="mine" role="group" aria-label="Choose your tile">`;
 for(let n=0;n<9;n++){const share=pool>0n?Number(totals[n]*1000n/pool)/10:0;
  html+=`<button type="button" data-tile="${n}" aria-pressed="${selectedTile===n}" aria-label="Tile ${n+1}: ${esc(trim(fmt(totals[n])))} WBOT staked${mineTile===n?', your tile':''}"><span class="n">${n+1}</span><span class="stake">${trim(fmt(totals[n]))} WBOT${mineTile===n?' · yours':''}</span><span class="share"><i style="width:${share}%"></i></span></button>`;}
 html+='</div>';
 if(mineTile!==null)html+=`<p class="you">You hold tile ${mineTile+1} this round.</p>`;
 if(!open)html+=`<div class="actions">${button(round.settleRequested?'Finalize this round':'Settle and open the next round',async()=>{if(round.settleRequested){await tx('Lodestake','finalizeSettle');}else await openNextRound();},true)}</div><p class="tiny">${round.settleRequested?`Settlement requested at block ${round.requestBlock}. Finalize after five blocks; expired rounds refund all stakes.`:'This round\'s window has closed. Staking opens the next round automatically.'}</p>`;
 const ids=[];for(let old=roundId-1n;old>=1n&&old>=roundId-8n;old--)ids.push(old);
 const past=await Promise.all(ids.map(async old=>[old,await read('Lodestake','getRound',[old]),state.account?await read('Lodestake','pendingClaim',[old,state.account]):0n]));
 lastResult=past.length?(past[0][1].refundMode?'Refund':past[0][1].totalDeployed===0n?'No players':`Tile ${past[0][1].winningTile+1}`):'—';
 if(past.length){html+='<h3 class="sub">Recent rounds</h3><div class="rounds">'+past.map(([old,r,pending])=>`<div class="round-chip"><strong>#${old}</strong>${r.refundMode?'Refunded':r.totalDeployed===0n?'No players':`Tile ${r.winningTile+1} won · ${trim(fmt(r.totalDeployed))} WBOT`}${pending>0n?button(`Claim ${trim(fmt(pending))}`,()=>tx('Lodestake','claim',[old]),true):''}</div>`).join('')+'</div>';}
 return html;
}
function after(){clearInterval(timer);tick();timer=setInterval(tick,1000);}
function stats(empty){return [['Rounds settled',empty||!round?'—':String(roundId-1n)],['Last result',empty?'—':lastResult],['Treasury share','5%']];}
start({controls,render,after,stats});
