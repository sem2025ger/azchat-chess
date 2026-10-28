import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {Chess,DEFAULT_POSITION} from 'chess.js';
import {useNavigate} from 'react-router-dom';
import { useRegionalCopy } from '../../i18n/regionalCopy';
import {createVorbereitungApi,VorbereitungError,type PreparationGame} from '../../services/vorbereitung';
import {openSpielerAnalysis} from '../../services/spieler';
import VorbereitungResults from './VorbereitungResults';
import PreparationBoard from './PreparationBoard';
import '../../screens/VorbereitungScreen.css';
type SearchResult={hits:{id:string;ply:number}[];playerToMove:number;nextMoves:{san:string;uci:string;games:number;percent:number}[];error?:string;rejected?:number};
export default function NamedPreparation({token,initialFideId=null,initialName=''}:{token:string;initialFideId?:string|null;initialName?:string}){
 const tr=useRegionalCopy();
 const [name,setName]=useState(initialName),[fideId,setFideId]=useState(initialFideId||''),[loaded,setLoaded]=useState(false),[rejected,setRejected]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [games,setGames]=useState<PreparationGame[]>([]),[candidates,setCandidates]=useState<{fideId:string;name:string}[]>([]),[color,setColor]=useState('all'),[speed,setSpeed]=useState('all'),[timeControl,setTimeControl]=useState('all'),[variation,setVariation]=useState(''),[fen,setFen]=useState(DEFAULT_POSITION);
 const [result,setResult]=useState<SearchResult|null>(null),[search¶»§q«^