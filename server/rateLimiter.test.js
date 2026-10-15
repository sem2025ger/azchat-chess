'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { TokenBucket, createSocketRateLimiter } = require('./rateLimiter');

test('RL-1: TokenBucket allows requests up to capacity and refills over time', async () => {
  const bucket = new TokenBucket(3, 10); // capacity 3, refill 10 per sec (1 every 100ms)

  assert.equal(bucket.consume(1), true);
  assert.equal(bucket.consume(1), true);
  assert.equal(bucket.consume(1), true);
  assert.equal(bucket.consume(1), false, 'Must reject when tokens exhausted');

  // Wait 150ms -> should refill at least 1 token
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(bucket.consume(1), true, 'Must allow after refill');
});

test('RL-2: createSocketRateLimiter allows normal rapid chess play without throttling', () => {
  const limiter = createSocketRateLimiter();

  // Simulate 8 rapid legal moves in blitz
  for (let i = 0; i < 8; i++) {
    assert.equal(limiter.allow('move'), true);
  }
});

test('RL-3: createSocketRateLimiter rejects burst flood attacks on move bucket', () => {
  const limiter = createSocketRateLimiter();

  // Consume full burst capacity of 10
  for (let i = 0; i < 10; i++) {
    assert.equal(limiter.allow('move'), true);
  }

  // Next immediate attempts must be throttled
  assert.equal(limiter.allow('move'), false);
  assert.equal(limiter.allow('move'), false);
});

test('RL-4: createSocketRateLimiter throttles lobby and game_action bursts at lower threshold', () => {
  const limiter = createSocketRateLimiter();

  // Lobby burst capacity is 5
  for (let i = 0; i < 5; i++) {
    assert.equal(limiter.allow('lobby'), true);
  }
  assert.equal(limiter.allow('lobby'), false);

  // game_action burst capacity is 5
  for (let i = 0; i < 5; i++) {
    assert.equal(limiter.allow('game_action'), true);
  }
  assert.equal(limiter.allow('game_action'), false);
});
