import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,symlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {checkSectionLayouts} from './sectionsLayout.browser.mjs';

test('PreparationBoard renders the shared Home/Analysis board and outlined classic SVG pieces',()=>{
 const source=readFileSync(new URL('../src/components/spieler/PreparationBoard.tsx',import.meta.url),'utf8');
 assert.match(source,/import ChessBoard from '\.\.\/ChessBoard'/);
 assert.match(source,/<ChessBoard game=\{board\} readOnly overrideBoardTheme="Classic Wood" overridePieceTheme="cburnett-classic"/);
 assert.doesNotMatch(source,/preparation-mini-board|♔|♙/);
});
test('four section headings, one native page scroll owner, and Home fits the desktop viewport',{timeout:180000},async()=>{
 const captureRoot=process.env.SECTIONS_CAPTURE;
 if(captureRoot){
  const parent=await mkdtemp(join(tmpdir(),'chessaz-before-')),baseline=join(parent,'baseline');
  try{
   execFileSync('git',['worktree','add','--detach',baseline,'0944e6718f17032b6b8b47a4eab92d8d0e052a59'],{stdio:'pipe'});
   await symlink(resolve('node_modules'),join(baseline,'tmp','node_modules'),'dir');
   await checkSectionLayouts({root:join(baseline,'tmp'),captureRoot,phase:'before',verify:false});
  }finally{execFileSync('git',['worktree','remove','--force',baseline],{stdio:'pipe'});}
 }
 await checkSectionLayouts({captureRoot});
});
