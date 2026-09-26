import type { L10n, LandingContent, LandingLink, LandingSectionKey } from '../api/landing';
import { validEmail } from './authValidation';

// Kiểm tra nội dung Landing trước khi lưu nháp — ĐỒNG BỘ với backend dto/landing/LandingContent.java
// (backend vẫn validate lại, trả 2101 nếu lọt). Trả về tập đường dẫn ô lỗi, vd "faq.items.2.answer.en",
// để form tô đỏ đúng ô; đường dẫn danh sách (vd "faq.items") = sai số lượng phần tử.

/** Link nội bộ ("/pricing", "/#features"), http(s):// hoặc mailto:. */
export const LANDING_HREF = /^(\/\S*|https?:\/\/\S+|mailto:[^\s@]+@[^\s@]+)$/;
export const HTTP_URL = /^https?:\/\/\S+$/;
export const TEXT_MAX = 600;

/** [tối thiểu, tối đa] phần tử của từng danh sách. */
export const LIST_LIMITS = {
  stats: [1, 4],
  featureItems: [1, 12],
  steps: [1, 6],
  platforms: [1, 12],
  checks: [0, 3],
  faqItems: [1, 20],
  socials: [0, 8],
  columns: [1, 4],
  links: [0, 10],
} as const satisfies Record<string, readonly [number, number]>;

type Errors = Set<string>;

const blank = (s: string | null | undefined) => !s || !s.trim();

function text(e: Errors, path: string, v: L10n | undefined) {
  if (blank(v?.vi) || (v?.vi.length ?? 0) > TEXT_MAX) e.add(`${path}.vi`);
  if (blank(v?.en) || (v?.en.length ?? 0) > TEXT_MAX) e.add(`${path}.en`);
}

function link(e: Errors, path: string, v: LandingLink, hrefOptional = false) {
  text(e, `${path}.label`, v.label);
  const href = v.href.trim();
  if (hrefOptional ? href !== '' && !LANDING_HREF.test(href) : !LANDING_HREF.test(href)) e.add(`${path}.href`);
}

function count(e: Errors, path: string, list: unknown[], [min, max]: readonly [number, number]) {
  if (list.length < min || list.length > max) e.add(path);
}

export function validateLandingSection<K extends LandingSectionKey>(key: K, content: LandingContent[K]): Errors {
  const e: Errors = new Set();
  const c = content as LandingContent[LandingSectionKey];
  switch (key) {
    case 'hero': {
      const h = c as LandingContent['hero'];
      text(e, 'badge', h.badge);
      text(e, 'titleLine1', h.titleLine1);
      text(e, 'titleHighlight', h.titleHighlight);
      text(e, 'subtitle', h.subtitle);
      link(e, 'primaryCta', h.primaryCta);
      link(e, 'secondaryCta', h.secondaryCta);
      count(e, 'stats', h.stats, LIST_LIMITS.stats);
      h.stats.forEach((s, i) => {
        if (!Number.isFinite(s.value) || s.value < 0) e.add(`stats.${i}.value`);
        if (s.suffix.length > 6) e.add(`stats.${i}.suffix`);
        text(e, `stats.${i}.label`, s.label);
      });
      break;
    }
    case 'features': {
      const f = c as LandingContent['features'];
      text(e, 'title', f.title);
      text(e, 'subtitle', f.subtitle);
      count(e, 'items', f.items, LIST_LIMITS.featureItems);
      f.items.forEach((it, i) => {
        if (blank(it.icon)) e.add(`items.${i}.icon`);
        text(e, `items.${i}.title`, it.title);
        text(e, `items.${i}.description`, it.description);
      });
      break;
    }
    case 'how_it_works': {
      const h = c as LandingContent['how_it_works'];
      text(e, 'title', h.title);
      text(e, 'subtitle', h.subtitle);
      count(e, 'steps', h.steps, LIST_LIMITS.steps);
      h.steps.forEach((s, i) => {
        text(e, `steps.${i}.title`, s.title);
        text(e, `steps.${i}.description`, s.description);
      });
      break;
    }
    case 'integrations': {
      const g = c as LandingContent['integrations'];
      text(e, 'title', g.title);
      count(e, 'platforms', g.platforms, LIST_LIMITS.platforms);
      g.platforms.forEach((p, i) => {
        if (blank(p.name) || p.name.length > 40) e.add(`platforms.${i}.name`);
        const logo = (p.logoUrl ?? '').trim();
        if (logo && !HTTP_URL.test(logo)) e.add(`platforms.${i}.logoUrl`);
        if (!logo && blank(p.icon)) e.add(`platforms.${i}.logoUrl`);
      });
      break;
    }
    case 'cta': {
      const a = c as LandingContent['cta'];
      text(e, 'badge', a.badge);
      text(e, 'title', a.title);
      text(e, 'subtitle', a.subtitle);
      link(e, 'primaryCta', a.primaryCta);
      link(e, 'secondaryCta', a.secondaryCta);
      count(e, 'checks', a.checks, LIST_LIMITS.checks);
      a.checks.forEach((ch, i) => text(e, `checks.${i}`, ch));
      break;
    }
    case 'faq': {
      const q = c as LandingContent['faq'];
      text(e, 'title', q.title);
      text(e, 'subtitle', q.subtitle);
      count(e, 'items', q.items, LIST_LIMITS.faqItems);
      q.items.forEach((it, i) => {
        text(e, `items.${i}.question`, it.question);
        text(e, `items.${i}.answer`, it.answer);
      });
      break;
    }
    case 'footer': {
      const f = c as LandingContent['footer'];
      text(e, 'description', f.description);
      if (!validEmail(f.email.trim())) e.add('email');
      count(e, 'socials', f.socials, LIST_LIMITS.socials);
      f.socials.forEach((s, i) => {
        if (!HTTP_URL.test(s.url.trim())) e.add(`socials.${i}.url`);
      });
      count(e, 'columns', f.columns, LIST_LIMITS.columns);
      f.columns.forEach((col, ci) => {
        text(e, `columns.${ci}.title`, col.title);
        count(e, `columns.${ci}.links`, col.links, LIST_LIMITS.links);
        col.links.forEach((ln, li) => link(e, `columns.${ci}.links.${li}`, ln, true));
      });
      if (f.newsletterText.vi.length > TEXT_MAX) e.add('newsletterText.vi');
      if (f.newsletterText.en.length > TEXT_MAX) e.add('newsletterText.en');
      break;
    }
  }
  return e;
}
