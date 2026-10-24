'use strict';
const {createGamesStore}=require('../db');
const {targetGuard,latestIssue,importIssue,QA_REF}=require('./importer');
function startTwicSchedule({env=process.env,store,latest=latestIssue,run=importIssue,onError=()=>console.error('TWIC_SCHEDULE_CHECK_FAILED'),intervalMs=86400000}={}){
 if(env.TWIC_IMPORT_ENABLED!=='true')return()=>{};
 try{targetGuard(env.SUPABASE_URL,QA_REF);store=store||createGamesStore(env);}catch{onError();return()=>{};}
 let running=false,stopped=false;
 const check=async()=>{if(running||stopped)return;running=true;try{await run({issue:await latest(),store,maxMb:Number(env.TWIC_MAX_DB_MB||300)});}catch{onError();}finally{running=false;}};
 const timer=setInterval(()=>void check(),intervalMs);timer.unref?.();void check();
 return()=>{stopped=true;clearInterval(timer);};
}
module.exports={startTwicSchedule};
