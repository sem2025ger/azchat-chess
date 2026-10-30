'use strict';
// Display/export keeps canonical SAN. Only the read-aloud copy is expanded.
// File names and ranks are separate words so the voice cannot confuse c3 with e3.
const languages={
 en:{pawn:'pawn',files:['ay','bee','see','dee','ee','eff','gee','aitch'],ranks:['one','two','three','four','five','six','seven','eight'],pieces:{K:'king',Q:'queen',R:'rook',B:'bishop',N:'knight'},to:'to',takes:'takes on',file:'from file',rank:'from rank',short:'kingside castling',long:'queenside castling',promotion:'promotes to',check:'check',mate:'checkmate',move:'move',white:'White',black:'Black'},
 de:{pawn:'Bauer',files:['a','be','ze','de','e','eff','ge','ha'],ranks:['eins','zwei','drei','vier','fünf','sechs','sieben','acht'],pieces:{K:'König',Q:'Dame',R:'Turm',B:'Läufer',N:'Springer'},to:'nach',takes:'schlägt auf',file:'von der Linie',rank:'von der Reihe',short:'kurze Rochade',long:'lange Rochade',promotion:'Umwandlung in',check:'Schach',mate:'Matt',move:'Zug',white:'Weiß',black:'Schwarz'},
 ru:{pawn:'пешка',files:['а','бэ','цэ','дэ','е','эф','жэ','аш'],ranks:['один','два','три','четыре','пять','шесть','семь','восемь'],pieces:{K:'король',Q:'ферзь',R:'ладья',B:'слон',N:'конь'},to:'на',takes:'берёт на',file:'с вертикали',rank:'с горизонтали',short:'короткая рокировка',long:'длинная рокировка',promotion:'превращение в',check:'шах',mate:'мат',move:'ход',white:'белые',black:'чёрные'},
 uk:{pawn:'пішак',files:['а','бе','це','де','е','еф','же','аш'],ranks:['один','два','три','чотири','п’ять','шість','сім','вісім'],pieces:{K:'король',Q:'ферзь',R:'тура',B:'слон',N:'кінь'},to:'на',takes:'бере на',file:'з вертикалі',rank:'з горизонталі',short:'коротка рокіровка',long:'довга рокіровка',promotion:'перетворення на',check:'шах',mate:'мат',move:'хід',white:'білі',black:'чорні'},
 az:{pawn:'piyada',files:['a','be','se','de','e','ef','ge','ha'],ranks:['bir','iki','üç','dörd','beş','altı','yeddi','səkkiz'],pieces:{K:'şah',Q:'vəzir',R:'top',B:'fil',N:'at'},to:'gedir',takes:'vurur',file:'başlanğıc şaquli',rank:'başlanğıc üfüqi',short:'qısa rokirovka',long:'uzun rokirovka',promotion:'çevrilir',check:'şah',mate:'mat',move:'gediş',white:'ağlar',black:'qaralar'},
 tr:{pawn:'piyon',files:['a','be','ce','de','e','fe','ge','ha'],ranks:['bir','iki','üç','dört','beş','altı','yedi','sekiz'],pieces:{K:'şah',Q:'vezir',R:'kale',B:'fil',N:'at'},to:'gider',takes:'alır',file:'başlangıç dikeyi',rank:'başlangıç yatayı',short:'kısa rok',long:'uzun rok',promotion:'terfi',check:'şah',mate:'mat',move:'hamle',white:'beyaz',black:'siyah'}
};
const san='(?:[KQRBN](?:[a-h][1-8]|[a-h1-8])?x?[a-h][1-8]|[a-h]x[a-h][1-8](?:=[QRBN])?|[a-h][1-8](?:=[QRBN])?|[O0]-[O0](?:-[O0])?)[+#]?';
const coordinate='[a-h][1-8][-–]?[a-h][1-8][qrbnQRBN]?';
const notation=new RegExp('(?<![\\p{L}\\p{N}_/])(?:(\\d{1,3})(\\.{3}|\\.)\\s*)?((?:'+coordinate+')[+#]?|'+san+')(?![\\p{L}\\p{N}_/])','gu');
function chessSpeech(text,language){
 const l=languages[language==='ua'?'uk':language];if(!l)return text;
 const square=value=>l.files[value.charCodeAt(0)-97]+' '+l.ranks[Number(value[1])-1];
 const source=value=>[...value].map(v=>/[a-h]/.test(v)?l.file+' '+l.files[v.charCodeAt(0)-97]:l.rank+' '+l.ranks[Number(v)-1]).join(', ');
 const promoted=piece=>language==='ru'?{Q:'ферзя',R:'ладью',B:'слона',N:'коня'}[piece]:l.pieces[piece];
 return text.replace(notation,(_whole,number,dots,move)=>{
  let spoken;const suffix=move.endsWith('#')?l.mate:move.endsWith('+')?l.check:'';
  move=move.replace(/[+#]$/,'');
  if(/^[O0]-[O0]/.test(move))spoken=move.split('-').length===3?l.long:l.short;
  else if(new RegExp('^'+coordinate+'$').test(move)){
   const parts=move.replace(/[-–]/,'');spoken=square(parts.slice(0,2))+' — '+square(parts.slice(2,4));
   if(parts[4])spoken+=', '+l.promotion+' '+promoted(parts[4].toUpperCase());
  }else{
   const match=/^([KQRBN])?([a-h1-8]{0,2})(x?)([a-h][1-8])(?:=([QRBN]))?$/.exec(move);
   if(!match)return _whole;
   const [,piece,origin,capture,target,promotion]=match;
   spoken=[piece?l.pieces[piece]:capture?l.pawn:'',origin?source(origin):'',capture?l.takes:piece?l.to:'',square(target)].filter(Boolean).join(' ');
   if(promotion)spoken+=', '+l.promotion+' '+promoted(promotion);
  }
  return (number?l.move+' '+number+', '+(dots.length===3?l.black:l.white)+': ':'')+spoken+(suffix?', '+suffix:'');
 });
}
module.exports={chessSpeech};
