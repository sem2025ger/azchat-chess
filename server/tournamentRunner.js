'use strict';
const { randomUUID } = require('node:crypto');
const { Chess } = require('chess.js');
const { pairSwiss } = require('./tournamentPairing');
const DEFAULT_FEN='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const CONTROL_BY_FORMAT={bullet:'1+0',blitz:'3+2',rapid:'10+0'};

function createTournamentRunner({ db, durableGames, io, activeRooms, socketToRoom,
  now=Date.now, uid=randomUUID, log=()=>{}, enabled=false }) {
  let inFlight=null, alerted=new Set();

  async function query(builder) {
    const response=await builder.abortSignal(AbortSignal.timeout(8000));
    if(response.error)throw new Error('tournament_storage_error');
    return response.data||[];
  }
  async function transition(action,tournamentId,{round=null,pairs=null,roomId=null}={}) {
    const response=await db.rpc('chess_club_tournament_transition',{
      p_action:action,p_tournament_id:tournamentId,p_round_no:round,
      p_pairs:pairs,p_room_id:roomId,
    }).abortSignal(AbortSignal.timeout(8000));
    if(response.error)throw new Error('tournament_transition_error');
    if(!response.data?.ok)return response.data||{ok:false,code:'invalid_transition'};
    return response.data;
  }
  async function readGames(id) {
    return query(db.from('chess_club_tournament_games')
      .select('id,tournament_id,round_no,board_no,white_id,black_id,room_id,status,result')
      .eq('tournament_id',id).order('round_no').order('board_no').limit(1100));
  }
  async function notify(game) {
    if(!game.room_id)return;
    for(const socket of io.sockets.sockets.values()){
      const color=socket.data?.userId===game.white_id?'w':socket.data?.userId===game.black_id?'b':null;
      if(!color)continue;
      const k=socket.id+':'+game.room_id;
      if(alerted.has(k))continue;
      alerted.add(k);
      socket.emit('tournament_match_ready',{tournamentId:game.tournament_id,
        roomId:game.room_id,color,round:game.round_no,board:game.board_no});
    }
    if(alerted.size>4096)alerted=new Set();
  }
  async function startGame(game, tournament) {
    if(!game.room_id||!game.black_id||!['pending','live'].includes(game.status))return;
    if(game.status==='live'){await notify(game);return;}
    // Fail closed if durable storage is unhealthy or disabled. No volatile games
    // in rated tournament play, and no alternate competing chess engine.
    if(!durableGames.ready())return;
    const existing=await query(db.from('durable_games').select('room_id')
      .eq('room_id',game.room_id).limit(1));
    if(!existing.length) {
      if(activeRooms.has(game.room_id))return;
      const sockets={};
      for(const color of ['w','b']) {
        const userId=color==='w'?game.white_id:game.black_id;
        sockets[color]=[...io.sockets.sockets.values()].find(s=>
          s.connected && s.data?.userId===userId && !socketToRoom.has(s.id))||null;
      }
      const control=tournament.time_control||CONTROL_BY_FORMAT[tournament.format]||'3+2';
      if(!/^(?:1\+0|1\+1|2\+1|3\+0|3\+2|5\+0|10\+0|15\+10|30\+0)$/.test(control))
        throw new Error('invalid_time_control');
      const [minutes,increment]=control.split('+').map(Number);
      const instant=now();
      const room={
        roomId:game.room_id,game:new Chess(),status:'active',drawOfferBy:null,
        startedAt:new Date(instant).toISOString(),timeControl:control,
        initialTime:minutes*60,increment,initialFen:DEFAULT_FEN,
        whiteTimeMs:minutes*60000,blackTimeMs:minutes*60000,
        lastMoveTimestamp:instant,persisted:false,isPrivate:false,
        socketIds:new Set(Object.values(sockets).filter(Boolean).map(s=>s.id)),
        disconnects:{w:{timer:null,disconnectedAt:null,deadline:null},
          b:{timer:null,disconnectedAt:null,deadline:null}},
        userIds:{w:game.white_id,b:game.black_id},
        players:{w:sockets.w?.id||null,b:sockets.b?.id||null},
      };
      // First commit durable room, then install it in memory: no ephemeral game
      // can escape after a DB error. The immutable room UUID survives retries.
      try{await durableGames.start(room);}
      catch(error){
        log({code:'TOURNAMENT_ROOM_START_BLOCKED',roomId:game.room_id});
        return;
      }
      activeRooms.set(room.roomId,room);
      for(const color of ['w','b']){
        const socket=sockets[color];if(!socket)continue;
        socket.join(room.roomId);socketToRoom.set(socket.id,room.roomId);
      }
      io.to(room.roomId).emit('game_start',{
        whiteTime:room.initialTime,blackTime:room.initialTime,
      });
    }
    const ack=await transition('live',game.tournament_id,{roomId:game.room_id});
    if(ack.ok)await notify(game);
  }
  async function processTournament(tournament) {
    if(!tournament.competition_enabled)return;
    let games=await readGames(tournament.id);
    for(const game of games)if(game.room_id && game.status==='live'){
      await transition('result',tournament.id,{roomId:game.room_id});
    }
    games=await readGames(tournament.id);
    if(tournament.current_round< tournament.rounds_total && (
      tournament.current_round===0 && tournament.status==='scheduled'
      && Date.parse(tournament.starts_at)<=now()
      || tournament.current_round>0 && tournament.status==='running'
         && games.some(g=>g.round_no===tournament.current_round)
         && games.filter(g=>g.round_no===tournament.current_round)
           .every(g=>g.status==='completed')
    )){
      const entries=await query(db.from('chess_club_tournament_entries')
        .select('user_id').eq('tournament_id',tournament.id).limit(65));
      if(entries.length<tournament.min_players || entries.length>64)return;
      const ids=entries.map(x=>x.user_id);
      const profiles=await query(db.from('profiles')
        .select('id,rating_blitz,rating_rapid,rating_bullet').in('id',ids));
      const ratings=new Map(profiles.map(x=>[x.id,x['rating_'+tournament.format]||1200]));
      const players=ids.map(id=>({id,rating:ratings.get(id)||1200}));
      const history=games.filter(g=>g.status==='completed').map(g=>({
        whiteId:g.white_id,blackId:g.black_id,result:g.result,
      }));
      const round=tournament.current_round+1;
      const pairs=pairSwiss(players,history,round);
      const serialized=pairs.pairs.map(pair=>({
        whiteId:pair.whiteId,blackId:pair.blackId,roomId:uid(),
      }));
      if(pairs.byeId)serialized.push({whiteId:pairs.byeId,blackId:null,roomId:null,result:'bye'});
      const published=await transition('publish',tournament.id,{round,pairs:serialized});
      if(!published.ok){
        log({code:'TOURNAMENT_ROUND_BLOCKED',reason:published.code});
        return;
      }
      games=await readGames(tournament.id);
    }
    for(const game of games.filter(g=>g.status==='pending'||g.status==='live'))
      await startGame(game,tournament);
  }
  async function tick(){
    if(!enabled||!durableGames.ready())return;
    if(inFlight)return inFlight;
    inFlight=(async()=>{
      try{
        const tournaments=await query(db.from('chess_club_tournaments')
          .select('id,starts_at,status,format,time_control,current_round,rounds_total,min_players,competition_enabled')
          .eq('competition_enabled',true).in('status',['scheduled','running']).limit(15));
        for(const tournament of tournaments){
          try{await processTournament(tournament);}
          catch(error){log({code:'TOURNAMENT_TICK_FAILED',tournamentId:tournament.id,
            errorCode:/^[A-Z_]{3,36}$/.test(error.message)?error.message:'internal_error'});}
        }
      }catch{log({code:'TOURNAMENT_DATABASE_UNAVAILABLE'});}
    })().finally(()=>{inFlight=null;});
    return inFlight;
  }
  return {tick,processTournament};
}
module.exports={createTournamentRunner,CONTROL_BY_FORMAT};
