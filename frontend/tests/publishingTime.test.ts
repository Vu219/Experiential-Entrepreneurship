import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishingInstant, wallTime, zonedTimestamp } from '../src/utils/publishingTime.ts';

test('Vietnam wall clock crosses UTC date boundary without using machine timezone', () => {
  assert.equal(publishingInstant('2026-09-30T00:30'), '2026-09-29T17:30:00.000Z');
  assert.equal(wallTime('2026-09-29T17:30:00Z'), '2026-09-30T00:30:00');
  const shown = zonedTimestamp('2026-09-29T17:30:00Z');
  assert.equal(shown, '2026-09-30T00:30:00+07:00');
  assert.equal(Date.parse(shown), Date.parse('2026-09-29T17:30:00Z'));
});
test('offset input round trips and IANA zones support daylight saving', () => {
  assert.equal(publishingInstant('2026-09-30T00:30:00+07:00'), '2026-09-29T17:30:00.000Z');
  assert.equal(publishingInstant('2026-07-15T12:30', 'America/New_York'), '2026-07-15T16:30:00.000Z');
  assert.equal(publishingInstant('2026-01-15T12:30', 'America/New_York'), '2026-01-15T17:30:00.000Z');
});
test('reject ambiguous and missing DST wall clocks and invalid dates', () => {
  assert.throws(() => publishingInstant('2026-03-08T02:30', 'America/New_York'));
  assert.throws(() => publishingInstant('2026-11-01T01:30', 'America/New_York'));
  assert.throws(() => publishingInstant('2026-02-30T12:30'));
});
