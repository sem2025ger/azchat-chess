/** Format SAN moves using absolute half-move indices (ply): white 1., black 1... when first. */
export function formatNumberedMoves(moves:readonly string[],startPly=0):string {
 if(!Number.isInteger(startPly)||startPly<0)return '';
 return moves.map((san,index)=>{
  const ply=startPly+index,number=Math.floor(ply/2)+1;
  return (ply%2===0?number+'. ':index===0?number+'... ':'')+san;
 }).join(' ');
}
export function formatNumberedMove(move:string,ply:number):string {
 return formatNumberedMoves([move],ply);
}
