'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSocketAuthMiddleware } = require('./socketAuth');

const makeSocket = (auth) => ({ handshake: { auth }, data: {} });

async function invokeMiddleware(auth, verifyToken) {
  const socket = makeSocket(auth);
  const calls = [];
  const next = (...args) => {
    calls.push(args);
  };

  const middleware = createSocketAuthMiddleware(verifyToken);
  await middleware(socket, next);

  assert.equal(calls.length, 1);
  return { socket, calls };
}

function assertUnauthorized(calls) {
  assert.equal(calls[0].length, 1);
  assert.ok(calls[0][0] instanceof Error);
  assert.equal(calls[0][0].message, 'unauthorized');
}

test('T1: rejects a socket without an auth object', async () => {
  const { calls } = await invokeMiddleware(undefined, async () => {
    throw new Error('verifier should not run');
  });

  assertUnauthorized(calls);
});

test('T2: rejects an auth object without accessToken', async () => {
  const { calls } = await invokeMiddleware({}, async () => {
    throw new Error('verifier should not run');
  });

  assertUnauthorized(calls);
});

test('T3: rejects an empty accessToken', async () => {
  const { calls } = await invokeMiddleware({ accessToken: '' }, async () => {
    throw new Error('verifier should not run');
  });

  assertUnauthorized(calls);
});

test('T4: rejects non-string accessToken values', async () => {
  for (const accessToken of [42, { token: 'value' }]) {
    const { calls } = await invokeMiddleware({ accessToken }, async () => {
      throw new Error('verifier should not run');
    });

    assertUnauthorized(calls);
  }
});

test('T5: accepts a valid token and attaches the verified user', async () => {
  const user = { id: 'user-123', email: 'user@example.com' };
  const { socket, calls } = await invokeMiddleware(
    { accessToken: 'valid-token' },
    async () => user
  );

  assert.deepEqual(calls[0], []);
  assert.equal(socket.data.userId, user.id);
  assert.deepEqual(socket.data.user, {
    id: user.id,
    email: user.email,
  });
});

test('T6: rejects a token when the verifier returns null', async () => {
  const { calls } = await invokeMiddleware(
    { accessToken: 'invalid-token' },
    async () => null
  );

  assertUnauthorized(calls);
});

test('T7: rejects a token when the verifier throws', async () => {
  const { calls } = await invokeMiddleware(
    { accessToken: 'throwing-token' },
    async () => {
      throw new Error('verification failed');
    }
  );

  assertUnauthorized(calls);
});

test('T8: rejects a verifier result without an id', async () => {
  const { calls } = await invokeMiddleware(
    { accessToken: 'missing-id-token' },
    async () => ({ email: 'user@example.com' })
  );

  assertUnauthorized(calls);
});

test('T9: authorization errors never expose the token', async () => {
  const accessToken = 'sensitive-token-value';
  const { calls } = await invokeMiddleware(
    { accessToken },
    async () => null
  );

  assertUnauthorized(calls);
  const error = calls[0][0];
  assert.equal(error.message, 'unauthorized');
  assert.equal(error.message.includes(accessToken), false);
  assert.equal(String(error).includes(accessToken), false);
});
