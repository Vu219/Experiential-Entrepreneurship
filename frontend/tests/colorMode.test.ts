// Chạy: npm test  (node --test --experimental-strip-types — không cần thêm dependency)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { DARK_CAPABLE_PREFIXES, isDarkCapablePath, resolveDark } from '../src/store/colorMode.ts';

test('index.html pre-paint script lists the same dark-capable routes', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const m = html.match(/var prefixes = \[([^\]]+)\]/);
  assert.ok(m, 'prefixes array not found in index.html');
  const fromHtml = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  assert.deepEqual(fromHtml, [...DARK_CAPABLE_PREFIXES]);
});

test('app, admin and public routes are dark-capable', () => {
  for (const p of ['/dashboard', '/create/new', '/calendar/abc', '/settings/usage', '/admin', '/admin/ai/models', '/', '/pricing', '/login', '/register', '/terms', '/privacy', '/complete-profile']) {
    assert.equal(isDarkCapablePath(p), true, p);
  }
  for (const p of ['/dashboards', '/unknown']) {
    assert.equal(isDarkCapablePath(p), false, p);
  }
});

test('resolveDark honours mode, system preference, route and feature flag', () => {
  const base = { pathname: '/dashboard', enabled: true };
  assert.equal(resolveDark({ ...base, mode: 'light', systemDark: true }), false);
  assert.equal(resolveDark({ ...base, mode: 'dark', systemDark: false }), true);
  assert.equal(resolveDark({ ...base, mode: 'system', systemDark: true }), true);
  assert.equal(resolveDark({ ...base, mode: 'system', systemDark: false }), false);
  assert.equal(resolveDark({ ...base, mode: 'dark', systemDark: false, pathname: '/' }), true);
  assert.equal(resolveDark({ ...base, mode: 'dark', systemDark: false, enabled: false }), false);
});

test('pre-paint script resolves stored mode before React, including disabled and public routes', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  for (const enabled of [false, true]) {
    for (const pathname of ['/dashboard', '/admin/ai/models', '/', '/login', '/terms', '/dashboards']) {
      for (const mode of ['light', 'dark', 'system', null, 'invalid']) {
        for (const systemDark of [false, true]) {
          let applied = false;
          runInNewContext(script.replaceAll('%VITE_ENABLE_DARK_MODE%', String(enabled)), {
            localStorage: { getItem: (key: string) => key === 'aima-color-mode' ? mode : null },
            location: { pathname },
            matchMedia: () => ({ matches: systemDark }),
            document: { documentElement: { setAttribute() {}, classList: { add() { applied = true; } } } },
          });
          assert.equal(applied, resolveDark({
            mode: mode === 'dark' || mode === 'system' ? mode : 'light', systemDark, pathname, enabled,
          }), `${enabled} / ${pathname} / ${mode} / ${systemDark}`);
        }
      }
    }
  }
});

test('pre-paint script stays light when storage is unavailable', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  let applied = false;
  runInNewContext(script.replaceAll('%VITE_ENABLE_DARK_MODE%', 'true'), {
    localStorage: { getItem() { throw new Error('Storage blocked'); } },
    location: { pathname: '/dashboard' },
    matchMedia: () => ({ matches: true }),
    document: { documentElement: { setAttribute() {}, classList: { add() { applied = true; } } } },
  });
  assert.equal(applied, false);
});

test('dark secondary text and chart labels meet AA on all neutral working surfaces', () => {
  const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
  const dark = css.match(/:root\.dark\s*\{([\s\S]*?)\n\s*\}/)?.[1];
  assert.ok(dark);
  const tokens = Object.fromEntries([...dark.matchAll(/(--c-[\w-]+):\s*(#[a-f\d]{6})/g)].map((m) => [m[1], m[2]]));
  const luminance = (hex: string) => [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  for (const text of ['text-faint', 'ink-350', 'text-muted', 'text-secondary', 'text', 'text-strong', 'chart-axis', 'toast-title', 'violet-light', 'gray']) {
    for (const surface of ['bg', 'surface', 'surface-subtle', 'surface-muted', 'surface-alt']) {
      const a = luminance(tokens[`--c-${text}`]);
      const b = luminance(tokens[`--c-${surface}`]);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      assert.ok(ratio >= 4.5, `${text} on ${surface}: ${ratio.toFixed(2)}:1`);
    }
  }
});
