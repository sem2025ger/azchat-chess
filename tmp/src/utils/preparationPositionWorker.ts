import {indexPreparationGames,searchPreparationPosition} from './preparationPositions';
let indexed:ReturnType<typeof indexPreparationGames>={index:[],rejected:0};
self.onmessage=event=>{const message=event.data;
 try{if(message.type==='index'){indexed=indexPreparationGames(message.games);return;}
  self.postMessage({id:message.id,...searchPreparationPosition(indexed.index,message.fen,message.filters),rejected:indexed.rejected});
 }catch{self.postMessage({id:message.id,error:'Ungültige Stellung'});}
};
