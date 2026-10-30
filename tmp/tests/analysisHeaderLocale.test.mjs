import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

test('analysis header has an existing localized accessible name in all six languages', async()=>{
 const storage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 let language='de';
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>language}});
 const server=await createServer({envDir:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
 try{
  const {LanguageProvider}=await server.ssrLoadModule('/src/context/LanguageContext.tsx');
  const {default:Header}=await server.ssrLoadModule('/src/components/analysis/AnalysisWorkspaceHeader.tsx');
  const {analysisCopy}=await server.ssrLoadModule('/src/components/analysis/copy.ts');
  const noop=()=>{};
  for(language of ['de','en','az','tr','ua','ru']){
   const html=renderToStaticMarkup(createElement(LanguageProvider,null,createElement(Header,{
    title:'',initialFen:'',moveHistory:[],currentFen:'',onNew:noop,onEdit:noop,editing:false,evaluations:{},
   })));
   assert.ok(html.includes('aria-label="'+analysisCopy[language].analysis+'"'),language+': translated analysis region name');
   assert.ok(!html.includes('aria-label="game.'),language+': no unresolved translation key');
  }
 }finally{
  await server.close();
  if(storage)Object.defineProperty(globalThis,'localStorage',storage);else delete globalThis.localStorage;
 }
});
