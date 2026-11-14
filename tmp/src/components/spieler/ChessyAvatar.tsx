import './ChessyAvatar.css';

type State='idle'|'ready'|'thinking'|'listening'|'speaking';
export default function ChessyAvatar({state='idle',compact=false}:{state?:State;compact?:boolean}){
 return <span className={'chessy-avatar chessy-avatar--'+state+(compact?' chessy-avatar--compact':'')} aria-hidden="true">
  <svg viewBox="0 0 80 80" focusable="false" xmlns="http://www.w3.org/2000/svg">
   <path d="M23 25 16 9 35 20M57 25 64 9 45 20" fill="#e7c28a" stroke="#503a2d" strokeWidth="3.5" strokeLinejoin="round"/>
   <path d="m21 22-2-8 10 8M59 22l2-8-10 8" fill="#a15f69"/>
   <path d="M32 19 35 11l5 5 6-5 3 8" fill="#d5ad63" stroke="#866132" strokeWidth="2" strokeLinejoin="round"/>
   <rect x="17" y="18" width="46" height="48" rx="19" fill="#f1eee6" stroke="#ae9a7f" strokeWidth="2"/>
   <path d="M24 53q16 13 32 0v13H24Z" fill="#1a2938"/>
   <circle className="chessy-eye" cx="32" cy="39" r="4" fill="#283444"/><circle className="chessy-eye" cx="48" cy="39" r="4" fill="#283444"/>
   <path d="m37 48 3 3 3-3Z" fill="#bd808a"/><path d="M40 51q-4 5-7 1M40 51q4 5 7 1" fill="none" stroke="#76625c" strokeWidth="1.8" strokeLinecap="round"/>
   <path d="m22 47-10-2m10 6-10 2m46-6 10-2m-10 6 10 2" stroke="#b8a58d" strokeWidth="1.5" strokeLinecap="round"/>
   <path d="M37 61h6" stroke="#e5c27e" strokeWidth="3" strokeLinecap="round"/>
   <circle className="chessy-signal" cx="62" cy="21" r="5" fill="#99d9aa"/>
  </svg>
 </span>;
}
