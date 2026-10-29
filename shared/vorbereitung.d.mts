export interface PreparationGame { id:string;lichessId?:string;pgn:string;white:string;black:string;result:string;date:string;opening:string;eco:string|null;color:'white'|'black';speed:string;timeControl:string;createdAt:number;source?:string;sourceUrl?:string|null;licenseUrl?:string|null;event?:string;link_basis?:'fide_id'|'name' }
export interface PreparationFilters { color?:string;speed?:string;timeControl?:string;variation?:string }
export interface PreparationStats { games:number;wins:number;draws:number;losses:number;winPct:number;drawPct:number;lossPct:number }
export interface PreparationAnalysis { games:PreparationGame[];byColor:{white:PreparationStats;black:PreparationStats};openings:(PreparationStats & {color:string;opening:string;eco:string|null})[] }
export function analysePreparation(source:PreparationGame[],filters?:PreparationFilters):PreparationAnalysis;
