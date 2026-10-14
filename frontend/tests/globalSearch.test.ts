// Chạy: npm test — lõi ô tìm kiếm toàn cục (bỏ dấu, chấm điểm, tô sáng, lọc quyền, lịch sử theo user).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, normalizeWithMap, tokens } from '../src/search/normalize.ts';
import { matchItem, mergeRanges } from '../src/search/match.ts';
import { rankStatic, visibleItems, GROUP_LIMITS } from '../src/search/rank.ts';
import {
  HISTORY_LIMIT, addHistory, clearHistory, historyKey, readHistory, removeHistory, type KeyValueStorage,
} from '../src/search/history.ts';
import type { StaticSearchItem } from '../src/search/types.ts';
import type { Dict } from '../src/i18n.ts';

const highlight = (label: string, query: string) => {
  const m = matchItem(query, { label });
  return m ? m.ranges.map(([a, b]) => label.slice(a, b)) : null;
};

test('normalize: chữ thường, bỏ dấu tiếng Việt, đ → d, gộp khoảng trắng', () => {
  assert.equal(normalize('  Cài   ĐẶT  '), 'cai dat');
  assert.equal(normalize('Đăng xuất'), 'dang xuat');
  assert.equal(normalize('Hiệu quả nội dung'), 'hieu qua noi dung');
  assert.deepEqual(tokens('Lịch  đăng bài'), ['lich', 'dang', 'bai']);
});

test('normalizeWithMap: mỗi ký tự chuẩn hoá trỏ về đúng vị trí gốc (kể cả chuỗi NFD rời dấu)', () => {
  const nfc = normalizeWithMap('Đặt');
  assert.equal(nfc.text, 'dat');
  assert.deepEqual(nfc.map, [0, 1, 2]);
  const nfd = normalizeWithMap('éa'); // "é" viết rời dấu
  assert.equal(nfd.text, 'ea');
  assert.deepEqual(nfd.map, [0, 2]);
});

test('matchItem: gõ không dấu khớp nhãn có dấu và tô sáng đúng phần chữ gốc', () => {
  assert.deepEqual(highlight('Cài đặt', 'cai dat'), ['Cài đặt']);
  assert.deepEqual(highlight('Lịch đăng bài', 'dang'), ['đăng']);
  assert.deepEqual(highlight('Lịch đăng bài', 'bai lich'), ['Lịch', 'bài'], 'đủ các từ, thứ tự bất kỳ');
  assert.deepEqual(highlight('Cài đặt', 'cd'), ['C', 'đ'], 'chữ cái đầu');
  assert.equal(matchItem('xyz', { label: 'Cài đặt' }), null);
  assert.equal(matchItem('   ', { label: 'Cài đặt' }), null);
});

test('matchItem: đầu nhãn > đầu từ > giữa từ; từ đồng nghĩa và mô tả khớp yếu hơn nhãn', () => {
  const start = matchItem('lich', { label: 'Lịch đăng bài' })!.score;
  const word = matchItem('dang', { label: 'Lịch đăng bài' })!.score;
  const inner = matchItem('ang', { label: 'Lịch đăng bài' })!.score;
  assert.ok(start > word && word > inner);
  const keyword = matchItem('schedule', { label: 'Lịch đăng bài', keywords: ['schedule', 'calendar'] });
  assert.ok(keyword && keyword.score < inner && keyword.ranges.length === 0);
  const viaDesc = matchItem('cai dat ket noi', { label: 'Kết nối', desc: 'Cài đặt' });
  assert.ok(viaDesc && viaDesc.score < keyword.score);
  assert.deepEqual(viaDesc.ranges.map(([a, b]) => 'Kết nối'.slice(a, b)), ['Kết', 'nối']);
});

test('mergeRanges gộp vùng chồng/liền nhau', () => {
  assert.deepEqual(mergeRanges([[4, 6], [0, 2], [1, 3], [6, 8]]), [[0, 3], [4, 8]]);
});

const icon = (() => null) as unknown as StaticSearchItem['icon'];
const item = (id: string, group: StaticSearchItem['group'], label: string, extra: Partial<StaticSearchItem> = {}): StaticSearchItem => ({
  id, group, label: () => label, icon, areas: ['app'], target: { kind: 'route', route: 'dashboard' }, ...extra,
});
const t = {} as Dict;

test('visibleItems: lọc theo khu vực, vai trò và điều kiện available', () => {
  const items = [
    item('page:a', 'pages', 'App page'),
    item('page:admin', 'pages', 'Admin page', { areas: ['admin'], roles: ['ADMIN'] }),
    item('page:both', 'pages', 'Both', { areas: ['app', 'admin'] }),
    item('action:dark', 'actions', 'Dark', { areas: ['app', 'admin'], available: (c) => c.darkModeEnabled }),
  ];
  const ids = (role: 'USER' | 'ADMIN' | undefined, area: 'app' | 'admin', darkModeEnabled = false) =>
    visibleItems(items, { role, area, darkModeEnabled }).map((i) => i.id);
  assert.deepEqual(ids('USER', 'app'), ['page:a', 'page:both']);
  assert.deepEqual(ids('USER', 'admin'), ['page:both'], 'user thường không thấy mục ADMIN');
  assert.deepEqual(ids('ADMIN', 'admin', true), ['page:admin', 'page:both', 'action:dark']);
});

test('rankStatic: điểm cao trước và cắt theo giới hạn mỗi nhóm', () => {
  const many = Array.from({ length: GROUP_LIMITS.pages + 3 }, (_, i) => item(`page:${i}`, 'pages', `Trang lịch ${i}`));
  const ranked = rankStatic([item('action:x', 'actions', 'Mở lịch'), ...many, item('page:best', 'pages', 'Lịch đăng')], 'lich', t);
  assert.equal(ranked[0].item.id, 'page:best', 'nhãn ngắn khớp đầu nhãn đứng đầu');
  assert.equal(ranked.filter((r) => r.item.group === 'pages').length, GROUP_LIMITS.pages);
  assert.ok(ranked.some((r) => r.item.id === 'action:x'));
});

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

test('history: theo userId, mới nhất lên đầu, không trùng, tối đa 8', () => {
  const s = memoryStorage();
  for (let i = 0; i < HISTORY_LIMIT + 2; i++) addHistory(s, 'u1', { id: `page:${i}`, selectedAt: i });
  addHistory(s, 'u1', { id: 'page:5', selectedAt: 99 });
  const list = readHistory(s, 'u1');
  assert.equal(list.length, HISTORY_LIMIT);
  assert.equal(list[0].id, 'page:5');
  assert.equal(list.filter((e) => e.id === 'page:5').length, 1);
  assert.deepEqual(readHistory(s, 'u2'), [], 'user khác không thấy lịch sử của u1');
  assert.ok(s.data.has(historyKey('u1')));
});

test('history: mục dữ liệu giữ snapshot; xóa từng mục / xóa hết; dữ liệu hỏng → rỗng', () => {
  const s = memoryStorage();
  addHistory(s, 'u1', { id: 'content:42', selectedAt: 1, snapshot: { kind: 'content', refId: '42', title: 'Bài A', platform: 'FACEBOOK' } });
  addHistory(s, 'u1', { id: 'page:calendar', selectedAt: 2 });
  assert.equal(readHistory(s, 'u1')[1].snapshot?.title, 'Bài A');
  assert.deepEqual(removeHistory(s, 'u1', 'content:42').map((e) => e.id), ['page:calendar']);
  clearHistory(s, 'u1');
  assert.deepEqual(readHistory(s, 'u1'), []);
  s.setItem(historyKey('u1'), '{not json');
  assert.deepEqual(readHistory(s, 'u1'), []);
  s.setItem(historyKey('u1'), JSON.stringify([{ id: 'ok', selectedAt: 1 }, { id: 2 }, { id: 'bad', selectedAt: 1, snapshot: { kind: 'x' } }]));
  assert.deepEqual(readHistory(s, 'u1').map((e) => e.id), ['ok']);
});

test('matchItem: khớp gộp nhãn + từ khóa + mô tả chỉ nhận từ ở ĐẦU một từ (không khớp rác giữa từ)', () => {
  assert.equal(matchItem('da bo qua', { label: 'Bảng điều khiển', keywords: ['dashboard', 'tổng quan'] }), null);
  assert.ok(matchItem('da bo qua', { label: 'Đã bỏ qua' })!.score > 100);
  assert.ok(matchItem('ket noi cai', { label: 'Kết nối', desc: 'Cài đặt' }));
});
