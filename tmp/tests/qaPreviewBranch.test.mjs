import test from 'node:test';
import assert from 'node:assert/strict';
import {isIsolatedQaPreviewBranch} from '../scripts/qaPreviewBranch.mjs';

test('isolated Spieler preview enables only the two reviewed QA branches',()=>{
 assert.equal(isIsolatedQaPreviewBranch('qa/spieler-coach-compact-controls-20261030'),true);
 assert.equal(isIsolatedQaPreviewBranch('qa/spieler-final-polish-20261031'),true);
 for(const branch of ['main','production','backup/chessaz-approved-qa-2026-10-31','feat/ai-coach-openai-voice-qa-20261030','qa/spieler-final-polish-20261031-copy','',undefined]){
  assert.equal(isIsolatedQaPreviewBranch(branch),false,String(branch));
 }
});
