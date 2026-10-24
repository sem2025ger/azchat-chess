'use strict';

// Pure, deterministic Swiss pairing: no tokens, timers, database, or client data.
// Results are authoritative rows from completed live matches only.
const RESULTS = new Set(['1-0', '0-1', '1/2-1/2', 'bye']);

function assertPlayers(players) {
  if (!Array.isArray(players) || players.length < 2 || players.length > 64) throw new Error('player_count');
  const seen = new Set();
  for (const p of players) {
    if (!p || typeof p.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(p.id) || seen.has(p.id)) throw new Error('invalid_player');
    seen.add(p.id);
  }
}

function computeStandings(players, games = []) {
  assertPlayers(players);
  const byId = new Map(players.map(p => [p.id, {
    id:p.id, rating:Number.isFinite(p.rating) ? p.rating : 1200,
    points:0, wins:0, draws:0, losses:0, byeUsed:false,
    colorBalance:0, colors:[], opponents:[], scoredAgainst:[],
    buchholz:0, sonnebornBerger:0,
  }]));
  for (const g of games) {
    if (!RESULTS.has(g.result)) throw new Error('invalid_result');
    const w=byId.get(g.whiteId), b=g.blackId ? byId.get(g.blackId) : null;
    if (!w || (g.blackId && !b) || (b && w===b) || (!b && g.result!=='bye')) throw new Error('invalid_game');
    if (g.result==='bye') {
      if (b || w.byeUsed) throw new Error('duplicate_bye');
      w.byeUsed=true; w.points+=1; continue;
    }
    if (!b) throw new Error('missing_opponent');
    w.colorBalance++; b.colorBalance--;
    w.colors.push('w'); b.colors.push('b');
    w.opponents.push(b.id); b.opponents.push(w.id);
    const sw=g.result==='1-0'?1:g.result==='0-1'?0:0.5, sb=1-sw;
    w.points+=sw; b.points+=sb;
    w.scoredAgainst.push([b.id,sw]); b.scoredAgainst.push([w.id,sb]);
    if(sw===1)w.wins++;else if(sb===1)b.wins++;else {w.draws++;b.draws++;}
    if(sw===0)w.losses++;
    if(sb===0)b.losses++;
  }
  for (const r of byId.values()) {
    r.buchholz=r.opponents.reduce((a,id)=>a+byId.get(id).points,0);
    r.sonnebornBerger=r.scoredAgainst.reduce((a,[id,s])=>a+byId.get(id).points*s,0);
  }
  return [...byId.values()].sort((a,b)=>
    b.points-a.points || b.buchholz-a.buchholz ||
    b.sonnebornBerger-a.sonnebornBerger || b.wins-a.wins ||
    b.rating-a.rating || a.id.localeCompare(b.id));
}

function chooseColors(a,b,round) {
  const cost=(w,bl)=>{
    let penalty=Math.abs(w.colorBalance+1)+Math.abs(bl.colorBalance-1);
    if(w.colors.slice(-2).join('')==='ww')penalty+=10;
    if(bl.colors.slice(-2).join('')==='bb')penalty+=10;
    // Prefer alternating colors, while remaining deterministic for equal penalties.
    if(w.colors.at(-1)==='w')penalty+=2;
    if(bl.colors.at(-1)==='b')penalty+=2;
    return penalty;
  };
  const aw=cost(a,b),bw=cost(b,a);
  if(aw<bw)return [a.id,b.id];
  if(bw<aw)return [b.id,a.id];
  return (round%2===0) ? [b.id,a.id] : [a.id,b.id];
}

function pairSwiss(players, previousGames, roundNumber) {
  if(!Number.isInteger(roundNumber)||roundNumber<1||roundNumber>15)throw new Error('invalid_round');
  const standings=computeStandings(players,previousGames);
  const previousPairs=new Set(previousGames.filter(g=>g.blackId)
    .map(g=>[g.whiteId,g.blackId].sort().join(':')));
  const remaining=standings.slice();
  let bye=null;
  if(remaining.length%2===1){
    // Bye goes to lowest-ranked player without an earlier bye.
    let ix=-1;
    for(let i=remaining.length-1;i>=0;i--)if(!remaining[i].byeUsed){ix=i;break;}
    if(ix<0)throw new Error('no_bye_available');
    bye=remaining.splice(ix,1)[0].id;
  }

  // Bound the optimizer: limit work for large public tournaments. A complete
  // matching always exists and fallback is deterministic even at 64 players.
  let budget=18000,best=null,bestCost=Infinity;
  const used=new Set(),current=[];
  const pairCost=(a,b)=>{
    const repeated=previousPairs.has([a.id,b.id].sort().join(':'));
    return (repeated?100000:0) + Math.round(Math.abs(a.points-b.points)*100) +
      Math.round(Math.abs(a.rating-b.rating)/70) +
      Math.min(Math.abs(a.colorBalance+1)+Math.abs(b.colorBalance-1),
               Math.abs(b.colorBalance+1)+Math.abs(a.colorBalance-1));
  };
  const search=(cost)=>{
    if(--budget<0)return;
    if(cost>=bestCost)return;
    const a=remaining.find(x=>!used.has(x.id));
    if(!a){bestCost=cost;best=current.slice();return;}
    used.add(a.id);
    const candidates=remaining.filter(b=>b.id!==a.id&&!used.has(b.id))
      .sort((x,y)=>pairCost(a,x)-pairCost(a,y)||x.id.localeCompare(y.id));
    for(const b of candidates){
      used.add(b.id);current.push([a,b]);
      search(cost+pairCost(a,b));
      current.pop();used.delete(b.id);
      if(budget<0)break;
    }
    used.delete(a.id);
  };
  // Find a valid initial solution before exploring a potentially huge search tree.
  function greedy() {
    const left=remaining.slice(),out=[];
    while(left.length){
      const a=left.shift();
      const index=left.reduce((best,i,j)=>best<0||pairCost(a,i)<pairCost(a,left[best])?j:best,-1);
      const b=left.splice(index,1)[0];out.push([a,b]);
    }
    return out;
  }
  best=greedy();
  bestCost=best.reduce((cost,[a,b])=>cost+pairCost(a,b),0);
  search(0);
  return {
    round:roundNumber,
    pairs:best.map(([a,b],index)=>{
      const [whiteId,blackId]=chooseColors(a,b,roundNumber+index);
      return {whiteId,blackId,board:index+1};
    }),
    byeId:bye,
    rematches:best.filter(([a,b])=>previousPairs.has([a.id,b.id].sort().join(':'))).length,
  };
}

module.exports={computeStandings,pairSwiss};
