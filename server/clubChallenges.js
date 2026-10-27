'use strict';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIMES = new Set(['3+2', '5+0', '10+0']);
const REASONS = new Set(['not_allowed','not_member','expired','already_taken','challenge_limit','invalid_time_control','creator_offline','player_unavailable','rate_limit_exceeded','storage_unavailable']);
const reservations = new Set();
const fail = reason => Object.assign(new Error(reason), { reason });

function registerClubChallenges(socket, { client, io, allowedTimeControls, startGame }) {
  async function action(name, payload) {
    const actor = socket.data?.userId;
    if (!UUID.test(actor ?? '')) throw fail('not_allowed');
    if (!socket.data?.limiter?.allow('lobby')) throw fail('rate_limit_exceeded');
    if (!client) throw fail('storage_unavailable');
    if (name === 'create' && (!TIMES.has(payload?.timeControl) || !allowedTimeControls.has(payload.timeControl))) throw fail('invalid_time_control');
    if (['create','watch'].includes(name) && !UUID.test(payload?.clubId ?? '')) throw fail('not_allowed');
    if (['accept','cancel'].includes(name) && !UUID.test(payload?.challengeId ?? '')) throw fail('not_allowed');
    if (payload?.targetUserId != null && !UUID.test(payload.targetUserId)) throw fail('not_allowed');
    const { data, error } = await client.rpc('club_challenge_action', {
      p_action:name, p_actor:actor, p_club:payload?.clubId ?? null,
      p_challenge:payload?.challengeId ?? null, p_time:payload?.timeControl ?? null,
      p_target:payload?.targetUserId ?? null,
    }).abortSignal(AbortSignal.timeout(8000));
    if (error) throw fail(REASONS.has(error.message) ? error.message : 'storage_unavailable');
    if (!data?.ok) throw fail(REASONS.has(data?.code) ? data.code : 'storage_unavailable');
    return data.challenge ?? null;
  }
  async function notify(clubId) {
    const { data, error } = await client.from('chess_club_members').select('user_id').eq('club_id',clubId)
      .abortSignal(AbortSignal.timeout(8000));
    if (error) return; // Polling remains authoritative if notification fails.
    const members = new Set((data ?? []).map(row => row.user_id));
    for (const peer of io.sockets.sockets.values()) if (members.has(peer.data?.userId)) peer.emit('club_challenges_changed',{clubId});
  }
  async function update(row, values) {
    const { error } = await client.from('chess_club_challenges').update(values).eq('id',row.id)
      .eq('status','accepted').eq('accepted_by',socket.data.userId).abortSignal(AbortSignal.timeout(8000));
    if (error) throw fail('storage_unavailable');
  }
  for (const name of ['watch','create','accept','cancel']) {
    socket.on('club_challenge_' + name, async (payload, acknowledge) => {
      const ack = typeof acknowledge === 'function' ? acknowledge : () => {};
      let row;
      try {
        row = await action(name,payload);
        if (name === 'accept') {
          const actor = socket.data.userId;
          const creator = [...io.sockets.sockets.values()].find(peer => peer.connected && peer.data?.userId === row.created_by);
          if (!creator) { await update(row,{status:'expired'}); throw fail('creator_offline'); }
          if (reservations.has(actor) || reservations.has(row.created_by)) {
            await update(row,{status:'expired'}); throw fail('player_unavailable');
          }
          reservations.add(actor); reservations.add(row.created_by);
          try {
            const roomId = await startGame(creator,socket,row.time_control);
            // The existing game path has already emitted match_found only after
            // durable startup succeeds. Never roll a started game back if this
            // non-authoritative challenge-card update fails.
            try { await update(row,{room_id:roomId}); } catch { /* Polling shows accepted. */ }
          } catch (error) {
            await update(row,{status:'expired'});
            throw fail(REASONS.has(error.reason) ? error.reason : 'storage_unavailable');
          } finally { reservations.delete(actor); reservations.delete(row.created_by); }
        }
        ack({ok:true});
      } catch (error) {
        ack({ok:false,reason:REASONS.has(error.reason) ? error.reason : 'storage_unavailable'});
      } finally {
        if (row?.club_id) void notify(row.club_id).catch(() => {});
      }
    });
  }
}
module.exports = { registerClubChallenges, TIMES };
