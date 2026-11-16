'use strict';
// Only explicit assessment/plan questions enter the optional illustrated lesson flow.
// Archive searches, tactical one-move questions and arbitrary chat stay unchanged.
function isPlanRequest(message){
 if(typeof message!=='string'||message.length>500)return false;
 return /(?:\b(?:assess|evaluate|strategic|strategy|plan|spielplan|bewerte|bewerten|strategie|değerlendir|planı|qiymətləndir|planı|planı)\b|план|оцени|оцін|стратег|planı|oyun\s+planı)/iu.test(message);
}
module.exports={isPlanRequest};
