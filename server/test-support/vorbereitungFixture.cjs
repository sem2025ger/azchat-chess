'use strict';
function game({id='abcdefgh',color='white',result='1-0',opening='Sicilian Defense: Najdorf Variation',eco='B90',username='target',speed='blitz',createdAt=1700000000000}={}){
 const white=color==='white'?username:'opponent',black=color==='black'?username:'opponent';
 return {id,variant:'standard',status:result==='1/2-1/2'?'draw':'resign',winner:result==='1/2-1/2'?undefined:result==='1-0'?'white':'black',speed,createdAt,
  clock:{initial:300,increment:0},players:{white:{user:{id:white}},black:{user:{id:black}}},opening:{name:opening,eco},
  pgn:`[Event "Fixture"]\n[White "${white}"]\n[Black "${black}"]\n[Date "2026.10.25"]\n[Result "${result}"]\n\n1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 ${result}`};
}
module.exports={game};
