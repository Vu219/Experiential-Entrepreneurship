import { useState } from 'react';
import { CheckCircle2, Star } from 'lucide-react';
import Modal from './Modal';
import { useApp } from '../context/AppContext';
import { useUiStore } from '../store/useUiStore';
import { submitFeedback } from '../api/feedback';
import { C } from '../styles/colors';

const MAX_COMMENT = 1000;

/**
 * Hộp thoại "Đánh giá & góp ý" (G1.3): 1–5 sao + nhận xét tuỳ chọn → POST /feedback.
 * Mở qua `useUiStore.setFeedbackOpen(true)` (menu avatar, sidebar); AppShell render khi cờ bật.
 */
export default function FeedbackModal() {
  const { t, brandGradient } = useApp();
  const close = () => useUiStore.getState().setFeedbackOpen(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const labels = [t.fbStar1, t.fbStar2, t.fbStar3, t.fbStar4, t.fbStar5];
  const shown = hover || rating;

  const send = async () => {
    if (!rating) {
      setError(t.fbPickRating);
      return;
    }
    setSending(true);
    setError('');
    try {
      await submitFeedback(rating, comment, window.location.pathname);
      setDone(true);
    } catch {
      setError(t.fbError);
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <Modal title={t.fbThanksTitle} onClose={close}>
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <CheckCircle2 size={44} color={C.success} strokeWidth={1.8} style={{ margin: '0 auto 12px' }} />
          <p style={{ margin: '0 0 18px', fontSize: 14, color: C.textMuted, lineHeight: 1.55 }}>{t.fbThanks}</p>
          <button onClick={close} style={{ border: 'none', borderRadius: 10, padding: '10px 22px', fontWeight: 700, fontSize: 13.5, color: C.onBrand, background: brandGradient, cursor: 'pointer' }}>
            {t.close}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={t.fbTitle} subtitle={t.fbSubtitle} onClose={close}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.textSecondary, marginBottom: 8 }}>{t.fbRatingLabel}</div>
      <div role="radiogroup" aria-label={t.fbRatingLabel} style={{ display: 'flex', alignItems: 'center', gap: 4 }} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} – ${labels[star - 1]}`}
            onClick={() => { setRating(star); setError(''); }}
            onMouseEnter={() => setHover(star)}
            style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', display: 'flex' }}
          >
            <Star size={30} strokeWidth={1.6} color={star <= shown ? C.warning : C.borderStrong} fill={star <= shown ? C.warning : 'none'} />
          </button>
        ))}
        <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 600, color: C.textMuted, minHeight: 18 }}>{shown ? labels[shown - 1] : ''}</span>
      </div>

      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: C.textSecondary, margin: '18px 0 8px' }} htmlFor="feedback-comment">
        {t.fbCommentLabel}
      </label>
      <textarea
        id="feedback-comment"
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
        placeholder={t.fbCommentPlaceholder}
        rows={4}
        style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 13.5, fontFamily: 'inherit', color: C.text, background: C.surface }}
      />
      <div style={{ textAlign: 'right', fontSize: 11.5, color: C.textFaint, marginTop: 4 }}>{comment.length}/{MAX_COMMENT}</div>

      {error && <div role="alert" style={{ fontSize: 13, color: C.danger, marginTop: 8 }}>{error}</div>}

      <button
        onClick={send}
        disabled={sending}
        style={{ width: '100%', marginTop: 16, border: 'none', borderRadius: 10, padding: 11, fontWeight: 700, fontSize: 14, color: C.onBrand, background: brandGradient, cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.7 : 1 }}
      >
        {sending ? t.fbSending : t.fbSubmit}
      </button>
    </Modal>
  );
}
