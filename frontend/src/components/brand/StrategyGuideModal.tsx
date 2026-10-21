import { Compass, Layers, Calendar, Sparkles, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Modal from '../Modal';
import { C } from '../../styles/colors';

export default function StrategyGuideModal({
  onClose,
  onCreateNew,
}: {
  onClose: () => void;
  onCreateNew: () => void;
}) {
  const { lang, brandGradient } = useApp();
  const isEn = lang === 'en';

  const steps = [
    {
      icon: Compass,
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.12)',
      title: isEn ? '1. Define Strategic Pillars' : '1. Xây dựng trụ cột nội dung',
      desc: isEn
        ? 'Divide your core messages into 3–5 pillars (e.g. Industry Insights, Product Showcases, Behind the Scenes, Community Engagement).'
        : 'Phân chia thông điệp thành 3–5 nhóm chủ đề chính (ví dụ: Kiến thức chuyên môn, Giới thiệu sản phẩm, Câu chuyện thương hiệu, Tương tác cộng đồng).',
    },
    {
      icon: Calendar,
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      title: isEn ? '2. Platform Posting Cadence' : '2. Phân bổ tần suất đăng bài',
      desc: isEn
        ? 'Set weekly targets for Facebook, Instagram, and Threads to keep your brand actively recognized by platform algorithms.'
        : 'Thiết lập số bài đăng mục tiêu mỗi tuần trên từng kênh (Facebook, Instagram, Threads) để thuật toán phân phối tối ưu và đều đặn.',
    },
    {
      icon: Layers,
      color: '#8b5cf6',
      bg: 'rgba(139, 92, 246, 0.12)',
      title: isEn ? '3. Tone & Brand Voice' : '3. Giọng văn & Mục tiêu nhất quán',
      desc: isEn
        ? 'Align your strategic goals and audience expectations with your Brand Voice so every AI draft sounds authentic and confident.'
        : 'Định hình mục tiêu và giọng điệu (chuyên nghiệp, hài hước, thân thiện) để AI luôn tạo nội dung đồng nhất với tính cách thương hiệu.',
    },
    {
      icon: Sparkles,
      color: '#ec4899',
      bg: 'rgba(236, 72, 153, 0.12)',
      title: isEn ? '4. Automated AI Creation' : '4. Tự động hóa sáng tạo cùng AI',
      desc: isEn
        ? 'Activate your strategy to let AIMA automatically research matching trends, suggest outline drafts, and plan optimal schedule slots.'
        : 'Kích hoạt chiến lược ("Hoạt động") để AI tự động bám sát các trụ cột khi nghiên cứu xu hướng và tạo nội dung trong tab Tạo bài viết.',
    },
  ];

  return (
    <Modal
      title={isEn ? 'Content Strategy Guide' : 'Hướng dẫn xây dựng chiến lược nội dung'}
      subtitle={
        isEn
          ? 'How AIMA uses your strategy to create consistent, high-performing multi-platform content.'
          : 'Cách AIMA khai thác chiến lược để sáng tạo nội dung đa nền tảng đều đặn và hiệu quả.'
      }
      onClose={onClose}
      maxWidth={580}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {steps.map((st) => {
            const StepIcon = st.icon;
            return (
              <div
                key={st.title}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  padding: '12px 14px',
                  borderRadius: 14,
                  border: `1px solid ${C.border}`,
                  background: C.surfaceSubtle,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: st.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 'none',
                  }}
                >
                  <StepIcon size={19} color={st.color} strokeWidth={2} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.textStrong, marginBottom: 3 }}>
                    {st.title}
                  </div>
                  <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.55 }}>
                    {st.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-soft"
            style={{
              border: `1px solid ${C.border}`,
              background: C.surface,
              borderRadius: 11,
              padding: '10px 18px',
              fontSize: 13.5,
              fontWeight: 700,
              color: C.ink600,
              cursor: 'pointer',
            }}
          >
            {isEn ? 'Close' : 'Đóng'}
          </button>
          <button
            type="button"
            onClick={onCreateNew}
            className="btn-grad"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              border: 'none',
              borderRadius: 11,
              padding: '10px 20px',
              fontSize: 13.5,
              fontWeight: 700,
              color: C.onBrand,
              background: brandGradient,
              cursor: 'pointer',
              boxShadow: '0 10px 20px -8px rgba(139,92,246,0.6)',
            }}
          >
            {isEn ? 'Create Strategy Now' : 'Tạo chiến lược ngay'}
            <ArrowRight size={15} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
