import fs from 'node:fs';
const css = fs.readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');
const light = {}, dark = {};
for (const block of css.matchAll(/:root(\.dark)?\s*\{([^}]+)\}/g)) {
  for (const token of block[2].matchAll(/(--c-[\w-]+)\s*:\s*([^;]+);/g)) (block[1] ? dark : light)[token[1]] = token[2].trim();
}
const catalog = Object.fromEntries(Object.entries(light).map(([token, value]) => [token, { light: value, dark: dark[token] ?? value }]));
fs.writeFileSync(new URL('../../../docs/dark-mode-review/final/token-catalog.json', import.meta.url), JSON.stringify(catalog, null, 2));
const mapFile = new URL('../../../docs/dark-mode-color-map.md', import.meta.url);
let map = fs.readFileSync(mapFile, 'utf8');
map = map.replace(/(\| `(--c-[\w-]+)` \| `[^`]+` \| )`[^`]+`/g, (row, prefix, token) => catalog[token] ? `${prefix}\`${catalog[token].dark}\`` : row);
if (!map.includes('final/token-catalog.json')) map += '\n## Catalog hiện tại (2026-10-05)\n\nGiá trị sáng/tối thực tế, gồm các alias giữ chính xác màu sáng và token Landing, ở\n[final/token-catalog.json](dark-mode-review/final/token-catalog.json). Catalog được sinh từ tất cả\nkhối `:root`/`:root.dark` bằng `frontend/scripts/dark-mode/token-catalog.mjs`.\nCác số lần dùng ở bảng cũ là thống kê trước migration; giá trị tối đã đồng bộ với CSS hiện tại.\n';
fs.writeFileSync(mapFile, map);
console.log(Object.keys(catalog).length, 'tokens catalogued');
