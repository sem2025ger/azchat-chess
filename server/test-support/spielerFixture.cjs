'use strict';
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {parsePlayer}=require('../scripts/importFideGer');
function acceptance(){
 const xml=readFileSync(join(__dirname,'spieler-fide-sample.xml'),'utf8');
 const record=xml.match(/<player>\s*<fideid>13404431<\/fideid>[\s\S]*?<\/player>/)?.[0];
 if(!record)throw Error('Official acceptance fixture missing');
 return parsePlayer(record,'2026-10-25');
}
module.exports={acceptance};
