import {useEffect,useRef,useState} from 'react';
import {useRegionalCopy} from '../../i18n/regionalCopy';
import {Chess,DEFAULT_POSITION,type Square,type PieceSymbol,type Color} from 'chess.js';
import {validateAnalysisFen} from '../../utils/analysisWorkspace';
import {initialBoardState,boardAt,boardMove,boardSeek,boardText,type PreparationBoardState} from '../../utils/preparationBoardState';
import {ArrowLeft,ArrowRight,FlipHorizontal,RotateCcw,Maximize2,Minimize2} from 'lucide-react';
import ChessBoard from '../ChessBoard';
const pieces=['wK','wQ','wR','wB','wN','wP','bK','bQ','bR','bB','bN','bP'];
const squares=Array.from({length:64},(_,i)=>('abcdefgh'[i%8]+(8-Math.floor(i/8))) as Square);
export default function PreparationBoard({fen,onFen,initialState,onState,orientation='w',onReset,showMoveSearch=true,showModeSwitcher=true,allowFullscreen=false}:{fen:string;onFen:(fen:string)=>void;initialState?:PreparationBoardState;onState?:(state:PreparationBoardState)=>void;orientation?:'w'|'b';onReset?:()=>void;showMoveSearch?:boolean;showModeSwitcher?:boolean;allowFullscreen?:boolean}){
 const tr=useRegionalCopy();
 const expandLabel=tr("Brett vergrößern")==="Brett vergrößern"?"Развернуть доску":tr("Brett vergrößern");
 const shrinkLabel=tr("Brett verkleinern")==="Brett verkleinern"?"Вернуть доску":tr("Brett verkleinern");
 const boardContainer=useRef<HTMLElement>(null);
 const [fullscreen,setFullscreen]=useState(false);
 useEffect(()=>{const changed=()=>setFullscreen(document.fullscreenElement===boardContainer.current);document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed);},[]);
 async function toggleFullscreen(){if(!boardContainer.current)return;try{if(document.fullscreenElement===boardContainer.current)await document.exitFullscreen();else if(!document.fullscreenElement)await boardContainer.current.requestFullscreen();}catch{/* Browser can deny fullscreen; normal board remains usable. */}}

 const [state,setState]=useState(()=>showModeSwitcher?(initialState||initialBoardState(fen)):{...(initialState||initialBoardState(fen)),mode:'moves' as const}),[flipped,setFlipped]=useState(initialState?.flipped||false);
 const {mode,text,draft}=state;const setMode=(mode:'moves'|'setup')=>setState(s=>({...s,mode})),setText=(text:string)=>setState(s=>({...s,text,source:'text'})),setDraft=(draft:string)=>setState(s=>({...s,draft}));
 useEffect(()=>{onState?.({...state,flipped});},[state,flipped,onState]);
 const [observedFen,setObservedFen]=useState(fen);
 if(observedFen!==fen){setObservedFen(fen);if(boardAt(state)!==fen)setState(initialBoardState(fen));}
 const facing=flipped?(orientation==='w'?'b':'w'):orientation;
 const [error,setError]=useState(''),[selected,setSelected]=useState<Square|null>(null);
 const [promotionMove,setPromotionMove]=useState<[Square,Square]|null>(null);
 const [palette,setPalette]=useState('wP'),[promotion,setPromotion]=useState<PieceSymbol>('q');
 const shown=mode==='setup'?draft:fen;let board:Chess;try{board=new Chess(shown,{skipValidation:true});}catch{board=new Chess();}
 function accept(value:string){try{const valid=validateAnalysisFen(value);setError('');onFen(valid);setState({...initialBoardState(valid),mode});return true;}catch{setError('Ungültige Stellung');return false;}}
 function click(square:Square){
  if(mode==='setup'){
   let g:Chess;try{g=new Chess(draft,{skipValidation:true});}catch{setError('Ungültige Stellung');return;}g.remove(square);if(palette!=='erase')g.put({color:palette[0] as Color,type:palette[1].toLowerCase() as PieceSymbol},square);
   const fields=g.fen({forceEnpassantSquare:true}).split(' ');fields[2]='-';fields[3]='-';setDraft(fields.join(' '));setError('');return;
  }
  if(!selected){setSelected(square);return;}const moving=board.get(selected);if(moving?.type==='p'&&(square[1]==='8'||square[1]==='1')){setPromotionMove([selected,square]);return;}try{const next=boardMove(state,selected,square,promotion);setState(next);setError('');onFen(boardAt(next));}catch{setError('Dieser Zug ist nicht möglich.');}setSelected(null);
 }
 function seek(delta:number){const next=boardSeek(state,delta);if(next.cursor!==state.cursor){setState(next);setSelected(null);setError('');onFen(boardAt(next));}}
 return <section ref={boardContainer} className="preparation-position" tabIndex={0} onKeyDown={e=>{if(mode!=='moves'||e.altKey||e.ctrlKey||e.metaKey||(e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();seek(e.key==='ArrowLeft'?-1:1);}}}><h2>{tr('Nach Zügen oder Stellung suchen')}</h2>{allowFullscreen&&<button className="preparation-fullscreen-action" type="button" onClick={()=>void toggleFullscreen()} aria-label={fullscreen?shrinkLabel:expandLabel} title={fullscreen?"Вернуть доску":"Развернуть доску"}>{fullscreen?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</button>}{showModeSwitcher&&<div className="spieltag-actions preparation-mode"><button type="button" aria-pressed={mode==='moves'} onClick={()=>{setMode('moves');setSelected(null);setError('');}}>{tr('Züge spielen')}</button><button type="button" aria-pressed={mode==='setup'} onClick={()=>{setMode('setup');setDraft(fen);setSelected(null);setError('');}}>{tr('Stellung aufstellen')}</button></div>}
  <div className="preparation-shared-board" role="group" aria-label={tr('Vorbereitungsbrett')}>
   <ChessBoard game={board} readOnly overrideBoardTheme="Classic Wood" overridePieceTheme="cburnett-classic" className="!border-0 !p-0" orientation={facing}/>
   <div className="preparation-board-input">{(facing==='b'?[...squares].reverse():squares).map(square=>{const piece=board.get(square),key=piece?piece.color+piece.type.toUpperCase():'';return <button key={square} type="button" aria-label={square+(key?' '+key:' '+tr('leer'))} aria-pressed={selected===square} onClick={()=>click(square)}/>;})}</div>
  </div>
  <div className="spieltag-actions preparation-toolbar"><button type="button" aria-label={tr('Zurück')} disabled={mode!=='moves'||state.cursor===0} onClick={()=>seek(-1)}><ArrowLeft size={14}/><span>{tr('Zurück')}</span></button><button type="button" aria-label={tr('Vorwärts')} disabled={mode!=='moves'||state.cursor===state.steps.length-1} onClick={()=>seek(1)}><ArrowRight size={14}/><span>{tr('Vorwärts')}</span></button><button type="button" aria-label={tr('Brett drehen')} onClick={()=>setFlipped(v=>!v)}><FlipHorizontal size={14}/><span>{tr('Drehen')}</span></button><button type="button" aria-label={tr('Grundstellung')} onClick={()=>{setState(initialBoardState());setFlipped(false);setSelected(null);setPromotionMove(null);setError('');onReset?.();onFen(DEFAULT_POSITION);}}><RotateCcw size={14}/><span>{tr('Anfang')}</span></button></div>
  {promotionMove&&<div className="preparation-promotion" role="dialog" aria-label={tr('Umwandlung')}>{(['q','r','b','n'] as const).map(piece=><button type="button" key={piece} onClick={()=>{try{const next=boardMove(state,promotionMove[0],promotionMove[1],piece);setState(next);setPromotion(piece);onFen(boardAt(next));setError('');}catch{setError('Dieser Zug ist nicht möglich.');}setPromotionMove(null);setSelected(null);}}>{tr(piece==='q'?'Dame':piece==='r'?'Turm':piece==='b'?'Läufer':'Springer')}</button>)}</div>}
  {mode==='moves'?(showMoveSearch?<><p role="status">{tr(state.source==='board'?'Eingabe: Züge auf dem Brett':'Eingabe: Textzüge ab Grundstellung')}</p><form className="preparation-moves-input" onSubmit={e=>{e.preventDefault();if(!text.trim()){setError('Gib Züge ein oder spiele auf dem Brett weiter.');return;}try{const next=boardText(state);setState(next);setError('');onFen(boardAt(next));}catch{setError('Ungültige Zugfolge');}}}><label><span className="sr-only">{tr('Züge (SAN oder deutsche Figurenbuchstaben)')}</span><input value={text} maxLength={12000} placeholder="1.e4 c5 2.Nf3 d6 3.d4" onChange={e=>setText(e.target.value)}/></label><button>{tr('Züge suchen')}</button></form></>:null):<>
   <label>{tr('Umwandlung')}<select value={promotion} onChange={e=>setPromotion(e.target.value as PieceSymbol)}><option value="q">{tr('Dame')}</option><option value="r">{tr('Turm')}</option><option value="b">{tr('Läufer')}</option><option value="n">{tr('Springer')}</option></select></label><div className="preparation-palette" role="group" aria-label={tr('Figurenpalette')}>{[...pieces,'erase'].map(p=><button key={p} type="button" aria-pressed={palette===p} aria-label={p==='erase'?tr('Entfernen'):p} onClick={()=>setPalette(p)}>{p==='erase'?tr('Entfernen'):<img src={'/chess-assets/pieces/cburnett/'+p+'.svg'} alt="" width="28" height="28"/>}</button>)}</div>
   <div className="spieltag-actions"><button type="button" onClick={()=>{setDraft('8/8/8/8/8/8/8/8 w - - 0 1');setError('');}}>{tr('Brett leeren')}</button><label>{tr('Am Zug')}<select value={draft.split(' ')[1]||'w'} onChange={e=>{const p=draft.split(' ');p[1]=e.target.value;setDraft(p.join(' '));}}><option value="w">{tr('Weiß')}</option><option value="b">{tr('Schwarz')}</option></select></label><label>{tr('Rochaderechte')}<input value={draft.split(' ')[2]||'-'} onChange={e=>{const p=draft.split(' ');p[2]=e.target.value;setDraft(p.join(' '));}} maxLength={4}/></label></div>
   <form onSubmit={e=>{e.preventDefault();accept(draft);}}><label>FEN<input value={draft} maxLength={200} onChange={e=>setDraft(e.target.value)}/></label><button>{tr('Stellung suchen')}</button></form>
  </>}{error&&<p role="alert">{tr(error)}</p>}
 </section>;
}
