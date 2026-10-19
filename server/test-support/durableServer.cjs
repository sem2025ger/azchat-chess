'use strict';
// Test process entry point only. Production index.js has no test-auth switch.
if (process.env.NODE_ENV !== 'test' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.SUPABASE_URL ?? '')) {
  throw new Error('Local test endpoint required');
}
const { server, recoveryReady, setTokenVerifier } = require('../index');
const users = {
  white: '11111111-1111-4111-8111-111111111111',
  black: '22222222-2222-4222-8222-222222222222',
  stranger: '33333333-3333-4333-8333-333333333333',
};
setTokenVerifier(async token => users[token] ? { id: users[token] } : null);
recoveryReady.then(() => server.listen(0, '127.0.0.1', () => {
  process.send({ port: server.address().port });
}));
