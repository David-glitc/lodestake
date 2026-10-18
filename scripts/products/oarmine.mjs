import {parseEther} from 'viem';
export default {
 slug:'oarmine',name:'OarMine',repo:'oarmine',contract:'OarMine',color:'#ffa84c',eyebrow:'ONCHAIN GRID GAME',symbol:'✦',
 line:'Nine tiles. One winning vein.',
 description:'A pooled grid game using WBOT. Play a tile, settle the round, and claim your payout.',
 abis:['OarMine'],
 contracts:['src/OarMine.sol','src/interfaces/IERC20.sol'],tests:['test/OarMine.t.sol'],
 landing:{
  steps:[['Pick a tile','Choose one of nine tiles and stake WBOT during the two-minute round.'],['Settle the round','Anyone requests settlement; a future block hash picks the winning tile.'],['Claim your share','Winners split the losing stakes in proportion to their stake, minus a 5% treasury fee.']],
  features:[['Open settlement','Any player can request and finalize a round — no operator needed.'],['Refund safety','Solo rounds and expired settlements return every stake in full.'],['No house edge staking','House staking is disabled; players only play against each other.'],['Wrap in place','Wrap BOT into WBOT right inside the app.']],
  faq:[['How is the winner chosen?','From a block hash fixed at request time. It is not a VRF, and validators could influence it; play small.'],['What does the treasury take?','5% of losing stakes. Winning stakes are returned in full plus winnings.'],['What if nobody settles?','If settlement is not finalized within 256 blocks, everyone gets a refund.'],['Can the owner take player funds?','No. Staked WBOT can only leave as payouts or refunds.']],
 },
 async deploy({deploy,account,i}){await deploy('OarMine',[i.WBOT,account.address]);},
 async fork({c,abi,i,tx,write,read,contract,owner}){
  await tx(abi,i.WBOT,'deposit',[],parseEther('0.01'));await tx(abi,i.WBOT,'approve',[contract.OarMine,parseEther('0.01')]);
  const round=await read('OarMine','currentRoundId');const r=await read('OarMine','getRound',[round]);
  let active=round;if(Number((await c.getBlock()).timestamp)>=Number(r.endTime)){await write('OarMine','requestSettle');await c.request({method:'anvil_mine',params:['0x6']});await write('OarMine','finalizeSettle');active=await read('OarMine','currentRoundId');}
  await write('OarMine','deploy',[4,parseEther('0.01')]);await c.request({method:'evm_increaseTime',params:[121]});await c.request({method:'evm_mine',params:[]});await write('OarMine','requestSettle');await c.request({method:'anvil_mine',params:['0x6']});await write('OarMine','finalizeSettle');
  if(await read('OarMine','pendingClaim',[active,owner.address])!==parseEther('0.01'))throw Error('OarMine solo refund mismatch');await write('OarMine','claim',[active]);
  return {round:String(active),flow:'wrap → approve → stake → settle → refund claim'};
 },
};
