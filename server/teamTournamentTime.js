'use strict';

// Keep the same Europe/Berlin round-trip rule as
// tmp/src/services/spieltag.ts:berlinDateTimeToIso.
// Reject missing and duplicated wall-clock minutes at both DST transitions.
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function berlinLocal(instant) {
  const parts = formatter.formatToParts(new Date(instant));
  const value = type => parts.find(part => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
}

function berlinLocalToIso(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) {
    throw new RangeError('invalid_time');
  }
  const guess = Date.parse(value + ':00Z');
  if (!Number.isFinite(guess)) throw new RangeError('invalid_time');
  const candidates = [1, 2]
    .map(hours => new Date(guess - hours * 3600000).toISOString())
    .filter(iso => berlinLocal(iso) === value);
  if (candidates.length !== 1) throw new RangeError('invalid_time');
  return candidates[0];
}

function validateEventTimes(start, deadline, now = Date.now()) {
  const startsAt = berlinLocalToIso(start);
  const deadlineAt = berlinLocalToIso(deadline);
  if (Date.parse(deadlineAt) <= now || Date.parse(deadlineAt) >= Date.parse(startsAt)) {
    throw new RangeError('invalid_time');
  }
  return { starts_at: startsAt, registration_deadline: deadlineAt };
}

module.exports = { berlinLocal, berlinLocalToIso, validateEventTimes };
