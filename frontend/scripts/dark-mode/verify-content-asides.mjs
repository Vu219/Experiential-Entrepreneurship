import { chromium } from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { fixture } from './page-fixtures.mjs';
const dir = fileURLToPath(new URL('../../../docs/dark-mode-review/final/content-asides/', import.meta.url));
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
try {
  for (const width of [1440, 390]) for (const mode of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await ctx.addInitScript(mode => localStorage.setItem('aima-color-mode', mode), mode);
    await ctx.route('**/api/aima/**', route => {
      const url = new URL(route.request().url()), result = fixture(url.pathname.replace('/api/aima', ''), route.request().method(), url.searchParams);
      return route.fulfill({ status: result === undefined ? 404 : 200, json: { code: result === undefined ? 404 : 200, result } });
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const [name, route, minimum] of [
      ['source', '/create/new', 1], ['generate', '/create/qa-draft?step=2', 3],
      ['finalize', '/create/qa-draft?step=3', 5], ['schedule', '/create/qa-content', 1],
      ['detail', '/create?view=qa-content', 3],
    ]) {
      await page.goto(`http://127.0.0.1:3100${route}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const panels = page.locator('div[style*="linear-gradient(150deg"][style*="--c-promo-border"]');
      assert.ok(await panels.count() >= minimum, `${name}: highlighted cards missing`);
      const audit = await panels.evaluateAll(els => els.map(el => ({ title: el.textContent.slice(0, 60), background: getComputedStyle(el).backgroundImage, border: getComputedStyle(el).borderColor })));
      for (const panel of audit) assert.match(panel.background, /linear-gradient\(150deg/);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${dir}/${name}-${width}-${mode}.png`, fullPage: true });
      if (name === 'detail') {
        await panels.first().screenshot({ path: `${dir}/source-card-${width}-${mode}.png` });
        const collapse = page.getByRole('button', { name: 'Thu gọn thông tin nguồn', exact: true });
        if (await collapse.count()) { await collapse.click(); assert.equal(await panels.first().locator('button[aria-expanded]').getAttribute('aria-expanded'), 'false'); }
      }
      results.push({ width, mode, name, audit, errors: [...errors] }); console.log(width, mode, name, 'OK');
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(`${dir}/results.json`, JSON.stringify(results, null, 2));
}
