import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { fixture } from './page-fixtures.mjs';
const dir = fileURLToPath(new URL('../../../docs/dark-mode-review/final/auth-controls/', import.meta.url));
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
const mobileOnly = process.argv.includes('--mobile-only');
try {
  for (const width of mobileOnly ? [390, 320] : [1919, 1440, 1024, 390, 320]) for (const mode of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await ctx.addInitScript(mode => localStorage.setItem('aima-color-mode', mode), mode);
    await ctx.route('**/api/aima/**', route => {
      const url = new URL(route.request().url()), path = url.pathname.replace('/api/aima', '');
      const result = fixture(path, route.request().method(), url.searchParams);
      return route.fulfill({ status: path === '/users/me' ? 401 : result === undefined ? 404 : 200, json: { code: path === '/users/me' ? 401 : 200, result } });
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const route of ['/login', '/register', '/forgot-password']) {
      await page.goto(`http://127.0.0.1:3100${route}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      for (const lang of ['vi', 'en']) {
        const language = page.getByRole('button', { name: lang === 'vi' ? 'Tiếng Việt' : 'English', exact: true });
        const rect = await language.boundingBox();
        const toggleButton = page.locator('.color-mode-toggle > button');
        const toggle = await toggleButton.count() ? await toggleButton.boundingBox() : null;
        assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= width);
        if (toggle) assert.ok(toggle.x - (rect.x + rect.width) >= 8, `${route}: language overlaps mode control`);
        assert.deepEqual(errors, []);
        results.push({ width, mode, route, lang, language: rect, toggle, errors: [...errors] });
        if (route === '/login' && lang === 'vi') await page.screenshot({ path: `${dir}/${width}-${mode}.png` });
        await language.click();
      }
    }
    console.log(width, mode, 'OK');
    await ctx.close();
  }
} finally {
  await browser.close();
  const previous = mobileOnly && fs.existsSync(`${dir}/results.json`) ? JSON.parse(fs.readFileSync(`${dir}/results.json`)).filter(r => r.width > 390) : [];
  fs.writeFileSync(`${dir}/results.json`, JSON.stringify([...previous, ...results], null, 2));
}
