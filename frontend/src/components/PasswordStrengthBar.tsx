import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, KeyRound } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { strengthLevel, passwordChecks, generateStrongPassword } from '../validations/password';

const LABEL_KEY = { weak: 'pwWeak', fair: 'pwFair', strong: 'pwStrong' } as const;

type CheckItem = { key: keyof ReturnType<typeof passwordChecks>; label: string };

/**
 * Thanh đo độ mạnh mật khẩu + checklist 5 tiêu chí realtime + gợi ý mật khẩu inline.
 *
 * - Khi focused + chưa nhập: hiện suggestion dạng pill để click tự fill
 * - Khi bắt đầu nhập: checklist từ từ hiện ra (staggered slide-in)
 * - Không còn hint text dài — checklist đã thay thế
 */
export default function PasswordStrengthBar({
  password,
  focused,
  onGenerate,
  style,
}: {
  password: string;
  focused?: boolean;
  onGenerate?: (pw: string) => void;
  style?: CSSProperties;
}) {
  const { t } = useApp();
  const { level, color, pct } = strengthLevel(password);
  const checks = passwordChecks(password);
  const [copied, setCopied] = useState(false);

  // Pre-generate a suggestion — stable until user clicks or component remounts.
  const [suggestedPw, setSuggestedPw] = useState(() => generateStrongPassword());

  // Track whether checklist has ever been shown (for entrance animation).
  const [checklistVisible, setChecklistVisible] = useState(!!password);
  const prevHadPassword = useRef(!!password);

  useEffect(() => {
    if (password && !prevHadPassword.current) {
      // First keystroke — trigger entrance.
      setChecklistVisible(true);
    }
    prevHadPassword.current = !!password;
  }, [password]);

  const items: CheckItem[] = [
    { key: 'hasLength', label: t.pwCheck8 },
    { key: 'hasUpper', label: t.pwCheckUpper },
    { key: 'hasLower', label: t.pwCheckLower },
    { key: 'hasDigit', label: t.pwCheckDigit },
    { key: 'hasSpecial', label: t.pwCheckSpecial },
  ];

  const handleSuggest = () => {
    const pw = suggestedPw;
    onGenerate?.(pw);
    navigator.clipboard?.writeText(pw).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Show suggestion when focused, password is empty, and onGenerate is available.
  const showSuggestion = focused && !password && onGenerate;

  return (
    <div style={{ margin: '9px 0 2px', ...style }}>
      {/* Progress bar */}
      <div style={{ height: 5, borderRadius: 4, background: '#eceaf4', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: password ? `${pct}%` : '0%',
            background: color,
            transition: 'width .25s, background .25s',
          }}
        />
      </div>

      {/* Strength label — only when typing */}
      {password && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 5 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color }}>{t[LABEL_KEY[level]]}</span>
        </div>
      )}

      {/* Suggestion pill — appears when focused and empty */}
      {showSuggestion && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); handleSuggest(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            marginTop: 8,
            padding: '10px 12px',
            background: '#f6f3fc',
            border: '1.5px dashed #d8cdf2',
            borderRadius: 10,
            cursor: 'pointer',
            transition: 'background .15s, border-color .15s',
            animation: 'pw-suggest-enter .2s ease-out',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#ede8f9';
            e.currentTarget.style.borderColor = '#b79df0';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f6f3fc';
            e.currentTarget.style.borderColor = '#d8cdf2';
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: 'linear-gradient(135deg,#8b5cf6,#d946ef)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            <KeyRound size={13} color="#fff" strokeWidth={2.2} />
          </span>
          <span style={{ flex: 1, textAlign: 'left' }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#3f3a55', display: 'block', lineHeight: 1.3 }}>
              {copied ? t.pwCopied : t.pwSuggest}
            </span>
            <span
              style={{
                fontSize: 12,
                fontFamily: "'Roboto Mono', 'Consolas', monospace",
                color: '#8b5cf6',
                letterSpacing: '.03em',
                fontWeight: 600,
              }}
            >
              {suggestedPw}
            </span>
          </span>
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSuggestedPw(generateStrongPassword());
            }}
            style={{
              background: '#ede8f9', border: 'none', borderRadius: 8, padding: 6,
              color: '#8b5cf6', cursor: 'pointer', display: 'flex', transition: 'background .15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#e3dcf6'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#ede8f9'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </div>
        </button>
      )}

      {/* Checklist grid — 2 columns, staggered entrance */}
      {checklistVisible && password && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px 16px',
            marginTop: 8,
          }}
        >
          {items.map((item, idx) => {
            const met = checks[item.key];
            return (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: met ? '#16a34a' : '#a39bbf',
                  transition: 'color .2s',
                  animation: `pw-check-enter .25s ease-out ${idx * 0.06}s both`,
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: met ? '#16a34a' : '#eceaf4',
                    transition: 'background .2s',
                    flex: 'none',
                  }}
                >
                  <Check
                    size={11}
                    color={met ? '#fff' : '#c5c0d4'}
                    strokeWidth={2.8}
                  />
                </span>
                {item.label}
              </div>
            );
          })}
        </div>
      )}

      {/* Keyframes */}
      <style>{`
        @keyframes pw-check-enter {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pw-suggest-enter {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes pw-check-enter {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes pw-suggest-enter {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
        }
      `}</style>
    </div>
  );
}
