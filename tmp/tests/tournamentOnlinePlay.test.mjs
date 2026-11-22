import test from 'node:test';
import assert from 'node:assert/strict';
import { onlineBoardState, onlineCountdown, staffOnlineBoardState } from '../src/components/teamTournaments/onlineBoardState.ts';
import { tournamentCopy, tournamentErrorMessage } from '../src/components/teamTournaments/copy.ts';

test('online board state follows the round, prior game and no-show clock', () => {
  const start = Date.parse('2031-12-20T14:00:00.000Z');
  const deadline = new Date(start + 300_000).toISOString();
  const board = { status:'scheduled', starts_at:new Date(start).toISOString(), deadline, ready:false };
  assert.equal(onlineBoardState(board,start - 1),'scheduled');
  assert.equal(onlineBoardState(board,start),'play');
  assert.equal(onlineBoardState({ ...board,deadline:null },start),'previous');
  assert.equal(onlineBoardState({ ...board,ready:true },start),'waiting');
  assert.equal(onlineBoardState(board,start + 300_000),'closed');
  for (const status of ['starting','live','finished','forfeit']) {
    assert.equal(onlineBoardState({ ...board,status },start),status);
  }
  assert.equal(onlineCountdown(deadline,start),'5:00');
  assert.equal(onlineCountdown(deadline,start + 241_100),'0:59');
  assert.equal(onlineCountdown(deadline,start + 300_001),'0:00');
  assert.equal(onlineCountdown(null,start),null);
  for (const status of ['scheduled','starting','live','finished','forfeit']) {
    const board = { status, white_ready_at:null, black_ready_at:null };
    assert.equal(staffOnlineBoardState(board),status === 'starting' ? 'waiting' : status);
  }
  assert.equal(staffOnlineBoardState({ status:'scheduled',white_ready_at:'now' }),'waiting');
});

test('online board labels and automatic reporting error resolve in all six locales', () => {
  for (const language of ['de','en','az','tr','ua','ru']) {
    const tr = tournamentCopy(language);
    for (const key of ['onlinePlay','onlinePrevious','onlineWaiting','onlineBanner','onlineStarting','onlineScore',
      'onlineForfeit','onlineReadyBy','onlineStartsIn','onlineLive','onlineFinished','onlineReadyError']) {
      assert.ok(tr(key).length > 0);
    }
    assert.equal(tournamentErrorMessage('online_mode',tr),tr('onlineAutomaticResult'));
  }
});
