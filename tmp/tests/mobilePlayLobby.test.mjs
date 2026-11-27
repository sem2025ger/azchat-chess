import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,symlink,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {checkSectionLayouts} from './sectionsLayout.browser.mjs';

test('mobile Play composition, overlays, board width and unchanged tablet/desktop pixels',{timeout:180000},async()=>{
 const temp=await mkdtemp(join(tmpdir(),'chessaz-mobile-play-')),baseline=join(temp,'baseline');
 const captureRoot=join(process.env.SECTIONS_CAPTURE||temp,'mobile-play');
 await mkdir(captureRoot,{recursive:true});
 let added=false;
 try{
  execFileSync('git',['worktree','add','--detach',baseline,'2dab8d1c917270523e895bb4dbc2f92ca303c6a3'],{stdio:'pipe'});added=true;
  await symlink(resolve('node_modules'),join(baseline,'tmp','node_modules'),'dir');
  const before=await checkSectionLayouts({root:join(baseline,'tmp'),captureRoot,phase:'before',verify:false,playOnly:true});
  const after=await checkSectionLayouts({captureRoot,playOnly:true});
  for(const metric of after){
   const previous=before.find(m=>m.width===metric.width&&m.height===metric.height);
   assert.ok(previous,'Missing baseline measurement');
   assert.ok(metric.boardWidth+0.01>=previous.boardWidth,'Board shrank '+JSON.stringify({previous,metric}));
  }
  for(const size of ['768x1024','1023x900','1440x900'])for(const page of ['home','play-idle']){
   const a=await readFile(join(captureRoot,'before-'+page+'-'+size+'.png'));
   const b=await readFile(join(captureRoot,'after-'+page+'-'+size+(size==='1440x900'?'-legacy-wordmark':'')+'.png'));
   assert.ok(a.equals(b),page+' '+size+' screenshot differs from baseline');
  }
  console.log('MOBILE_PLAY_QA '+JSON.stringify({before,after}));
 }finally{
  if(added)execFileSync('git',['worktree','remove','--force',baseline],{stdio:'pipe'});
  await rm(temp,{recursive:true,force:true});
 }
});
