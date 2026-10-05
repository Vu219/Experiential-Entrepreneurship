import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fixture } from './page-fixtures.mjs';
const dir = fileURLToPath(new URL('../../../docs/dark-mode-review/brand-palettes/pastel/', import.meta.url));
const routes = ['/dashboard', '/create/qa-content', '/create/qa-draft', '/brand', '/billing', '/admin/landing', '/', '/login'];
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const prior = process.argv.includes('--remaining') && fs.existsSync(`${dir}/surface-results.json`) ? JSON.parse(fs.readFileSync(`${dir}/surface-results.json`)) : [];
const results = [...prior];
try {
  for (const theme of ['aurora', 'sunset']) for (const width of [1440, 390]) for (const mode of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await ctx.addInitScript(({ theme, mode }) => { localStorage.setItem('aima-theme', theme); localStorage.setItem('aima-color-mode', mode); }, { theme, mode });
    let authed = true;
    await ctx.route('**/api/aima/**', route => {
      const url = new URL(route.request().url()), path = url.pathname.replace('/api/aima', '');
      if (path === '/users/me' && !authed) return route.fulfill({ status: 401, json: { code: 401 } });
      const result = fixture(path, route.request().method(), url.searchParams);
      return route.fulfill({ status: result === undefined ? 404 : 200, json: { code: result === undefined ? 404 : 200, result } });
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const route of routes) {
      if (prior.some(r => r.theme === theme && r.width === width && r.mode === mode && r.route === route)) continue;
      authed = route !== '/login';
      await page.goto('http://127.0.0.1:3100' + route, { waitUntil: 'networkidle' });
      const foregrounds = await page.evaluate(theme => [...document.querySelectorAll('body *')].filter(el => {
        const s = getComputedStyle(el), rgb = theme === 'aurora' ? 'rgb(183, 166, 218)' : 'rgb(223, 169, 192)';
        return el.getBoundingClientRect().width && s.backgroundImage.includes(rgb) && s.backgroundClip !== 'text' && !/border-box/.test(el.getAttribute('style') || '') && (el.tagName === 'BUTTON' || [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
      }).map(el => ({ text: el.textContent.trim().slice(0, 55), color: getComputedStyle(el).color })), theme);
      for (const el of foregrounds) assert.equal(el.color, 'rgb(53, 39, 77)', `${route}: ${JSON.stringify(el)}`);
      assert.deepEqual(errors, []);
      if (theme === 'sunset' && mode === 'dark' && ['/create/qa-content', '/', '/login'].includes(route)) await page.screenshot({ path: `${dir}/surface-${route.replaceAll('/', '_')}-${width}.png`, fullPage: true });
      results.push({ theme, width, mode, route, foregrounds, errors: [...errors] });
    }
    console.log(theme, width, mode, '8 routes OK');
    await ctx.close();
  }
} finally { await browser.close(); fs.writeFileSync(`${dir}/surface-results.json`, JSON.stringify(results, null, 2)); }
