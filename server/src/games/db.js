'use strict';
const { createClient } = require('@supabase/supabase-js');
const { GamesError } = require('./errors');
function createGamesStore(env = process.env) {
  // Same server-only credential path as matchPersistence; no frontend key fallback.
  if(!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY)throw new GamesError('INTERNAL');
  const client=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  return {
    async call(operation,args={}){
      const {data,error}=await client.rpc('chess_db_control',{p_operation:operation,...args}).abortSignal(AbortSignal.timeout(8000));
      if(error)throw new Error('CHESS_DB_OPERATION_FAILED');
      return data;
    },
    async search(args){
      const {data,error}=await client.rpc('chess_db_search',args).abortSignal(AbortSignal.timeout(8000));
      if(error)throw new GamesError('INTERNAL');return data;
    },
    async pgn(id){
      const {data,error}=await client.from('chess_db_games').select('pgn').eq('id',id).maybeSingle().abortSignal(AbortSignal.timeout(8000));
      if(error)throw new GamesError('INTERNAL');if(!data)throw new GamesError('NOT_FOUND');return data;
    },
  };
}
module.exports={createGamesStore};
