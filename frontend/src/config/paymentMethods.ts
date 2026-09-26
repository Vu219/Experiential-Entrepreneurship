import { QrCode, type LucideIcon } from 'lucide-react';
import type { Dict } from '../i18n';
import { rememberPendingPayment, type Checkout, type PaymentMethodCode } from '../api/payments';

/**
 * Registry phương thức thanh toán của trang "Xem lại đơn hàng".
 *
 * <p>Backend quyết định phương thức nào đang BẬT (`CheckoutQuote.paymentMethods`); FE chỉ biết
 * cách HIỂN THỊ và BƯỚC TIẾP THEO sau khi tạo đơn. Thêm phương thức mới = thêm một giá trị enum
 * `PaymentMethod` ở backend + một mục ở đây — trang checkout không phải sửa.</p>
 */
export interface PaymentMethodDef {
  icon: LucideIcon;
  labelKey: keyof Dict;
  descKey: keyof Dict;
  /** Chạy ngay sau khi `POST /payments/checkout` trả đơn. */
  proceed: (order: Checkout) => void;
}

export const PAYMENT_METHODS: Record<PaymentMethodCode, PaymentMethodDef> = {
  PAYOS_VIETQR: {
    icon: QrCode,
    labelKey: 'coPmPayosLabel',
    descKey: 'coPmPayosDesc',
    proceed: (order) => {
      // Nhớ đơn TRƯỚC khi rời trang: /billing/return cần paymentId để gọi verify, và query
      // string payOS gắn vào return URL không có chữ ký nên không tin được.
      rememberPendingPayment(order.paymentId);
      window.location.assign(order.checkoutUrl);
    },
  },
};
