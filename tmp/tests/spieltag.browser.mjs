// Real Chromium with synthetic auth/data only. Exercises production Spieltag
// components, request payloads, captain/member UI and identity-change cleanup.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createServer} from 'vite';import react from '@vitejs/plugin-react';
const fixture=String.raw`
import '/src/index.css';import {ThemeProvider} from '/src/context/ThemeContext.tsx';import React from 'react';import{createRoot}from'react-dom/client';import {LanguageProvider,useLanguage} from '/src/context/LanguageContext.tsx';localStorage.setItem('app-language','de');import Screen from '/src/screens/SpieltagScreen.tsx';import{MemoryRouter,Routes,Route,useNavigate}from'react-router-dom';import Preparation from '/src/screens/VorbereitungScreen.tsx';import{loadAnalysisSession}from'/src/utils/analysisSession.ts';

window.fixtureSession={access_token:'captain-test-only'};window.fixtureCalls=[];
const team='11111111-1111-4111-8111-111111111111',match='22222222-2222-4222-8222-222222222222';
let matches=[],boards=[];const native=window.fetch;
window.fetch=async(url,options={})=>{
 if(!String(url).startsWith('https://spieltag-fixture.invalid/'))return native(url,options);
 const path=new URL(url).pathname;window.fixtureCalls.push({path,method:options.method,body:options.body});
 const token=opti¶»§q«^