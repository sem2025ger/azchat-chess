import {spawnSync} from 'node:child_process';

const branch=process.env.VERCEL_GIT_COMMIT_REF;
const qaBranch='qa/spieler-coach-compact-controls-20261030';
if(branch===qaBranch){
 const qa={
  VITE_MAINTENANCE_MODE:'false',
  VITE_SERVER_URL:'https://chessaz-ai-coach-v1-isolated-qa.onrender.com',
  VITE_SPIELER_V1_ENABLED:'true',
  VITE_POSITION_SEARCH_ENABLED:'true',
  VITE_AI_COACH_ENABLED:'true',
  VITE_VORBEREITUNG_ENABLED:'true',
  VITE_CLUBS_NRW_ENABLED:'true',
  VITE_SPIELTAG_ENABLED:'true'
 };
 Object.assign(process.env,qa);
 console.log('ChessAZ isolated QA feature configuration enabled for exact branch.');
}else{
 console.log('Non-QA branch: retaining existing environment feature flags.');
}
const result=spawnSync('npm',['run','build'],{env:process.env,stdio:'inherit',shell:process.platform==='win32'});
if(result.error)throw result.error;
process.exit(result.status??1);
