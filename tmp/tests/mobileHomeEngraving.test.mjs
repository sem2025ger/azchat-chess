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
  assert.ok((await readFile(join(baseline,'tmp','public','brand','sidebar-king.svg'))).equals(await readFile(resolve('public/brand/sidebar-king.svg'))),'King artwork bytes changed');
  // Desktop screenshots are checked pixel-by-pixel by checkSectionLayouts, outside the two approved wordmark bounds.
  const before=await checkSectionLayouts({root:join(baseline,'tmp'),captureRoot,phase:'before',verify:false,homePolishOnly:true});
  const after=await checkSectionLayouts({captureRoot,homePolishOnly:true});
  for(const metric of after){
   const previous=before.find(m=>m.width===metric.width&&m.height===metric.height);
   assert.ok(previous);assert.ok(metric.boardWidth+0.01>=previous.boardWidth,'Board shrank '+JSON.stringify({previous,metric}));
   // Approved mobile lift 27.11.2026: on heights >=701px the brand block moves up 8px and the board 16px.
   const lift=metric.height>=701?{boardTop:-16,wordTop:-8,kingTop:-8,ornamentTop:-8}:{};
   assert.equal(metric.font,previous.font,'font changed');
   for(const key of ['kingWidth','kingHeight'])assert.ok(Math.abs(metric[key]-previous[key])<=0.01,key+' changed '+JSON.stringify({previous,metric}));
   // Approved one-line play label 27.11.2026: the vertically centred stack may move as a whole by at most 3px.
   const centring=metric.wordTop-(previous.wordTop+(lift.wordTop??0));
   assert.ok(Math.abs(centring)<=3,'centring shift '+JSON.stringify({previous,metric}));
   for(const key of ['boardTop','wordTop','kingTop'])assert.ok(Math.abs(metric[key]-(previous[key]+(lift[key]??0)+centring))<=0.01,key+' changed '+JSON.stringify({previous,metric}));
   if(metric.width===390&&metric.height===844){const shift=metric.ornamentTop-(lift.ornamentTop??0)-centring-previous.ornamentTop;assert.ok(shift>=8&&shift<=12,JSON.stringify({previous,metric}));}
  }
  for(const size of ['768x1024']){
   const a=await readFile(join(captureRoot,'before-home-'+size+'.png')),b=await readFile(join(captureRoot,'after-home-'+size+'.png'));
   assert.ok(a.equals(b),'Home '+size+' differs from baseline');
  }
  console.log('MOBILE_HOME_ENGRAVING_QA '+JSON.stringify({before,after}));
 }finally{
  if(added)execFileSync('git',['worktree','remove','--force',baseline],{stdio:'pipe'});
  await rm(temp,{recursive:true,force:true});
 }
});
