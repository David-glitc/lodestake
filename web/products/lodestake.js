import {$,config,state,esc,fmt,button,action,field,form,amount,read,tx,approve,client,tokenAbi,wrapForms,chainTime,asset,start} from '../core.js';
let selectedTile=0;
function controls(){
 $('list-title').textContent='The mine';
 $('controls').innerHTML='<h2>Deploy on a tile</h2><p>Select a tile on the grid, then enter your WBOT stake.</p>'+form('stake',field('stake','Amount (WBOT)','0.01','text','inputmode="decimal"'),'Deploy WBOT',async f=>{const n=amount(f.stake);const r=await read('Lodestake','getRound',[await read('Lodestake','currentRoundId')]);if(Number((await client.getBlock()).timestamp)>=Number(r.endTime))throw Error('This round\'s deploy window has closed. Request settlement below to open the next round, then stake.');await approve(config.infrastructure.WBOT,config.contracts.Lodestake,n);await tx('Lodestake','deploy',[selectedTile,n]);})+wrapForms();
 $('rules').innerHTML='<ul><li>One tile per wallet per round; a round lasts two minutes.</li><li>5% of losing stakes goes to the treasury. Winners split the remainder in proportion to their stake on the winning tile.</li><li>Solo rounds refund the full stake. Anyone can request and finalize settlement.</li><li>The winner uses a fixed future block hash, not a VRF. Validators can influence this randomness.</li><li>If settlement expires after 256 blocks, every player receives a refund. House staking is disabled.</li></ul>';
}
async function render(){
 const id=await read('Lodestake','currentRoundId'),r=await read('Lodestake','getRound',[id]),totals=await read('Lodestake','getTileTotals',[id]);
 let html=`<div class="row"><span>Round</span><strong>#${id}</strong></div><div class="row"><span>Pool</span><strong>${fmt(r.totalDeployed)} ${asset('WBOT')}</strong></div><div class="row"><span>Deploy window ends</span><strong>${new Date(Number(r.endTime)*1000).toLocaleTimeString()}</strong></div><div class="grid" role="group" aria-label="Choose your tile">`;
 for(let n=0;n<9;n++){const key=`tile${n}`;action(key,async()=>{selectedTile=n;});html+=`<button data-action="${key}" aria-pressed="${selectedTile===n}" aria-label="Tile ${n+1}, ${esc(fmt(totals[n]))} WBOT"><strong>${n+1}</strong><small>${esc(fmt(totals[n]))} WBOT</small></button>`;}html+='</div>';
 if(await chainTime()>=Number(r.endTime))html+=`<div class="actions">${button(r.settleRequested?'Finalize settlement':'Request settlement',()=>tx('Lodestake',r.settleRequested?'finalizeSettle':'requestSettle'),true)}</div>`;
 if(r.settleRequested)html+=`<p class="tiny">Settlement requested at block ${r.requestBlock}. Finalize after five blocks; expired rounds refund all stakes.</p>`;
 if(state.account){const balance=await client.readContract({address:config.infrastructure.WBOT,abi:tokenAbi,functionName:'balanceOf',args:[state.account]});html+=`<p class="tiny">Your balance: ${fmt(balance)} ${asset('WBOT')}</p>`;}
 html+='<h3>Recent rounds</h3>';
 for(let old=id-1n;old>=1n&&old>=id-10n;old--){const round=await read('Lodestake','getRound',[old]);const pending=state.account?await read('Lodestake','pendingClaim',[old,state.account]):0n;html+=`<div class="item"><div class="row"><span>Round #${old}</span><strong>${round.refundMode?'Refund':round.totalDeployed===0n?'Empty':`Tile ${round.winningTile+1} won`}</strong></div>${pending>0n?button(`Claim ${fmt(pending)} WBOT`,()=>tx('Lodestake','claim',[old]),true):''}</div>`;}return html;
}
start({controls,render});
