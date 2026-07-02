import { Fragment } from 'react';
import { DatabaseZap, SlidersHorizontal, Lightbulb, BookmarkCheck, ArrowRight, ArrowDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { Card, Icon } from '../ui';

const STEP_ICONS = [DatabaseZap, SlidersHorizontal, Lightbulb, BookmarkCheck];
const STEP_TINTS = [
  { bg: 'linear-gradient(135deg,#e7f6ff,#eef2ff)', color: '#3b82f6' },
  { bg: 'linear-gradient(135deg,#f1e9ff,#e9f0ff)', color: '#8b5cf6' },
  { bg: 'linear-gradient(135deg,#fff3e0,#ffe9f3)', color: '#f59e0b' },
  { bg: 'linear-gradient(135deg,#e7fff4,#e9f7ff)', color: '#10b981' },
];
const LINE = '#e3daf5';

/**
 * Section "Cách hoạt động" — 4 bước tuần tự của agent research, nối bằng connector
 * mũi tên (ngang trên desktop/tablet, dọc khi mobile xếp 1 cột).
 */
export default function HowItWorks() {
  const { t } = useApp();
  const { isMobile } = useBreakpoint();
  const steps = [
    [t.trHow1T, t.trHow1D],
    [t.trHow2T, t.trHow2D],
    [t.trHow3T, t.trHow3D],
    [t.trHow4T, t.trHow4D],
  ];

  return (
    <Card>
      <div style={{ fontWeight: 700, fontSize: 16, color: '#211c38', marginBottom: 18 }}>{t.trHowTitle}</div>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'stretch' }}>
        {steps.map(([title, desc], i) => (
          <Fragment key={i}>
            <div style={{ flex: isMobile ? 'none' : 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, background: STEP_TINTS[i].bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon icon={STEP_ICONS[i]} size={19} stroke={STEP_TINTS[i].color} />
                </div>
                <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 15, color: '#d9cef0' }}>0{i + 1}</span>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#2b2543' }}>{title}</div>
              <div style={{ fontSize: 12.5, color: '#6b6680', lineHeight: 1.55 }}>{desc}</div>
            </div>
            {i < steps.length - 1 &&
              (isMobile ? (
                // Connector dọc: căn theo trục icon (40px) bên trái
                <div aria-hidden style={{ width: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 0' }}>
                  <span style={{ width: 0, height: 14, borderLeft: `2px dashed ${LINE}` }} />
                  <Icon icon={ArrowDown} size={14} stroke="#b9a8e6" />
                </div>
              ) : (
                // Connector ngang: căn giữa hàng icon (cao 40px) của mỗi bước
                <div aria-hidden style={{ flex: 'none', width: 38, height: 40, display: 'flex', alignItems: 'center', padding: '0 5px' }}>
                  <span style={{ flex: 1, borderTop: `2px dashed ${LINE}` }} />
                  <Icon icon={ArrowRight} size={14} stroke="#b9a8e6" />
                </div>
              ))}
          </Fragment>
        ))}
      </div>
    </Card>
  );
}
