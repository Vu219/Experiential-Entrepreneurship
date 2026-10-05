import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fixture } from './page-fixtures.mjs';

const dir = fileURLToPath(new URL('../../../docs/dark-mode-review/brand-palettes/pastel/', import.meta.url));
fs.mkdirSync(dir, { recursive: true });
const palettes = [
  { key: 'ocean', label: 'Đại dương', en: 'Ocean', stops: ['#22d3ee', '#3b82f6', '#8b5cf6'] },
  { key: 'aurora', label: 'Tím sương', en: 'Lilac Mist', stops: ['#b7a6da', '#c6b6e6', '#d5c6ef'] },
  { key: 'sunset', label: 'Hồng sương', en: 'Rose Mist', stops: ['#dfa9c0', '#d6afd5', '#c9b8e3'] },
];
const luminance = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = palettes.slice(1).flatMap(p => p.stops.map(hex => ({ palette: p.label, hex, textRatio: (luminance(hex) + 0.05) / (luminance('#35274d') + 0.05) })));
assert.ok(contrast.every(c => c.textRatio >= 4.5));
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
try {
  for (const width of [1440, 390]) for (const mode of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await ctx.addInitScript(({ mode }) => { localStorage.setItem('aima-color-mode', mode); if (!localStorage.getItem('aima-theme')) localStorage.setItem('aima-theme', 'aurora'); }, { mode });
    await ctx.route('**/api/aima/**', route => {
      const url = new URL(route.request().url()), result = fixture(url.pathname.replace('/api/aima', ''), route.request().method(), url.searchParams);
      return route.fulfill({ status: result === undefined ? 404 : 200, json: { code: result === undefined ? 404 : 200, result } });
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:3100/settings', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'aurora');
    for (const palette of palettes) {
      await page.getByText(palette.label, { exact: true }).click();
      await page.waitForFunction(key => document.documentElement.dataset.theme === key, palette.key);
      const read = () => page.evaluate(() => ({ key: document.documentElement.dataset.theme, saved: localStorage.getItem('aima-theme'), dark: document.documentElement.classList.contains('dark'), stops: ['from', 'via', 'to'].map(s => getComputedStyle(document.documentElement).getPropertyValue('--brand-' + s).trim().toLowerCase()) }));
      let audit = await read();
      assert.equal(audit.key, palette.key); assert.equal(audit.saved, palette.key); assert.equal(audit.dark, mode === 'dark'); assert.deepEqual(audit.stops, palette.stops);
      const foregrounds = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('body *')].filter(el => {
          const s = getComputedStyle(el);
          return el.getBoundingClientRect().width && /linear-gradient/.test(s.backgroundImage) && s.backgroundClip !== 'text' && !/border-box/.test(el.getAttribute('style') || '') && (el.tagName === 'BUTTON' || [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
        });
        return nodes.map(el => ({ text: el.textContent.trim().slice(0, 45), color: getComputedStyle(el).color }));
      });
      assert.ok(foregrounds.length > 0);
      for (const el of foregrounds) assert.equal(el.color, palette.key === 'ocean' ? 'rgb(255, 255, 255)' : 'rgb(53, 39, 77)', JSON.stringify(el));
      await page.evaluate(() => document.fonts.ready);
      const card = page.getByText('Chọn bảng màu thương hiệu', { exact: true }).locator('..');
      await card.screenshot({ path: `${dir}/${palette.key}-${width}-${mode}.png` });
      await page.getByRole('button', { name: /English/ }).click();
      for (const p of palettes) await page.getByText(p.en, { exact: true }).waitFor();
      await page.getByRole('button', { name: /Tiếng Việt/ }).click();
      await page.reload({ waitUntil: 'networkidle' });
      audit = await read(); assert.equal(audit.key, palette.key); assert.deepEqual(audit.stops, palette.stops);
      assert.deepEqual(errors, []);
      results.push({ width, mode, palette: palette.label, ...audit, foregrounds, errors: [...errors] });
      console.log(width, mode, palette.label, 'OK');
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(`${dir}/results.json`, JSON.stringify({ results, contrast }, null, 2));
}
