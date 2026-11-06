'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { qaTarget } = require('./scripts/qaM3PilotTarget');

const qa = {
  QA_SUPABASE_URL: 'https://iukmpcytsuofqhxsumbu.supabase.co',
  M3_QA_API_URL: 'https://chessaz-m3-qa-api.onrender.com',
};

test('M3 hosted pilot accepts only the dedicated HTTPS QA origins', () => {
  const expected = { supabase: qa.QA_SUPABASE_URL, api: qa.M3_QA_API_URL };
  assert.deepEqual(qaTarget(qa), expected);
  assert.deepEqual(qaTarget({
    QA_SUPABASE_URL: qa.QA_SUPABASE_URL + '/',
    M3_QA_API_URL: qa.M3_QA_API_URL + '/',
  }), expected);
});

test('M3 hosted pilot rejects the production Supabase ref and lookalikes', () => {
  for (const value of [
    undefined, 'https://kmwfvvliundhuovoakoa.supabase.co',
    qa.QA_SUPABASE_URL + '.example.com', qa.QA_SUPABASE_URL + '?fake=qa',
    qa.QA_SUPABASE_URL + '@example.com', qa.QA_SUPABASE_URL + '\n',
    qa.QA_SUPABASE_URL.replace('https:', 'http:'), qa.QA_SUPABASE_URL + '/rest/v1',
  ]) assert.throws(() => qaTarget({ ...qa, QA_SUPABASE_URL: value }), /QA_SUPABASE_URL/);
});

test('M3 hosted pilot rejects production, M2 and unapproved backend origins', () => {
  for (const value of [
    undefined, 'https://chessaz-api.onrender.com', 'https://chessaz.de',
    'https://chessaz-deutsch-qa-api.onrender.com', qa.M3_QA_API_URL + '.example.com',
    qa.M3_QA_API_URL + ':443', qa.M3_QA_API_URL + '/health', qa.M3_QA_API_URL + '#qa',
    qa.M3_QA_API_URL.replace('https://', 'https://test@'), qa.M3_QA_API_URL.replace('https:', 'http:'),
  ]) assert.throws(() => qaTarget({ ...qa, M3_QA_API_URL: value }), /M3_QA_API_URL/);
});
