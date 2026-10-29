export function analysePreparation(source,{color='all',speed='all',timeControl='all',variation=''}={}){
 const query=variation.trim().toLowerCase();
 const games=source.filter(g=>(color==='all'||g.color===color)&&(speed==='all'||g.speed===speed)&&
  (timeControl==='all'||g.timeControl===timeControl)&&(!query||(/^[a-e]\d\d$/.test(query)?g.eco?.toLowerCase()===query:g.opening.toLowerCase().includes(query))));
 function stats(rows){let wins=0,draws=0,losses=0;for(const g of rows){if(g.result==='1/2-1/2')draws++;else if(g.result===(g.color==='white'?'1-0':'0-1'))wins++;else losses++;}
  const pct=n=>rows.length?Math.round(n*1000/rows.length)/10:0;return {games:rows.length,wins,draws,losses,winPct:pct(wins),drawPct:pct(draws),lossPct:pct(losses)};}
 const groups=new Map();for(const game of games){const key=game.color+'\n'+(game.eco||'')+'\n'+game.opening;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(game);}
 return {games,byColor:{white:stats(games.filter(g=>g.color==='white')),black:stats(games.filter(g=>g.color==='black'))},
  openings:[...groups.values()].map(rows=>({color:rows[0].color,opening:rows[0].opening,eco:rows[0].eco,...stats(rows)})).sort((a,b)=>b.games-a.games||a.opening.localeCompare(b.opening)||a.color.localeCompare(b.color))};
}
