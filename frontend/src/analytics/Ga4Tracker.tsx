import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initGa4, trackPageView } from './ga4';

/** Gắn một lần ở App: gửi page_view mỗi lần đổi route (chỉ pathname). Không render gì. */
export default function Ga4Tracker() {
  const { pathname } = useLocation();
  useEffect(() => { initGa4(); }, []);
  useEffect(() => { trackPageView(pathname); }, [pathname]);
  return null;
}
