'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Chess}=require('chess.js');
const {chessSpeech}=require('./chessSpeech');
test('Russian speech expands SAN without losing pieces, source, target, captures or check',()=>{
 assert.equal(chessSpeech('1.e4 e5 2.Nf3 Nc6 3.Bb5 a6','ru'),'ход 1, белые: е четыре е пять ход 2, белые: конь на эф три конь на цэ шесть ход 3, белые: слон на бэ пять а шесть');
 assert.equal(chessSpeech('12...Nxe5+; O-O; 0-0-0; R1e2; Nbd2; Qh4e1#; exd8=Q+','ru'),'ход 12, чёрные: конь берёт на е пять, шах; короткая рокировка; длинная рокировка; ладья с горизонтали один на е два; конь с вертикали бэ на дэ два; ферзь с вертикали аш, с горизонтали четыре на е один, мат; пешка с вертикали е берёт на дэ восемь, превращение в ферзя, шах');
 assert.equal(chessSpeech('e2e4, e7-e8q+','ru'),'е два — е четыре, е семь — е восемь, превращение в ферзя, шах');
});
test('all six languages speak both coordinates separately and localize castling and pieces',()=>{
 const expected={en:'knight takes on ee five, check; kingside castling; see three',de:'Springer schlägt auf e fünf, Schach; kurze Rochade; ze drei',ru:'конь берёт на е пять, шах; короткая рокировка; цэ три',uk:'кінь бере на е п’ять, шах; коротка рокіровка; це три',az:'at vurur e beş, şah; qısa rokirovka; ce üç',tr:'at alır e beş, şah; kısa rok; ce üç'};
 for(const [lang,spoken]of Object.entries(expected))assert.equal(chessSpeech('Nxe5+; O-O; c3',lang),spoken,lang);
 assert.equal(chessSpeech('Nxe5','ua'),chessSpeech('Nxe5','uk'));
});
test('preserves ordinary prose, counts, ratings, decimal evaluations and partial word matches',()=>{
 const prose='Plan B2B, 25 games, Elo 2650, score +0.23, 2026-10-30, abc3, e40, NF3, 1/2-1/2.';
 for(const lang of ['en','de','ru','uk','az','tr'])assert.equal(chessSpeech(prose,lang),prose);
 assert.equal(chessSpeech('Nf3','unknown'),'Nf3');
});
test('every SAN move in legal castling, capture, promotion and disambiguation fixtures is expanded',()=>{
 const boards=[new Chess(),new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'),new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1'),new Chess('4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1')];
 for(const board of boards)for(const san of board.moves())for(const lang of ['en','de','ru','uk','az','tr']){
  const spoken=chessSpeech(san,lang);assert.notEqual(spoken,san,lang+' '+san);assert.ok(!/[+#=]/.test(spoken),spoken);
 }
});
