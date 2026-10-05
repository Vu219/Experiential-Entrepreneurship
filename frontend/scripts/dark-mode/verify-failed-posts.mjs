import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { fixture, failure, pageOf } from './page-fixtures.mjs';

const dir = fileURLToPath(new URL('../../../docs/dark-mode-review/final/failed-posts/', import.meta.url));
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
try {
  for (const width of [1440, 390]) for (const mode of ['light', 'dark']) for (const kind of ['mixed', 'policy', 'technical', 'empty']) {
    const items = Array.from({ length: 14 }, (_, i) => ({ ...failure, id: `qa-failure-${i}`, errorType: i < 5 ? 'POLICY_VIOLATION' : 'TOKEN_EXPIRED', errorCode: i < 5 ? '368' : '190' }))
      .filter(p => kind === 'policy' ? p.errorType === 'POLICY_VIOLATION' : kind === 'technical' ? p.errorType !== 'POLICY_VIOLATION' : true);
    const ctx = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await ctx.addInitScript(mode => { localStorage.setItem('aima-color-mode', mode); localStorage.setItem('aima-theme', 'ocean'); }, mode);
    await ctx.route('**/api/aima/**', route => {
      const url = new URL(route.request().url()), path = url.pathname.replace('/api/aima', '');
      const result = path === '/me/failed-posts' ? pageOf(items) : fixture(path, route.request().method(), url.searchParams);
      return route.fulfill({ status: result === undefined ? 404 : 200, json: { code: result === undefined ? 404 : 200, result } });
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:3100/failed-posts', { waitUntil: 'networkidle' });
    if (kind === 'empty') await page.getByPlaceholder('Tìm theo nội dung, tài khoản, mã lỗi…').fill('no-matching-caption');
    const heading = page.getByText('Tổng quan lỗi', { exact: true });
    if (width === 390 && await heading.locator('..').getAttribute('aria-expanded') === 'false') await heading.click();
    const panel = width === 390 ? heading.locator('..').locator('..') : heading.locator('..');
    await panel.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    const audit = await panel.evaluate(el => {
      const svg = el.querySelector('svg[viewBox="0 0 148 148"]');
      const total = svg.nextElementSibling.firstElementChild;
      return { total: total.textContent, totalColor: getComputedStyle(total).color, background: getComputedStyle(el).backgroundColor, whiteCenters: svg.querySelectorAll('circle[fill="#fff"]').length, arcs: [...svg.querySelectorAll('circle')].map(c => ({ stroke: getComputedStyle(c).stroke, dash: c.getAttribute('stroke-dasharray') })) };
    });
    assert.equal(audit.total, String(kind === 'empty' ? 0 : items.length));
    assert.equal(audit.whiteCenters, 0);
    assert.equal(audit.arcs.length, kind === 'empty' || kind === 'technical' ? 1 : 2);
    if (mode === 'dark') { assert.equal(audit.background, 'rgb(18, 24, 41)'); assert.equal(audit.totalColor, 'rgb(241, 243, 251)'); }
    assert.deepEqual(errors, []);
    await panel.screenshot({ path: `${dir}/${width}-${mode}-${kind}.png` });
    results.push({ width, mode, kind, ...audit, errors });
    console.log(width, mode, kind, 'OK');
    await ctx.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(`${dir}/results.json`, JSON.stringify(results, null, 2));
}
