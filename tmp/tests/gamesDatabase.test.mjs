import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const compiled=ts.transpileModule(read('../src/translations.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const mod={exports:{}};new Function('module','exports','require',compiled)(mod,mod.exports,require);
const translations=mod.exports.translations;
test('every Games Database key exists in all six locales',()=>{
 const keys=Object.keys(translations).filter(k=>k.startsWith('games.'));assert.ok(keys.length>=25);
 for(const key of keys) for(const lang of ['en','de','az','tr','ua','ru']) assert.ok(translations[key][lang]?.trim(),`${key}:${lang}`);
 const panel=read('../src/components/analysis/GamesLibraryPanel.tsx');
 for(const [,key] of panel.matchAll(/t\('([^']+)'\)/g)) if(key.startsWith('games.'))assert.ok(translations[key],key);
});
test('source panel reuses PGN parser and existing review load callback',()=>{
 const panel=read('../src/components/analysis/GamesLibraryPanel.tsx');const screen=read('../src/screens/GameScreen.tsx');
 assert.match(panel,/analysisFromPgn\(result.pgn\)/);assert.match(panel,/onLoad\(analysis,/);
 assert.match(screen,/<GamesLibraryPanel[^>]*onLoad={loadWorkspaceAnalysis}/);
 assert.match(panel,/controller\.abort\(\)/);assert.match(panel,/, 400\)/);
 assert.match(panel,/games\.attributionMasters/);assert.match(panel,/role="alert"/);assert.match(panel,/games\.emptyPosition/);
});
test('desktop and mobile expose Games and preserve saved games',()=>{
 const panel=read('../src/components/analysis/GamesLibraryPanel.tsx');const mobile=read('../src/components/analysis/MobileAnalysis.tsx');
 assert.match(panel,/<SavedGamesPanel/);assert.match(mobile,/games\.tabShort/);assert.match(mobile,/onGames/);
});
