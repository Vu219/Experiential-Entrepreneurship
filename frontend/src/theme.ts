import type { ThemeDef, ThemeKey, Platform } from './types';

// Palette intentionally softened a touch so the vibrant AIMA logo stands out
// against a calmer UI (see also page backgrounds in index.css).
export const THEMES: Record<ThemeKey, ThemeDef> = {
  aurora: {
    brand: 'linear-gradient(120deg,#46D6EC 0%,#897CE3 46%,#F083C0 100%)',
    soft: 'linear-gradient(135deg,#edf9ff,#f6effc)',
  },
  sunset: {
    brand: 'linear-gradient(120deg,#FB8DA0 0%,#B47CEE 52%,#7E86F1 100%)',
    soft: 'linear-gradient(135deg,#fff0f4,#f4effc)',
  },
  ocean: {
    brand: 'linear-gradient(120deg,#5BD8EC 0%,#6AA1F2 52%,#7E86F1 100%)',
    soft: 'linear-gradient(135deg,#edf9ff,#eef3ff)',
  },
};

// Platform brand colors — MVP scope: Facebook → Instagram → Threads (see CLAUDE.md).
export const PLATFORM_BG: Record<string, string> = {
  FB: '#1877f2',
  IG: 'linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)',
  TH: '#000000',
};

export const PLATFORMS: Platform[] = [
  { name: 'Facebook', tag: 'FB', bg: PLATFORM_BG.FB },
  { name: 'Instagram', tag: 'IG', bg: PLATFORM_BG.IG },
  { name: 'Threads', tag: 'TH', bg: PLATFORM_BG.TH },
];

export const tagOf = (name: string): string =>
  ({
    Facebook: 'FB',
    Instagram: 'IG',
    Threads: 'TH',
  }[name] ?? name.slice(0, 2).toUpperCase());
