import { useApp } from '../../../context/AppContext';
import { Card } from '../../ui';
import { PAYMENT_METHODS } from '../../../config/paymentMethods';
import type { PaymentMethodCode } from '../../../api/payments';

/**
 * Khối "Phương thức thanh toán" — danh sách thẻ chọn một. Chỉ render phương thức backend báo
 * đang bật VÀ có trong registry `config/paymentMethods.ts` (mã lạ thì bỏ qua, không vỡ trang).
 */
export default function PaymentMethodList({
  methods,
  selected,
  onSelect,
  disabled,
}: {
  methods: PaymentMethodCode[];
  selected: PaymentMethodCode | null;
  onSelect: (code: PaymentMethodCode) => void;
  disabled: boolean;
}) {
  const { t, brandGradient } = useApp();
  const known = methods.filter((m) => PAYMENT_METHODS[m]);

  return (
    <Card>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8a85a0' }}>
        {t.coPaymentMethod}
      </p>
      {known.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: '#6b6680' }}>{t.coNoMethod}</p>
      ) : (
        <div role="radiogroup" aria-label={t.coPaymentMethod} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {known.map((code) => {
            const def = PAYMENT_METHODS[code];
            const Icon = def.icon;
            const active = code === selected;
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => onSelect(code)}
                className={disabled ? undefined : 'lift-card'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
                  padding: 16, borderRadius: 14, cursor: disabled ? 'not-allowed' : 'pointer',
                  background: '#fff',
                  border: active ? '2px solid #7c3aed' : '1px solid #ece7f6',
                  // Giữ chiều cao không đổi khi viền 1px ↔ 2px.
                  margin: active ? 0 : 1,
                }}
              >
                <span aria-hidden style={{ flex: 'none', width: 42, height: 42, borderRadius: 12, background: brandGradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={21} color="#fff" strokeWidth={1.8} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 14.5, color: '#1b1730' }}>{t[def.labelKey] as string}</span>
                  <span style={{ display: 'block', marginTop: 3, fontSize: 13, lineHeight: 1.5, color: '#6b6680' }}>{t[def.descKey] as string}</span>
                </span>
                <span
                  aria-hidden
                  style={{
                    flex: 'none', width: 20, height: 20, borderRadius: '50%',
                    border: active ? '6px solid #7c3aed' : '2px solid #d6cfe8', background: '#fff',
                  }}
                />
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
