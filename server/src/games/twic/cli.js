'use strict';
require('dotenv').config();
const { createGamesStore } = require('../db');
const { targetGuard,latestIssue,importIssue } = require('./importer');
function options(argv){
  const values={};for(let i=0;i<argv.length;i++){
    const arg=argv[i];if(!['--issue','--latest','--backfill','--target-ref'].includes(arg)||Object.hasOwn(values,arg))throw new Error('INVALID_ARGUMENTS');
    if(arg==='--latest'){values[arg]=true;continue;}
    if(arg==='--backfill' && (!argv[i+1]||argv[i+1].startsWith('--'))){values[arg]='4';continue;}
    if(!argv[i+1]||argv[i+1].startsWith('--'))throw new Error('INVALID_ARGUMENTS');values[arg]=argv[++i];
  }
  if(['--issue','--latest','--backfill'].filter(k=>values[k]!==undefined).length!==1)throw new Error('CHOOSE_ONE_IMPORT_MODE');
  for(const key of ['--issue','--backfill'])if(values[key]!==undefined&&(!/^\d+$/.test(values[key])||+values[key]<1||+values[key]>10000))throw new Error('INVALID_ARGUMENTS');
  return values;
}
async function main(argv=process.argv.slice(2),env=process.env){
  const args=options(argv);targetGuard(env.SUPABASE_URL,args['--target-ref']);
  if(env.TWIC_IMPORT_ENABLED!=='true')throw new Error('TWIC_IMPORT_DISABLED');
  const store=createGamesStore(env);const latest=args['--issue']?+args['--issue']:await latestIssue();
  const count=args['--backfill']?+args['--backfill']:1;
  if(count>latest)throw new Error('INVALID_ARGUMENTS');
  for(let issue=latest-count+1;issue<=latest;issue++)console.log(JSON.stringify({issue,...await importIssue({issue,store,maxMb:Number(env.TWIC_MAX_DB_MB||300)})}));
}
if(require.main===module)main().catch(()=>{console.error('TWIC import stopped; check QA target, flags, source access and size budget.');process.exitCode=1;});
module.exports={options,main};
