import {useState} from 'react';
import {useRegionalCopy} from '../../i18n/regionalCopy';
import {Chess,DEFAULT_POSITION,type Square,type PieceSymbol,type Color} from 'chess.js';
import {validateAnalysisFen} from '../../utils/analysisWorkspace';
import {preparationMoves} from '../../utils/preparationPositions';
import ChessBoard from '../ChessBoard';
const pieces=['wK','wQ','wR','wB','wN','wP','bK','bQ','bR','bB','bN','bP'];
const squares=Array.from({length:64},(_,i)=>('abcdefgh'[i%8]+(8-Math.floor(i/8))) as Square);
export default function PreparationBoard({fen,onFen}:{fen:string;onFen:(fen:string)=>void}){
 const tr=useRegionalCopy();
 const [mode,setMode]=useState<'moves'|'setup'>('moves'),[text,setText]=useState(''),[draft,setDraft]=useState(fen),[error,setError]=useState(''),[selected,setSelected]=useState<Square|null>(null);
 const [palette,setPalette]=useState('wP'),[promotion,setPromotion]=useState<PieceSymbol>('q');
 const shown=mode==='setup'?draft:fen;let board:Chess;try{board=new Chess(shown,{skipValidation:true});}catch{board=new Chess();}
 function accept(value:string){try{const valid=validateAnalysisFen(value);setError('');onFen(valid);setDraft(valid);return true;}catch{setError('Ungültige Stellung');return false;}}
 function click(square:Square){
  if(mode==='setup'){
   let g:Chess;try{g=new Chess(draft,{skipValidation:true});}catch{setError('Ungültige Stellung');return;}g.remove(square);if(palette!=='erase')g.put({color:palette[0] as Color,type:palette[1].toLowerCase() as PieceSymbol},square);
   const fields=g.fen({forceEnpassantSquare:true}).split(' ');fields[2]='-';fields[3]='-';setDraft(fields.join(' '));setError('');return;
  }
  if(!selected){setSelected(square);return;}const g=new Chess(fen);try{g.move({from:selected,to:square,promotion});accept(g.fen());}catch{setError('Dieser Zug ist nicht möglich.');}setSelected(null);
 }
 return <section className="preparation-position"><h2>{tr('Nach Zügen oder Stellung suchen')}</h2><div className="spieltag-actions"><button type="button" aria-pressed={mode==='moves'} onClick={()=>{setMode('moves');setSelected(null);setError('');}}>{tr('Züge spielen')}</button><button type="button" aria-pressed={mode==='setup'} onClick={()=>{setMode('setup');setDraft(fen);setSelected(null);setError('');}}>{tr('Stellung aufstellen')}</button><button type="button" onClick={()=>{setDraft(DEFAULT_POSITION);accept(DEFAULT_POSITION);setText('');}}>{tr('Grundstellung')}</button></div>
  <div className="preparation-shared-board" role="group" aria-label={tr('Vorbereitungsbrett')}>
   <ChessBoard game={board} readOnly overrideBoardTheme="Classic Wood" overridePieceTheme="cburnett-classic" className="!border-0 !p-0"/>
   <div className="preparation-board-input">{squares.map(square=>{const piece=board.get(square),key=piece?piece.color+piece.type.toUpperCase():'';return <button key={square} type="button" aria-label={square+(key?' '+key:' '+tr('leer'))} aria-pressed={selected===square} onClick={()=>click(square)}/>;})}</div>
  </div>
  {mode==='moves'?<><label>{tr('Umwandlung')}<select value={promotion} onChange={e=>setPromotion(e.target.value as PieceSymbol)}><option value="q">{tr('Dame')}</option><option value="r">{tr('Turm')}</option><option value="b">{tr('Läufer')}</option><option value="n">{tr('Springer')}</option></select></label><form onSubmit={e=>{e.preventDefault();try{accept(preparationMoves(text).fen);}catch{setError('Ungültige Zugfolge');}}}><label>{tr('Züge (SAN oder deutsche Figurenbuchstaben)')}<input value={text} maxLength={12000} placeholder="1.e4 c5 2.Nf3 d6 3.d4" onChange={e=>setText(e.target.value)}/></label><button>{tr('Züge suchen')}</button></form></>:<>
   <div className="preparation-palette" role="group" aria-label={tr('Figurenpalette')}>{[...pieces,'erase'].map(p=><button key={p} type="button" aria-pressed={palette===p} aria-label={p==='erase'?tr('Entfernen'):p} onClick={()=>setPalette(p)}>{p==='erase'?tr('Entfernen'):<img src={'/chess-assets/pieces/cburnett/'+p+'.svg'} alt="" width="28" height="28"/>}</button>)}</div>
   <div className="spieltag-actions"><button type="button" onClick={()=>{setDraft('8/8/8/8/8/8/8/8 w - - 0 1');setError('');}}>{tr('Brett leeren')}</button><label>{tr('Am Zug')}<select value={draft.split(' ')[1]||'w'} onChange={e=>{const p=draft.split(' ');p[1]=e.target.value;setDraft(p.join(' '));}}><option value="w">{tr('Weiß')}</option><option value="b">{tr('Schwarz')}</option></select></label><label>{tr('Rochaderechte')}<input value={draft.split(' ')[2]||'-'} onChange={e=>{const p=draft.split(' ');p[2]=e.target.value;setDraft(p.join(' '));}} maxLength={4}/></label></div>
   <form onSubmit={e=>{e.preventDefault();accept(draft);}}><label>FEN<input value={draft} maxLength={200} onChange={e=>setDraft(e.target.value)}/></label><button>{tr('Stellung suchen')}</button></form>
  </>}{error&&<p role="alert">{tr(error)}</p>}
 </section>;
}
