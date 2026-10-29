import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createPositionSearchApi,positionSearchEnabled} from '../src/services/positions.ts';

test('global position API defaults off, uses Bearer header and AbortSignal, propagates warming Retry-After',async()=>{
 for(const value of [undefined,false,true,'1','false'])assert.equal(positionSearchEnabled(value),false);assert.equal(positionSearchEnabled('true'),true);
 const calls=[],signal=new AbortController().signal,api=createPositionSearchApi('https://qa.example',async(url,options)=>{calls.push({url:String(url),options});return Response.json({games:[],nextMoves:[],total:0});});
 await assert.rejects(api.search({fen:'fen',side:'black',fideId:''},'',signal),e=>e.code==='authentication_required');assert.equal(calls.length,0);
 await api.search({fen:'fen',side:'black',fideId:'123',scope:'nrw',sort:'strongest'},'private-test-token',signal);const call=calls[0];assert.equal(new URL(call.url).searchParams.get('scope'),'nrw');assert.equal(new URL(call.url).searchParams.get('sort'),'strongest');assert.equal(call.options.headers.Authorization,'Bearer private-test-token');assert.equal(call.options.signal,signal);assert.equal(call.options.cache,'no-store');assert.ok(!call.url.includes('private-test-token'));assert.equal(new URL(call.url).searchParams.get('fideId'),'123');
 const warming=createPositionSearchApi('https://qa.example',async()=>Response.json({code:'index_warming'},{status:503,headers:{'Retry-After':'5'}}));await assert.rejects(warming.search({fen:'fen',side:'any',fideId:''},'token',signal),e=>e.code==='index_warming'&&e.retryAfter===5);
});
test('PreparationBoard and global card use complete existing six-language copy maps',async()=>{
 const {default:ts}=await import('typescript'),copy={};
 for(const [file,name] of [['../src/i18n/sectionCopy.ts','sectionCopy'],['../src/i18n/regionalCopy.ts','regionalCopy']]){const source=readFileSync(new URL(file,import.meta.url),'utf8'),ast=ts.createSourceFile(file,source,99,true);const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(ast)===name)Object.assign(copy,Function('return ('+n.initializer.getText(ast)+')')());ts.forEachChild(n,visit);};visit(ast);}
 for(const file of ['../src/components/spieler/PreparationBoard.tsx','../src/components/spieler/GlobalPositionSearch.tsx']){
  const source=readFileSync(new URL(file,import.meta.url),'utf8'),ast=ts.createSourceFile(file,source,99,true,ts.ScriptKind.TSX),keys=new Set();
  const visit=n=>{if(ts.isStringLiteral(n)&&copy[n.text])keys.add(n.text);if(ts.isCallExpression(n)&&n.expression.getText(ast)==='tr')for(const arg of n.arguments)if(ts.isStringLiteral(arg))keys.add(arg.text);if(ts.isJsxText(n)&&/[äöüÄÖÜß]|\b(Züge|Stellung|Grundstellung|Umwandlung|Dame|Turm|Springer|Entfernen|Am Zug|Schwarz|leer)\b/.test(n.text))assert.fail('raw German JSX: '+n.text);ts.forEachChild(n,visit);};visit(ast);
  for(const key of keys)for(const locale of ['de','en','az','tr','ua','ru'])assert.ok(copy[key]?.[locale]?.trim(),key+': '+locale);
 }
});
test('global position real Chromium regression with synthetic data',{timeout:180000},async()=>{
 const linux=process.platform==='linux';
 const executable=linux?'dbus-run-session':process.execPath;
 const args=linux?['--',process.execPath,'tests/globalPositions.browser.mjs']:['tests/globalPositions.browser.mjs'];
 const {stdout}=await promisify(execFile)(executable,args,{cwd:process.cwd(),env:process.env,timeout:160000,maxBuffer:2*1024*1024});assert.match(stdout,/PASS global position browser/);
});
