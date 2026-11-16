#!/usr/bin/env node
'use strict';
// Rebuilds the classics knowledge records from their unmodified sources.
//   node scripts/buildClassicsKnowledge.js          write the JSON files
//   node scripts/buildClassicsKnowledge.js --check  exit 1 if a committed file is stale
const fs=require('fs');
const path=require('path');
const {build}=require('../knowledge/buildChessFundamentals');

const OUTPUTS=[{file:path.join(__dirname,'..','knowledge','classics','capablanca-chess-fundamentals.json'),build}];

function serialize(record){return JSON.stringify(record,null,1)+'\n';}

let stale=0;
for(const {file,build:make} of OUTPUTS){
 const next=serialize(make());
 const current=fs.existsSync(file)?fs.readFileSync(file,'utf8'):null;
 if(process.argv.includes('--check')){
  if(current!==next){console.error(`stale: ${path.relative(process.cwd(),file)}`);stale++;}
  continue;
 }
 fs.writeFileSync(file,next);
 const r=JSON.parse(next);
 console.log(`${path.basename(file)}: ${r.units.length} units, moves converted ${r.notation.conversion.resolved}/${r.notation.conversion.tokens}`);
}
if(stale)process.exit(1);
module.exports={serialize};
