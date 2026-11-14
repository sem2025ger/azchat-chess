'use strict';
const catalog=require('./coachKnowledgeCatalog.json');

// Server-owned bibliography. No book content, analysis, translation or PGN is included.
const normalize=text=>String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const authorAliases=[
 ['Wilhelm Steinitz',['стейниц','steinitz']],
 ['François-André Danican Philidor',['филидор','philidor']],
 ['Aron Nimzowitsch',['нимцович','немцович','nimzowitsch','nimzovich','nimzowich','nimzovitch']],
 ['Alexander Alekhine',['алехин','alekhine','alekhin','alechin']],
 ['Alexander Kotov',['котов','kotov']],
 ['José Raúl Capablanca',['капабланк','capablanca']],
 ['Tigran Petrosian',['петросян','petrosian','petrossian']]
];
function lookupCoachBibliography(message,{limit=8}={}){
 if(typeof message!=='string'||message.length>500||!Number.isInteger(limit)||limit<1||limit>20)return null;
 const q=normalize(message),matched=new Set();
 for(const [author,aliases] of authorAliases)if(aliases.some(alias=>q.includes(normalize(alias))))matched.add(author);
 if(q.includes('моя система')||q.includes('mein system')||q.includes('die praxis meines systems'))matched.add('Aron Nimzowitsch');
 if(q.includes('шахматное наследие'))matched.add('Alexander Kotov');
 if(q.includes('chess fundamentals')||q.includes('моя шахматная карьера'))matched.add('José Raúl Capablanca');
 if(!matched.size)return null;
 const selected=catalog.works.filter(work=>matched.has(work.author));
 const works=selected.slice(0,limit).map(work=>({
  id:work.id,author:work.author,titleRu:work.titleRu,titleOriginal:work.titleOriginal,
  firstPublicationYear:work.firstPublicationYear,commentaryType:work.commentaryType,
  contentIngested:false
 }));
 return {kind:'bibliography_only',schemaVersion:catalog.schemaVersion,works,truncated:selected.length>limit};
}
module.exports={lookupCoachBibliography};
