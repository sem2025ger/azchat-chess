import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpielerApi, spielerEnabled, openSpielerAnalysis } from '../src/services/spieler.ts';
import { loadAnalysisSession, saveAnalysisSession } from '../src/utils/analysisSession.ts';
test('Spieler flag defaults off and only literal true enables it',()=>{for(const value of [undefined,false,true,'false','1','TRUE'])assert.equal(spielerEnabled(value),false);assert.equal(spielerEnabled('true'),true);});
test('API safely encodes surname/nickname and never accepts caller-controlled identity',async()=>{
 const calls=[];const api=createSpielerApi('https://qa.example',async(url,options)=>{calls.push({url:String(url),options});return new Response(JSON.stringify(options.method==='POST'?{status:'pending'}:{players:[]}));});
 const signal=new AbortController().signal;await api.search('Huseynov & other',signal);assert.equal(new URL(calls[0].url).searchParams.get('q'),'Huseynov & other');
 await api.action('13404431','claim','test-only',signal);assert.equal(calls[1].options.body,'{}');assert.equal(new URL(calls[1].url).search,'');
 await assert.rejects(api.action('../other','hide','test-only',signal));assert.equal(calls.length,2);
});
test('In Analyse öffnen validates PGN and retains full move history; invalid PGN preserves previous analysis',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 saveAnalysisSession(['d4','d5'],-1,storage);assert.throws(()=>openSpielerAnalysis('invalid',storage));assert.deepEqual(loadAnalysisSession(storage).moveHistory,['d4','d5']);
 assert.equal(openSpielerAnalysis('[Event "Test"]\n\n1. e4 e5 2. Nf3 Nc6 *',storage),'/game');assert.deepEqual(loadAnalysisSession(storage).moveHistory,['e4','e5','Nf3','Nc6']);
});
