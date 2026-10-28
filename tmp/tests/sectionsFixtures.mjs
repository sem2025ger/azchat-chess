// Isolated visual fixtures: real screens/Layout, synthetic session and data.
// This module is imported by tests only and never enters the application bundle.
export const fixture = String.raw`
import '/src/index.css';
import React from 'react';import{createRoot}from'react-dom/client';
import{MemoryRouter,Routes,Route,useNavigate}from'react-router-dom';
import{ThemeProvider}from'/src/context/ThemeContext.tsx';
import{LanguageProvider}from'/src/context/LanguageContext.tsx';
import Layout from'/src/components/Layout.tsx';
import Home from'/src/screens/HomeScreen.tsx';import Spieler from'/src/screens/SpielerScreen.tsx';
import NRW from'/src/screens/RegionOverview.tsx';import Spieltag from'/src/screens/SpieltagScreen.tsx';
import Vorbereitung from'/src/screens/VorbereitungScreen.tsx';
localStorage.setItem('app-language','de');localStorage.setItem('chess_pieceTheme','cburnett-classic');
const team='11111111-1111-4111-8111-111111111111',match='22222222-2222-4222-8222-222222222222';
const player={fide_id:13404431,name:'Huseynov, Sabir',surname:'Huseynov',federation:'GER',title:'FM',fide_rating:2371,club:null,source_date:'2026-10-25',source_url:'https://ratings.fide.com/profile/13404431'};
const native=window.fetch;
window.fetch=async(url,options={})=>{
 if(!String(url).startsWith('https://sections-fixture.invalid/'))return native(url,options);
 const path=new URL(url).pathname;let data;
 if(path==='/api/spieler/search')data={players:[player]};
 else if(path==='/api/spieler/13404431')data={player};
 else if(path==='/api/spieltag/teams')data={teams:[{id:team,club_id:team,name:'QA-Testteam nar',role:'captain'}]};
 else if(path==='/api/spieltag/clubs')data={clubs:[{id:team,name:'QA-Testverein',slug:'qa-testverein'}]};
 else if(path.endsWith('/matches'))data={matches:[{id:match,team_id:team,round_label:'QA-Testrunde 1',opponent_name:'QA-Gegnerteam (fiktiv)',starts_at:'2026-10-29T18:00:00Z',venue:'QA Preview',notes:'Fiktive Daten für die Layout-Prüfung.'}]};
 else if(path.endsWith('/boards'))data={boards:[1,2].map(n=>({match_id:match,board_number:n,home_name:n===1?'nar':'QA-Spieler 2 (Test)',home_fide_id:null,opponent_name:'QA-Gegner '+n+' (Test)',opponent_fide_id:null,result:null}))};
 else if(path==='/api/clubs-nrw/news')data={items:[]};
 else if(path==='/api/vorbereitung/player')data={fideId:'13404431',rejected:0,candidates:[],games:[]};
 else data={games:[],rejected:0};
 return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
};
function Shell(){window.fixtureNavigate=useNavigate();return <Routes><Route element={<Layout/>}><Route path='/' element={<Home/>}/><Route path='/spieler' element={<Spieler/>}/><Route path='/region/:regionId' element={<NRW/>}/><Route path='/spieltag' element={<Spieltag/>}/><Route path='/vorbereitung' element={<Vorbereitung/>}/></Route></Routes>;}
createRoot(document.getElementById('root')).render(<ThemeProvider><LanguageProvider><MemoryRouter><Shell/></MemoryRouter></LanguageProvider></ThemeProvider>);
`;

const auth = `export function useAuth(){return{user:{id:'11111111-1111-4111-8111-111111111111'},session:{access_token:'sections-fixture-only'},isLoading:false};}`;
const database = `
const id='11111111-1111-4111-8111-111111111111';
const tables={clubs_nrw:[{id,slug:'qa-testverein',name:'QA-Testverein',city:'Bochum'}],clubs_nrw_calendar:[],clubs_nrw_league_rows:[],clubs_nrw_members:[],chess_clubs:[{id}],chess_club_members:[{user_id:id}],profiles:[{id,username:'QA-Test'}],chess_club_messages:Array.from({length:12},(_,n)=>({id:String(n),author_id:id,body:'QA-Testnachricht '+(n+1)+': Gemeinsamer Schach-Treff.',created_at:'2026-10-28T09:00:00Z'}))};
export const supabase={from(table){let single=false;const q={select(){return q;},eq(){return q;},in(){return q;},gte(){return q;},order(){return q;},limit(){return q;},abortSignal(){return q;},maybeSingle(){single=true;return q;},then(resolve,reject){const rows=tables[table]||[];return Promise.resolve({data:single?(rows[0]||null):rows,error:null}).then(resolve,reject);}};return q;}};
`;

export function sectionsFixturePlugin() {
 return {name:'sections-layout-fixtures',enforce:'pre',
  resolveId(id){
   if(id==='/__sections_fixture.tsx')return id;
   if(/(?:^|\/)context\/AuthContext(?:\.tsx)?$/.test(id))return '\0sections-auth';
   if(/(?:^|\/)services\/supabase(?:\.ts)?$/.test(id))return '\0sections-db';
   if(/(?:^|\/)routeLoaders(?:\.ts)?$/.test(id))return '\0sections-preload';
  },
  load(id){
   if(id==='/__sections_fixture.tsx')return fixture;
   if(id==='\0sections-auth')return auth;
   if(id==='\0sections-db')return database;
   if(id==='\0sections-preload')return 'export const prefetchRoute=()=>{};export const scheduleNavigationPreload=()=>()=>{};';
  },
  configureServer(server){server.middlewares.use(async(req,res,next)=>{
   if(req.url!=='/sections-fixture')return next();
   res.setHeader('content-type','text/html');
   res.end(await server.transformIndexHtml('/sections-fixture','<html lang="de"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/__sections_fixture.tsx"></script></body></html>'));
  });},
 };
}
