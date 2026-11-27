import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,symlink,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {checkSectionLayouts} from './sectionsLayout.browser.mjs';

test('mobile Home engraved ornament, reduced motion and unchanged board/desktop',{timeout:180000},async()=>{
 const temp=await mkdtemp(join(tmpdir(),'chessaz-home-engraving-')),baseline=join(temp,'baseline');
 const captureRoot=join(process.env.SECTIONS_CAPTURE||temp,'mobile-home-engraving');
 await mkdir(captureRoot,{recursive:true});
 let added=false;
 try{
  execFileSync('git',['worktree','add','--detach',baseline,'d173bd8da6c81d5457b71baf39cd96acaef9a9d5'],{stdio:'pipe'});added=true;
  await symlink(resolve('node_modules'),join(baseline,'tmp','node_modules'),'dir');
  const before=await checkSectionLayouts({root:join(baseline,'tmp'),captureRoot,phase:'before',verify:false,homePolishOnly:true});
  const after=await checkSectionLayouts({captureRoot,homePolishOnly:true});
  for(const metric of after){
   const previous=before.find(m=>m.width===metric.width&&m.height===metric.height);
   assert.ok(previous);assert.ok(metric.boardWidth+0.01>=previous.boardWidth,'Board shrank '+JSON.stringify({previous,metric}));
   for(const key of ['font','kingWidth','kingHeight','boardTop','wordTop','kingTop'])assert.equal(metric[key],previous[key],key+' changed');
   if(metric.width===390&&metric.height===844)assert.ok(metric.ornamentTop-previous.ornamentTop>=8&&metric.ornamentTop-previous.ornamentTop<=12,JSON.stringify({previous,metric}));
  }
  for(const size of ['768x1024','1440x900']){
   const a=await readFile(join(captureRoot,'before-home-'+size+'.png')),b=await readFile(join(captureRoot,'after-home-'+size+(size==='1440x900'?'-legacy-wordmark':'')+'.png'));
   assert.ok(a.equals(b),'Home '+size+' differs from baseline');
  }
  console.log('MOBILE_HOME_ENGRAVING_QA '+JSON.stringify({before,after}));
 }finally{
  if(added)execFileSync('git',['worktree','remove','--force',baseline],{stdio:'pipe'});
  await rm(temp,{recursive:true,force:true});
 }
});
