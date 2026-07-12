// ===== Shared domain types (design UI layer) =====

import type { LucideIcon } from 'lucide-react';

export type Lang = 'vi' | 'en';

export type ThemeKey = 'aurora' | 'sunset' | 'ocean';

export type Route =
  | 'landing'
  | 'pricing'
  | 'login'
  | 'register'
  | 'logout'
  | 'dashboard'
  | 'create'
  | 'createWizard'
  | 'calendar'
  | 'analytics'
  | 'trends'
  | 'brand'
  | 'profile'
  | 'settings'
  | 'admin'
  | 'adminUsers'
  | 'adminPosts'
  | 'adminSystem'
  | 'adminLogs'
  | 'adminApiVersions'
  | 'adminRevenue'
  | 'adminPlans';

/** A social platform short descriptor (background + 2-letter tag). */
export interface Platform {
  name: string;
  tag: string;
  bg: string;
}

export interface NavItem {
  key: Route;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

export interface AuthForm {
  name: string;
  email: string;
  password: string;
  confirm: string;
}

export type AuthErrors = Partial<Record<keyof AuthForm | 'agree' | 'submit', string>>;

export interface ProfileState {
  name: string;
  email: string;
  bio: string;
}

export interface BrandState {
  name: string;
  industry: string;
  slogan: string;
  audience: string;
  toneIdx: number[];
}

export interface StatCard {
  value: string;
  label: string;
  trend: string;
  icon: LucideIcon;
  bg: string;
  color: string;
  trendColor?: string;
  trendBg?: string;
}

export interface PostRow {
  title: string;
  platform: string;
  tag: string;
  bg: string;
  status: string;
  stColor: string;
  stBg: string;
  reach: string;
  date: string;
}

export interface IdeaCard {
  title: string;
  platform: string;
  tag: string;
  bg: string;
  score: string;
  fmt: string;
}

export interface UpcomingPost {
  time: string;
  date: string;
  title: string;
  platform: string;
  tag: string;
  bg: string;
}

export interface CalendarDay {
  day: number;
  muted: boolean;
  today: boolean;
  dots: string[];
}

export interface AdminUser {
  name: string;
  email: string;
  plan: string;
  planColor: string;
  planBg: string;
  status: string;
  stColor: string;
  stBg: string;
  posts: string;
  joined: string;
  initials: string;
}
