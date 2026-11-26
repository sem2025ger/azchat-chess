import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const app=readFileSync('src/App.tsx','utf8'),layout=readFileSync('src/components/Layout.tsx','utf8'),ui=readFileSync('src/screens/ClubsNRWScreen.tsx','utf8');
test('NRW routes and navigation default off',()=>{assert.match(app,/VITE_CLUBS_NRW_ENABLED === 'true'/);assert.match(layout,/VITE_CLUBS_NRW_ENABLED === 'true'/);});
test('duel cannot start game and roster is private by default',()=>{assert.match(ui,/Spielstart deaktiviert/);assert.doesNotMatch(ui,/make_move|join_queue|start_game|game_start/);assert.match(ui,/public_roster:false/);});

import {execFileSync} from 'node:child_process';
import {nrwAuthReturnTarget} from '../src/lib/nrwAuthReturn.ts';

test('all NRW flags off preserves the main routing and navigation entry points',()=>{
 const baseline='3a44fde7f6218827e382d07381f337f76d065e6a';
 const layoutPath='src/components/Layout.tsx';
 // The shared language chooser is part of Layout at every flag setting.
 const layoutBaseline='cbe769783a6c7883e3bab9a76adcbc90bd562624';
 const spieltagGate="import.meta.env.VITE_SPIELTAG_ENABLED === 'true'";
 const tournamentGate="("+spieltagGate+" || import.meta.env.VITE_TEAM_TOURNAMENTS_ENABLED === 'true')";
 for(const path of ['src/App.tsx',layoutPath,'src/routeLoaders.ts','scripts/buildQaPreview.mjs']){
  let current=readFileSync(path,'utf8');
  if(path===layoutPath){
   const sharedGate = "  const showSpieltag = " + spieltagGate + " ||\n    import.meta.env.VITE_TEAM_TOURNAMENTS_ENABLED === 'true';\n";
   const mobileLink = '        {showSpieltag && <MobileNavItem to="/spieltag" icon={<CalendarDays size={20} />}\n' +
     "          label={t('nav.spieltag')} accent=\"settings\" />}\n";
   assert.ok(current.includes(sharedGate) && current.includes(mobileLink));
   assert.doesNotMatch(current, /<MobileNavItem to="\/region\/nrw"/);
   const settingsWhenOff = "        {!showSpieltag && <MobileNavItem to=\"/settings\" icon={<Settings size={20} />} label={t('nav.settings')} accent=\"settings\" />}";
   const previousSettings = "        <MobileNavItem to=\"/settings\" icon={<Settings size={20} />} label={t('nav.settings')} accent=\"settings\" />";
   assert.equal(current.split(settingsWhenOff).length,2,'mobile Settings appears only when Spieltag is off');
   current = current.replace(settingsWhenOff,previousSettings).replace(sharedGate, '').replace(mobileLink, '')
     .replace('MapPin, CalendarDays', 'MapPin')
     .replace(' data-spieltag-enabled={showSpieltag || undefined}', '')
     .replace('desktop && showSpieltag', 'desktop && ' + tournamentGate);
  }
  if(path==='src/App.tsx'){
   const bannerImport = "import { TournamentOnlineBanner } from './components/teamTournaments/TournamentOnlineViews';\n";
   const flagGatedBanner = "                {import.meta.env.VITE_TEAM_TOURNAMENTS_ONLINE_PLAY === 'true' && <TournamentOnlineBanner />}\n";
   assert.ok(current.includes(bannerImport) && current.includes(flagGatedBanner));
   current=current.replace(bannerImport,'').replace(flagGatedBanner,'');
  }
  if(path==='src/App.tsx'||path===layoutPath){
   // With tournaments off, only the original Spieltag gate controls this entry.
   assert.ok(current.includes(tournamentGate),path);
   current=current.replace(tournamentGate,spieltagGate);
  }
  if(path===layoutPath){
   // Normalize only the explicitly approved mobile chat icon and decorative dot removal.
   for(const [next,previous] of [["function MobileSchachTreffIcon() {\n  return (\n    <svg data-mobile-schach-treff-icon width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\">\n      <path d=\"M7 3.5h10a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4h-6l-5 3v-3.1a4 4 0 0 1-3-3.9v-7a4 4 0 0 1 4-4Z\" stroke=\"currentColor\" strokeWidth=\"1.6\" strokeLinejoin=\"round\" />\n      <path d=\"M8 16v-1.6c0-1.6 1.5-2.7 3.2-4l-2 .4-1.3-.9 2.3-3.1.3-1.6 1.6 1.1c3.1-.1 4.8 2.1 4.8 5.3v4.4H8Z\" fill=\"currentColor\" />\n    </svg>\n  );\n}\n\n", ''],['<MobileSchachTreffIcon />','<MessageSquare size={20} />'],["{to !== '/chat' && <Circle size={4} className=\"absolute -top-1 -right-1 opacity-0 group-[.active]:opacity-100 text-current fill-current\" />}","<Circle size={4} className=\"absolute -top-1 -right-1 opacity-0 group-[.active]:opacity-100 text-current fill-current\" />"]]){
    assert.equal(current.split(next).length,2,'approved mobile chat fragment occurs exactly once');
    current=current.replace(next,previous);
   }
   // Owner-approved desktop-only chat ornament; normalize only this exact row.
   const approvedChatRow = "            <NavItem to=\"/chat\" icon={<MessageSquare size={20} className=\"schach-treff-chat-icon\"><defs><linearGradient id=\"sidebar-chat-dot-gradient\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\"><stop offset=\"0%\" stopColor=\"#3153A3\" /><stop offset=\"48%\" stopColor=\"#AD85ED\" /><stop offset=\"78%\" stopColor=\"#E9C36D\" /><stop offset=\"100%\" stopColor=\"#C49242\" /></linearGradient></defs><circle className=\"schach-treff-chat-dot\" cx=\"12\" cy=\"10.5\" r=\"3\" aria-hidden=\"true\" /></MessageSquare>} label=\"Schach-Treff\" themeColor=\"theme-violet\" bronzeLabel />";
   const originalChatRow = "            <NavItem to=\"/chat\" icon={<MessageSquare size={20} />} label=\"Schach-Treff\" themeColor=\"theme-violet\" bronzeLabel />";
   assert.equal(current.split(approvedChatRow).length,2,'approved Schach-Treff icon occurs exactly once');
   current=current.replace(approvedChatRow,originalChatRow);
   const approvedChatClass = "          to === '/chat' && \"site-nav-link--schach-treff\",\n";
   assert.equal(current.split(approvedChatClass).length,2,'approved chat-only CSS hook occurs exactly once');
   current=current.replace(approvedChatClass,'');
   // Owner-approved flag sizes and capsule spacing only; keep all routing comparisons exact.
   for(const [next,previous,count] of [["gap-[9px] w-fit xl:ml-[12px] min-h-[58px] xl:-translate-x-[2px] xl:origin-center xl:scale-[0.96] px-[9px] py-[6px]","gap-[9px] w-fit xl:ml-[4px] min-h-[58px] xl:-translate-x-[2px] xl:origin-center xl:scale-[0.96] px-[10px] py-[7px]",1],["width=\"39\"\n      height=\"26\"","width=\"46\"\n      height=\"31\"",2],["w-[39px] h-[26px]","w-[46px] h-[31px]",2]]){
    assert.equal(current.split(next).length,count+1,'approved flag styling occurrence count');
    current=current.split(next).join(previous);
   }
   // Owner-approved desktop king dimensions only; preserve the exact remaining baseline.
   for (const [next, previous] of [["h-[56px] w-[28px] shrink-0 -translate-x-[2px] -translate-y-[6px]","h-[62px] w-[31px] shrink-0 -translate-x-[2px] -translate-y-[6px]"],["src=\"/brand/sidebar-king.svg\" alt=\"\" width=\"28\" height=\"56\"","src=\"/brand/sidebar-king.svg\" alt=\"\" width=\"31\" height=\"62\""]]) {
    assert.equal(current.split(next).length,2,'approved king sizing occurs exactly once');
    current=current.replace(next,previous);
   }
   // Allow only the separately reviewed 240px desktop sidebar geometry change (PR #219).
   // All route entries and feature-flagged links must remain byte-for-byte identical.
   for(const [next, previous] of [
    ['w-20 xl:w-[240px]', 'w-20 xl:w-[260px]'],
    ['xl:justify-start px-2 xl:px-4 border-b', 'xl:justify-start px-2 xl:px-6 border-b'],
    ['<nav className="px-3 xl:px-4 pt-10', '<nav className="px-3 xl:px-5 pt-10'],
    ['<div className="p-2 xl:p-4 space-y-3 border-t', '<div className="p-2 xl:p-5 space-y-3 border-t'],
    ['site-nav-copy ml-3 hidden xl:flex', 'site-nav-copy ml-4 hidden xl:flex'],
   ]) {
    assert.ok(current.includes(next), 'Expected the approved desktop sidebar change: ' + next);
    current=current.replace(next,previous);
   }
  }
  if(path==='scripts/buildQaPreview.mjs'){
   // Permit only the QA-only Auth preflight. Its separate tests assert that
   // production/local builds skip it and rejected credentials fail closed.
   const authImport = "import {verifyTournamentQaAuth} from './verifyTournamentQaAuth.mjs';\n";
   const authPreflight = [
    'try {',
    " if(await verifyTournamentQaAuth(process.env)) console.log('QA Preview: Supabase Auth public key verified.');",
    '}catch(error){',
    ' console.error(error.message);',
    ' process.exit(1);',
    '}',
   ].join('\n')+'\n';
   for(const fragment of [authImport,authPreflight]){
    assert.equal(current.split(fragment).length,2,'QA Auth preflight fragment must appear exactly once');
    current=current.replace(fragment,'');
   }
  }
  const expected=execFileSync('git',['show',(path===layoutPath?layoutBaseline:baseline)+':tmp/'+path],{encoding:'utf8'});
  assert.equal(current,path===layoutPath?expected.replace(tournamentGate,spieltagGate):expected,path);
 }
 const home='src/screens/HomeScreen.tsx';
 const homeBaseline=execFileSync('git',['show',baseline+':tmp/'+home],{encoding:'utf8'})
  .replace(/ {12}background:\n {14}radial-gradient\(ellipse at 5% 0%,[^;]+;\n/,'')
  .replace(/ {12}\/\* Fine, translucent mineral grain[\s\S]+?;\n/,'')
  .replace('md:gap-4 bg-[#121212]/98 p-3','md:gap-4 p-3');
 const flagGatedLink=/ {10}\{import\.meta\.env\.VITE_CLUBS_NRW_ENABLED === 'true' && \(\n {12}<Link to="\/region\/nrw"[^>]+md:hidden">\n {14}NRW – Schach\n {12}<\/Link>\n {10}\)\}\n\n/;
 assert.match(readFileSync(home,'utf8'),flagGatedLink);
 // A disabled M3 must leave the approved Home byte-for-byte unchanged.
 const m3Import="import MyTournamentCard from '../components/teamTournaments/MyTournamentCard';"+String.fromCharCode(10);
 const m3Start='          {/* M3 HOME CARD START */}';
 const m3End='          {/* M3 HOME CARD END */}'+String.fromCharCode(10,10);
 const currentHome=readFileSync(home,'utf8');
 const start=currentHome.indexOf(m3Start);
 const finish=currentHome.indexOf(m3End,start);
 assert.ok(start>=0 && finish>start,'M3 block must be bounded');
 assert.match(currentHome,/VITE_TEAM_TOURNAMENTS_ENABLED === 'true'/);
 assert.match(currentHome,/VITE_TEAM_TOURNAMENTS_M3_ENABLED === 'true'/);
 const disabledHome=currentHome.replace(m3Import,'');
 const disabledStart=disabledHome.indexOf(m3Start);
 const disabledFinish=disabledHome.indexOf(m3End,disabledStart);
 const withoutM3=disabledHome.slice(0,disabledStart)+disabledHome.slice(disabledFinish+m3End.length);
 // Owner-approved mobile brand replacement; normalize only the exact heading.
 const approvedMobileBrand = "            <h1 className=\"chess-arena-reference-title md:hidden\" aria-label=\"Chessaz.de\">\n              <span className=\"mobile-home-wordmark whitespace-nowrap\">\n                <span className=\"mobile-home-brand-name\">Chessaz</span><span className=\"mobile-home-brand-domain\">.de</span>\n              </span>\n              <span className=\"mobile-home-king relative shrink-0\" aria-hidden=\"true\">\n                <img src=\"/brand/sidebar-king.svg\" alt=\"\" width=\"36\" height=\"72\" className=\"absolute inset-0 h-full w-full object-fill\" />\n                <span className=\"sidebar-king-sheen pointer-events-none absolute inset-0\" />\n              </span>\n            </h1>";
 const originalMobileHeading = "            <h1 className=\"chess-arena-reference-title md:hidden text-[2.2rem] text-center leading-[0.95] tracking-[-0.03em]\">\n              Chess Arena\n            </h1>";
 assert.equal(withoutM3.split(approvedMobileBrand).length,2,'approved mobile brand appears exactly once');
 let homeSource=withoutM3.replace(approvedMobileBrand,originalMobileHeading);
 const mobileFontImport="import '@fontsource/bodoni-moda/700.css';\n";
 assert.equal(homeSource.split(mobileFontImport).length,2,'approved mobile font import appears exactly once');
 homeSource=homeSource.replace(mobileFontImport,'');
 // Reverse only the approved mobile plaque removal, spacing and board-width change.
 for(const [next,previous] of [
  [
    "",
    "        /* Chess Arena: mobile-only, understated obsidian-gold architectural frame.\n           Keep the approved golden wordmark and the exact board dimensions. */\n        @media (max-width: 767px) {\n          .home-screen-root [data-mobile-home-stack] {\n            padding-top: 12px;\n          }\n          .home-screen-root .mobile-home-arena {\n            border: 1px solid rgba(221, 184, 110, .5);\n            border-bottom: 1px solid rgba(221, 184, 110, .3);\n            border-radius: 24px;\n            box-shadow: 0 15px 28px -18px rgba(0,0,0,.85),\n              0 0 0 1px rgba(176, 142, 85, .11),\n              inset 0 1px 0 rgba(255, 234, 182, .17),\n              inset 0 -1px 0 rgba(255, 220, 155, .04);\n          }\n          .home-screen-root .mobile-home-arena::before {\n            inset: 5px; border-radius: 19px; opacity: 1; animation: none;\n            border: 1px solid rgba(207, 171, 105, .23);\n            box-shadow: inset 0 0 14px rgba(203, 168, 103, .035);\n          }\n          .home-screen-root .mobile-home-arena::after {\n            inset: -1px; border-radius: 25px; opacity: 1; animation: none;\n            border: 1px solid transparent;\n            background:\n              linear-gradient(90deg, transparent, rgba(247,213,151,.76), transparent) top 11px center / 38% 1px no-repeat,\n              linear-gradient(90deg, transparent, rgba(166,140,212,.34), transparent) bottom 10px center / 30% 1px no-repeat;\n            box-shadow: none;\n          }\n        }\n"
  ],
  [
    "max-width: calc(100vw - 4px) !important;",
    "max-width: calc(100vw - 8px) !important;"
  ]
]){
  if (next) {
   assert.equal(homeSource.split(next).length,2,'approved mobile Home fragment appears exactly once');
   homeSource=homeSource.replace(next,previous);
  } else {
   const anchor='        /* Home-only black CBURNETT artwork';
   assert.equal(homeSource.split(anchor).length,2,'approved mobile style insertion anchor');
   homeSource=homeSource.replace(anchor,previous+anchor);
  }
 }
 // Reverse only the explicitly approved, default-off Home feature additions.
 // Any other change to routing, flags, layout or the play button still fails.
 const unifiedCardChanges=[
  ["      {homeUnifiedCard && (\n        <style>{`\n          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,700&display=swap');\n\n          @media (min-width: 1280px) {\n            .home-screen-root .home-unified-card .home-unified-slogan {\n              display: flex;\n              align-items: center;\n              justify-content: center;\n              gap: 9px;\n              font-family: 'Cormorant Garamond', Georgia, serif;\n              font-size: clamp(28px, 2.53vw, 36px);\n              font-weight: 700;\n              font-style: italic;\n              line-height: 1.15;\n              letter-spacing: 0.02em;\n              overflow: visible;\n              text-overflow: clip;\n              text-shadow: none;\n              margin-bottom: 6px;\n            }\n            .home-screen-root .home-unified-card .home-unified-slogan-part {\n              display: inline-flex;\n              align-items: center;\n              gap: 9px;\n              flex: none;\n            }\n            .home-screen-root .home-unified-card .home-unified-slogan-word {\n              background: linear-gradient(180deg, #f4f6f8 0%, #cfd5db 50%, #9aa3ac 100%);\n              background-clip: text;\n              -webkit-background-clip: text;\n              -webkit-text-fill-color: transparent;\n              color: transparent;\n              text-shadow: none;\n              filter: drop-shadow(0 0 5px rgba(220,228,235,0.18));\n            }\n            .home-screen-root .home-unified-card .home-unified-slogan-diamond {\n              display: inline-block;\n              width: 6px;\n              height: 6px;\n              flex: 0 0 6px;\n              transform: rotate(45deg);\n              background: linear-gradient(135deg, #e9d1a1, rgb(var(--chessaz-bronze-frame)));\n            }\n          }\n        `}</style>\n      )}\n",""],
  ["  const homeUnifiedCard = import.meta.env.VITE_HOME_UNIFIED_CARD === 'true';\n",""],
  ["          .home-screen-root .desktop-home-arena.home-unified-card {\n            background:\n              radial-gradient(120% 70% at 30% 0%, rgba(205,215,230,0.07) 0%, rgba(205,215,230,0) 55%),\n              linear-gradient(150deg, #24272c 0%, #1d2023 32%, #16241f 68%, #0b1a15 100%);\n          }\n",""],
  ["className={`desktop-home-slogan","className=\"desktop-home-slogan"],
  ["${homeUnifiedCard ? \" xl:hidden\" : \"\"}`}","\""],
  ["className={`mobile-home-arena desktop-home-arena","className=\"mobile-home-arena desktop-home-arena"],
  ["${homeUnifiedCard ? \" home-unified-card\" : \"\"}`}","\""],
  ["          {homeUnifiedCard && (\n            <span className=\"desktop-home-slogan-text home-unified-slogan hidden\">\n              {t('home.slogan').split(/\\s*[•·]\\s*/u).map((part, index) => (\n                <span key={part + index} className=\"home-unified-slogan-part\">\n                  {index > 0 && <span className=\"home-unified-slogan-diamond\" aria-hidden=\"true\" />}\n                  <span className=\"home-unified-slogan-word\">{part}</span>\n                </span>\n              ))}\n            </span>\n          )}\n\n",""],
 ];
 // Owner-approved desktop wordmark tracking (PR #257); preserve the exact baseline elsewhere.
 const approvedHomePieceChanges = [
  ["            letter-spacing: 0.015em;\n            -webkit-text-stroke: 0.35px", "            letter-spacing: -0.045em;\n            -webkit-text-stroke: 0.35px"],
  ["  const homeChessComPieces = import.meta.env.VITE_HOME_CHESSCOM_PIECES === 'true';\n", ""],
  ["        /* Desktop Home only: restrained Chess.com-like white and graphite pieces. */\n        @media (min-width: 1280px) {\n          .home-screen-root .home-board img[data-home-chesscom-piece=\"w\"] {\n            filter: contrast(.8) brightness(1.08) !important;\n          }\n          .home-screen-root .home-board img[data-home-chesscom-piece=\"b\"][alt=\"bP\"] {\n            filter: grayscale(1) contrast(.42) brightness(.61) brightness(1.10) !important;\n          }\n", ""],
  ["          /* Match non-pawn black figures to the existing satin graphite pawns.\n             Preserve the original piece paths and highlights; never affect CBURNETT. */\n          .home-screen-root .home-board img[data-home-graphite-set=\"classic\"] {\n            filter: grayscale(1) contrast(.83) brightness(.90) drop-shadow(0 -1px 1px rgba(250,250,245,.12)) drop-shadow(0 2px 3px rgba(0,0,0,.34)) !important;\n          }\n          .home-screen-root .home-board img[data-home-graphite-set=\"neo\"],\n          .home-screen-root .home-board img[data-home-graphite-set=\"tournament\"] {\n            filter: grayscale(1) contrast(1.02) brightness(.90) drop-shadow(0 -1px 1px rgba(250,250,245,.12)) drop-shadow(0 2px 3px rgba(0,0,0,.34)) !important;\n          }\n        }\n", ""],
  ["homeBlackInk homeChessComPalette={homeChessComPieces} className", "homeBlackInk className"],
  // PR #197 approved square board and frame containment; preserve exact prior layout below.
  ["          <div className=\"relative w-full aspect-square rounded-[1rem] md:rounded-[2rem] xl:p-3 overflow-hidden shadow-[0_18px_42px_-18px_rgba(0,0,0,0.9)] ring-2 ring-white/10 xl:ring-0 group transform-gpu transition-transform duration-1000 board-perspective home-board home-board-frame max-md:hidden\">\n", "          <div className=\"relative w-full aspect-square rounded-[1rem] md:rounded-[2rem] overflow-hidden shadow-[0_18px_42px_-18px_rgba(0,0,0,0.9)] ring-2 ring-white/10 group transform-gpu transition-transform duration-1000 xl:rotate-y-[12deg] xl:rotate-x-[8deg] hover:rotate-y-0 hover:rotate-x-0 board-perspective home-board home-board-frame max-md:hidden\">\n"],
  ["xl:!p-0\" />", "xl:!p-2\" />"],
 ];
 for(const [withFlag,withoutFlag] of unifiedCardChanges){
  assert.equal(homeSource.split(withFlag).length,2,'approved Home feature fragment must occur exactly once');
  homeSource=homeSource.replace(withFlag,withoutFlag);
 }
 for(const [change,original] of approvedHomePieceChanges) {
  assert.equal(homeSource.split(change).length, 2, 'approved opt-in piece fragment must occur exactly once');
  homeSource=homeSource.replace(change,original);
 }
 assert.equal(homeSource.replace(flagGatedLink,''),homeBaseline);
 for(const path of ['/region/nrw','/region/nrw/turniere','/region/nrw/ligen','/region/nrw/vereine','/region/nrw/news','/region/nrw/live','/clubs-nrw/bochumer-sv-02','/spieltag','/vorbereitung']){
  assert.equal(nrwAuthReturnTarget(path,{clubs:false,spieltag:false,preparation:false}),null);
  assert.equal(nrwAuthReturnTarget(path,{clubs:true,spieltag:true,preparation:true}),path);
 }
});

test('NRW sign-in return permits only the existing flag-gated internal destinations',()=>{
 const enabled={clubs:true,spieltag:true,preparation:true};
 for(const path of ['//example.org','/region/nrw/../chat','/region/nrw/invalid','/region/nrw/news\n','/clubs-nrw/%2f%2f','/clubs-nrw/test?next=//example.org','/chat','/spieltag?team=private']){
  assert.equal(nrwAuthReturnTarget(path,enabled),null,path);
 }
 assert.equal(nrwAuthReturnTarget('/spieltag',{...enabled,spieltag:false}),null);
 assert.equal(nrwAuthReturnTarget('/vorbereitung',{...enabled,preparation:false}),null);
});
