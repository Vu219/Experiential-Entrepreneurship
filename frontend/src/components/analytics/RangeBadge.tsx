import { memo } from 'react';
import { formatRangeLabel, formatRangeShort } from './dateRange';

/**
 * Badge khoảng ngày ở góc trên phải mỗi card lớn (chart, nền tảng, loại nội dung, heatmap).
 *
 * CỐ Ý KHÔNG bấm được: trang chỉ có MỘT nguồn bộ lọc, nên một dropdown đặt trên card sẽ làm cả ba
 * card còn lại nhảy theo — người dùng đọc ra là lỗi. Badge chỉ trả lời "số này thuộc khoảng nào",
 * còn muốn đổi khoảng thì dùng thanh công cụ đầu trang.
 */
function RangeBadge({ from, to }: { from: string; to: string }) {
  return (
    <span
      title={formatRangeLabel(from, to)}
      style={{
        flex: 'none', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
        border: '1px solid #f1eef8', background: '#fbfaff', borderRadius: 999,
        padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#a59fbb',
      }}
    >
      {formatRangeShort(from, to)}
    </span>
  );
}

export default memo(RangeBadge);
