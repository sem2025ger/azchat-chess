import {spawnSync} from 'node:child_process';
import {isIsolatedQaPreviewBranch} from './qaPreviewBranch.mjs';

const branch=process.env.VERCEL_GIT_COMMIT_REF;
if(branch==='qa/chessaz-consolidated-20261121'&&(
 process.env.VERCEL_ENV!=='preview'||
 process.env.VITE_SERVER_URL!=='https://chessaz-m3-qa-api.onrender.com'||
 process.env.VITE_SUPABASE_URL!=='https://iukmpcytsuofqhxsumbu.supabase.co'||
 !process.env.VITE_SUPABASE_ANON_KEY
)){
 console.error('The consolidated ChessAZ build requires the dedicated Preview API and Supabase configuration.');
 process.exit(1);
}
if(isIsolatedQaPreviewBranch(branch)){
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
