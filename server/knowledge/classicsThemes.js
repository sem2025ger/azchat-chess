'use strict';
// Strategic theme taxonomy for the classics knowledge base, keyword tagging of passages and
// material signatures of positions. Tags are deterministic: same text → same themes.

const THEMES={
 'basic-mates':{en:'Basic mates',de:'Elementare Mattführungen',ru:'Элементарные маты',re:/\b(?:mate with|mating (?:net|position)|to mate|Rook and King against King|Queen and King against King|two Bishops and King)\b/i},
 'pawn-endings':{en:'Pawn endings',de:'Bauernendspiele',ru:'Пешечные эндшпили',re:/\bPawn[- ]endings?\b/i},
 'opposition':{en:'Opposition',de:'Opposition',ru:'Оппозиция',re:/\bopposition\b/i},
 'king-activity':{en:'Active king in the ending',de:'Aktiver König im Endspiel',ru:'Активный король в эндшпиле',re:/\b(?:the King (?:must|should) (?:be brought|come|go)|King to the centre|bring(?:ing)? (?:up )?(?:his|the) King|march of the King)\b/i},
 'passed-pawn':{en:'Passed pawns and promotion',de:'Freibauern und Umwandlung',ru:'Проходные пешки и превращение',re:/\b(?:passed Pawns?|queen(?:s|ing)? the Pawn|Pawn (?:will )?queens?|to Queen\b|go(?:es)? to Queen)/i},
 'pawn-majority':{en:'Pawn majority',de:'Bauernmehrheit',ru:'Пешечное большинство',re:/\b(?:majority of Pawns|Pawns? majority|a unit that holds two|three (?:Pawns )?(?:to|against) two)\b/i},
 'rook-endings':{en:'Rook endings',de:'Turmendspiele',ru:'Ладейные эндшпили',re:/\b(?:Rook endings?|endings? (?:of|with) (?:one |two )?Rooks?)\b/i},
 'queen-vs-rook':{en:'Queen against rook',de:'Dame gegen Turm',ru:'Ферзь против ладьи',re:/\bQueen against Rook\b/i},
 'minor-pieces':{en:'Knight and bishop',de:'Springer und Läufer',ru:'Конь и слон',re:/\b(?:Knight (?:and|or|against|v\.?) Bishop|Bishop (?:and|or|against|v\.?) Knight|value of (?:the )?(?:Knight|Bishop))\b/i},
 'bishop-pair':{en:'Bishop pair',de:'Läuferpaar',ru:'Два слона',re:/\btwo Bishops\b/i},
 'piece-values':{en:'Relative value of the pieces',de:'Relativer Wert der Figuren',ru:'Относительная ценность фигур',re:/\b(?:relative value|worth (?:about|more than|less than)|value of the pieces|the exchange\b)/i},
 'opening-development':{en:'Development in the opening',de:'Entwicklung in der Eröffnung',ru:'Развитие в дебюте',re:/\b(?:develop(?:ment|ing|s)?\b|developing move|bring out (?:the|his) pieces)/i},
 'centre-control':{en:'Control of the centre',de:'Zentrumskontrolle',ru:'Контроль центра',re:/\b(?:control of the centre|the centre|centre Pawns?)\b/i},
 'opening-traps':{en:'Opening traps',de:'Eröffnungsfallen',ru:'Дебютные ловушки',re:/\b(?:traps?|fall(?:s)? into)\b/i},
 'attack-on-king':{en:'Attack on the king',de:'Königsangriff',ru:'Атака на короля',re:/\b(?:attack (?:against|on) the King|King'?s? side attack|mating attack|direct attack)\b/i},
 'combinations':{en:'Combinations and sacrifices',de:'Kombinationen und Opfer',ru:'Комбинации и жертвы',re:/\b(?:combination|sacrific(?:e|es|ed|ing)|gives up (?:the|a) (?:Queen|Rook|Bishop|Knight|piece))\b/i},
 'initiative':{en:'Initiative',de:'Initiative',ru:'Инициатива',re:/\binitiative\b/i},
 'threats':{en:'Threats and indirect attack',de:'Drohungen und indirekter Angriff',ru:'Угрозы и косвенная атака',re:/\b(?:threat(?:en(?:s|ed|ing)?)?|indirect attack)\b/i},
 'open-files':{en:'Open files and the seventh rank',de:'Offene Linien und siebte Reihe',ru:'Открытые линии и седьмая горизонталь',re:/\b(?:open (?:file|line)s?|seventh rank|7th rank|doubl(?:e|ed|ing) (?:the )?Rooks)\b/i},
 'pawn-structure':{en:'Pawn structure and weak pawns',de:'Bauernstruktur und schwache Bauern',ru:'Пешечная структура и слабые пешки',re:/\b(?:backward Pawn|isolated Pawn|doubled Pawns?|weak Pawns?|Pawn (?:formation|position|structure|skeleton)|weakness(?:es)?)\b/i},
 'holes-outposts':{en:'Holes and outposts',de:'Löcher und Vorposten',ru:'Дыры и форпосты',re:/\b(?:holes?\b|outposts?)\b/i},
 'piece-coordination':{en:'Piece coordination and cutting off pieces',de:'Figurenzusammenspiel, abgeschnittene Figuren',ru:'Взаимодействие фигур, отрезанные фигуры',re:/\b(?:cut(?:ting)? off|out of play|co-?operation of the pieces|scene of action)\b/i},
 'defence':{en:'Defence',de:'Verteidigung',ru:'Защита',re:/\b(?:defen[cs]e|defensive|safe position)\b/i},
 'planning':{en:'Planning and evaluation',de:'Planung und Stellungsbewertung',ru:'План и оценка позиции',re:/\b(?:plan\b|plans\b|planned|general idea|object (?:is|was) to)\b/i},
 'endgame-technique':{en:'Endgame technique',de:'Endspieltechnik',ru:'Техника эндшпиля',re:/\b(?:the ending|endings?\b|end-game)\b/i},
 'annotated-game':{en:'Annotated master game',de:'Kommentierte Meisterpartie',ru:'Комментированная партия мастера',re:null}
};
const THEME_IDS=Object.keys(THEMES);

function tagThemes(text,base=[]){
 const out=new Set(base);
 for(const id of THEME_IDS){const re=THEMES[id].re;if(re&&re.test(text))out.add(id);}
 return THEME_IDS.filter(id=>out.has(id));
}

const ORDER='KQRBNP';
// "KRPPvKR": White's men then Black's, kings first, pawns last.
function materialSignature(fen){
 const placement=fen.split(' ')[0],count={};
 for(const ch of placement)if(/[a-zA-Z]/.test(ch))count[ch]=(count[ch]||0)+1;
 const side=up=>[...ORDER].map(p=>(up?p:p.toLowerCase())).map(p=>p.toUpperCase().repeat(count[p]||0)).join('');
 const white=side(true),black=side(false);
 const strip=s=>s.replace(/P/g,'');
 const nonPawn=s=>[...strip(s)].filter(p=>p!=='K').length;
 const value={Q:9,R:5,B:3,N:3};
 const pieceValue=s=>[...strip(s)].reduce((a,p)=>a+(value[p]||0),0);
 const total=pieceValue(white)+pieceValue(black);
 return {
  exact:`${white}v${black}`,
  pieces:`${strip(white)}v${strip(black)}`,
  phase:total<=26&&nonPawn(white)+nonPawn(black)<=6?'endgame':total>=60?'opening-or-middlegame':'middlegame'
 };
}
module.exports={THEMES,THEME_IDS,tagThemes,materialSignature};
