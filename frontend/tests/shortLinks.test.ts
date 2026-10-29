// Chạy: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortLinkTarget } from '../src/analytics/shortLinks.ts';

test('known codes redirect home with the channel utm', () => {
  assert.equal(shortLinkTarget('fb'), '/?utm_source=facebook&utm_medium=social');
  assert.equal(shortLinkTarget('TikTok'), '/?utm_source=tiktok&utm_medium=social');
});

test('unknown or missing code goes home without utm', () => {
  assert.equal(shortLinkTarget('xyz'), '/');
  assert.equal(shortLinkTarget(undefined), '/');
});
