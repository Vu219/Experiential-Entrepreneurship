// Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignQuery } from '../src/analytics/campaign.ts';

test('keeps only utm_* params, in a fixed order', () => {
  assert.equal(
    campaignQuery('?code=123456&utm_medium=social&utm_source=facebook&utm_campaign=launch_nov'),
    '?utm_source=facebook&utm_medium=social&utm_campaign=launch_nov',
  );
});

test('drops sensitive params when there is no utm', () => {
  assert.equal(campaignQuery('?orderCode=987&code=OTP'), '');
  assert.equal(campaignQuery(''), '');
});

test('ignores empty utm values', () => {
  assert.equal(campaignQuery('?utm_source=&utm_medium=social'), '?utm_medium=social');
});
