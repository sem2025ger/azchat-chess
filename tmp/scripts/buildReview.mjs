// Owner-only visual snapshot. Reuse the real app; never inherit live bindings.
import {build,mergeConfig} from 'vite';
import config from '../vite.config.ts';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

export const reviewBindings={
 VITE_MAINTENANCE_MODE:'false',VITE_SENTRY_DSN:'',
 VITE_SERVER_URL:'https://chessaz-review.invalid',
 VITE_SUPABASE_URL:'https://chessaz-review.invalid',
 VITE_SUPABASE_ANON_KEY:'visual-review-no-credentials',
 ...Object.fromEntries(['AI_COACH','POSITION_SEARCH','SPIELER_V1','CLUBS_NRW','SPIELTAG','VORBEREITUNG'].map(k=>['VITE_'+k+'_ENABLED','true'])),
};
export const reviewCsp="default-src 'self'; connect-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src 'self' blob:; media-src 'self' blob:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";

export function reviewConfig(){return mergeConfig(config,{
 configFile:false,envDir:false,envPrefix:'CHESSAZ_VISUAL_REVIEW_UNUSED_',
 define:Object.fromEntries(Object.entries(reviewBindings).map(([k,v])=>['import.meta.env.'+k,JSON.stringify(v)])),
 plugins:[{name:'isolated-review-policy',transformIndexHtml(){return[
  {tag:'meta',attrs:{'http-equiv':'Content-Security-Policy',content:reviewCsp},injectTo:'head-prepend'},
  {tag:'meta',attrs:{name:'robots',content:'noindex,nofollow'},injectTo:'head-prepend'},
 ];}}],
 build:{outDir:'dist-review',emptyOutDir:true},
});}

const guide=`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="${reviewCsp}"><title>ChessAZ — тестовая версия интерфейса</title><style>body{margin:0;background:#1d1d1a;color:#ece8df;font:17px/1.6 system-ui,sans-serif}main{max-width:840px;margin:7vh auto;padding:24px}h1{font-size:clamp(28px,5vw,44px);line-height:1.2;color:#d9c5a4}p{color:#b9b8b2}nav{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:28px 0}a{display:block;padding:18px;border:1px solid #756449;border-radius:12px;background:#222528;color:#eee3cd;text-decoration:none}a:hover,a:focus-visible{outline:2px solid #d8c29d;background:#303438}small{display:block;color:#a9aaa5}strong{color:#eee5d4}</style><main><small>Снимок изменений · 30 октября 2026</small><h1>Обновлённый интерфейс ChessAZ</h1><p>Здесь собраны последние экраны, темы, доска, ассистент настроек и панель AI Coach.</p><p><strong>Это визуальная тестовая копия.</strong> Вход, реальные данные, сообщения и онлайн-партии не подключены. Настоящий Gemini пока недоступен. Шахматный анализ и настройки можно проверить без входа.</p><nav><a href="/home/">Главная и Chess Arena</a><a href="/chat/">Schach-Treff</a><a href="/region/nrw/">Панель NRW</a><a href="/spieler/">Игроки и AI Coach</a><a href="/settings/">Настройки и ассистент стиля</a><a href="/game/">Доска анализа и Stockfish</a><a href="/spieltag/">Командные встречи</a></nav><p><small>Базы и сервисы рабочего сайта не используются. Информация о версии: <a href="/snapshot.json">snapshot.json</a></small></p></main></html>`;

export async function buildReview(sourceSha){
 if(!/^[0-9a-f]{40}$/.test(sourceSha))throw Error('A full reviewed source SHA is required');
 execFileSync(process.execPath,['scripts/prepareStockfish19.mjs'],{stdio:'inherit'});
 await build(reviewConfig());
 const out=resolve('dist-review'),html=await readFile(join(out,'index.html'),'utf8');
 // Explicit route files keep the static host independent of server rewrite settings.
 for(const route of ['home','game','play','chat','settings','profile','spieler','spieltag','vorbereitung','clubs-nrw','region/nrw',...['vereine','turniere','ligen','vorbereitung','ueber'].map(s=>'region/nrw/'+s)]){
  await mkdir(join(out,route),{recursive:true});await writeFile(join(out,route,'index.html'),html);
 }
 await writeFile(join(out,'review.html'),guide);
 await writeFile(join(out,'snapshot.json'),JSON.stringify({sourceRepository:'sem2025ger/azchat-chess',sourceSha,mode:'visual-review-only',liveServices:false,geminiVerified:false},null,2)+'\n');
 console.log('PASS isolated visual review build: '+sourceSha);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildReview(process.argv[2]);
