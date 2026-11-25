import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';
import { tournamentCopy } from '../src/components/teamTournaments/copy.ts';

const id = '11111111-1111-4111-8111-111111111111';
const origin = 'https://individual-fixture.invalid';
const moduleId = '/__individual_fixture.tsx';
const fixture = `
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { IndividualEventView } from '/src/components/teamTournaments/IndividualTournamentEvents.tsx';
import { tournamentCopy } from '/src/components/teamTournaments/copy.ts';
import '/src/screens/SpieltagScreen.css';
import '/src/components/teamTournaments/teamTournaments.css';
const players = [{ no:1,name:'WhitePlayerWithAnUnbrokenLongName0123456789' },{ no:2,name:'BlackPlayer' }];
let event = { id:'${id}', name:'Individual Fixture Cup', starts_at:new Date(Date.now()-60000).toISOString(),
  status:'playing', max_players:4, round_no:1, round_limit:1, players,
  pairs:[{round_no:1,board_no:1,white_no:1,black_no:2,result:null}] };
const native = window.fetch;
window.fetch = async (input,options) => {
  const url = new URL(String(input),location.href);
  if (url.origin !== '${origin}') return native(input,options);
  if (url.pathname !== '/api/individual-tournaments/${id}') return Response.json({code:'not_found'},{status:404});
  const organizer = new Headers(options.headers).get('Authorization') === 'Bearer owner';
  if (options.method === 'POST') {
    if (!organizer) return Response.json({code:'not_allowed'},{status:403});
    window.fixtureResult = JSON.parse(options.body);
    event = {...event,status:'finished',pairs:[{...event.pairs[0],result:window.fixtureResult.input.result}]};
  }
  return Response.json({...event,organizer,joined:true});
};
function App(){
  const [lang,setLang] = useState('en');
  const [owner,setOwner] = useState(false);
  const format = new Intl.DateTimeFormat(lang==='ua'?'uk':lang,{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Berlin'});
  return <MemoryRouter><main className="spieltag-page">
    <nav>{['de','en','az','tr','ua','ru'].map(l=><button key={l} data-locale={l} onClick={()=>setLang(l)}>{l}</button>)}
      <button id="owner" onClick={()=>setOwner(true)}>Owner</button></nav>
    <IndividualEventView key={String(owner)} id="${id}" token={owner?'owner':'member'} format={format} tr={tournamentCopy(lang)}/>
  </main></MemoryRouter>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;

export async function checkIndividualTournament({cdp,evaluate,wait,click}) {
  const cacheDir = await mkdtemp(join(tmpdir(),'chessaz-individual-'));
  let server;
  try {
    server = await createServer({
      configFile:false, envDir:false, cacheDir, plugins:[{
        name:'individual-fixture',enforce:'pre',
        resolveId(name){if(name===moduleId)return name;if(/(?:^|\\/)supabase(?:\\.ts)?$/.test(name))return '\\0individual-supabase';},
        load(name){if(name===moduleId)return fixture;if(name==='\\0individual-supabase')return 'export const supabase = {};';},
        configureServer(s){s.middlewares.use(async(req,res,next)=>{
          if(req.url!=='/individual-fixture')return next();
          res.setHeader('content-type','text/html');
          res.end(await s.transformIndexHtml(req.url,'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:#202020;color:#eee}</style></head><body><div id="root"></div><script type="module" src="'+moduleId+'"></script></body></html>'));
        });}
      },react()],
      server:{host:'127.0.0.1',port:0,hmr:false},
      define:{'import.meta.env.VITE_SERVER_URL':JSON.stringify(origin)},
    });
    await server.listen();
    await cdp('Page.navigate',{url:server.resolvedUrls.local[0]+'individual-fixture'});
    await wait("document.querySelector('.individual-event-standings tbody tr')");
    assert.equal(await evaluate("document.querySelectorAll('.individual-result-form').length"),0);
    for(const width of [390,1280]){
      await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
      for(const lang of ['de','en','az','tr','ua','ru']){
        await evaluate("document.querySelector('[data-locale="+lang+"]').click()");
        const tr=tournamentCopy(lang);
        await wait("document.querySelector('.individual-event-standings h3')?.textContent==="+JSON.stringify(tr('individualStandings')));
        assert.ok(await evaluate("document.querySelector('.individual-pair').textContent.includes("+JSON.stringify(tr('white'))+")"));
        assert.ok(await evaluate("document.querySelector('.individual-pair').textContent.includes("+JSON.stringify(tr('black'))+")"));
        assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'overflow '+width+' '+lang);
      }
    }
    await evaluate("document.querySelector('[data-locale=en]').click();document.querySelector('#owner').click()");
    await wait("document.querySelector('.individual-result-form select')");
    await evaluate(`(()=>{const el=document.querySelector('.individual-result-form select');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'1-0');
      el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await click('Record result');
    await wait("document.querySelector('.individual-event-status')?.dataset.status==='finished'");
    assert.deepEqual(await evaluate('window.fixtureResult'),{action:'result',input:{round_no:1,board_no:1,result:'1-0'}});
    assert.equal(await evaluate("document.querySelector('.individual-event-standings tbody tr td:nth-child(3)').textContent"),'1');
    assert.equal(await evaluate("document.querySelectorAll('.individual-result-form').length"),0);
  } finally {
    await cdp('Emulation.clearDeviceMetricsOverride');
    await server?.close();
    await rm(cacheDir,{recursive:true,force:true});
  }
}
