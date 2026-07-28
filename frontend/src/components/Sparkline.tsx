import { useId, useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';

/**
 * Sparkline trần (không khung, không nhãn) — lấp đầy container cha, nên bọc nó trong một div đã
 * có kích thước. Dùng chung cho thẻ KPI trang Doanh thu (`SparklineCard`) và thẻ số liệu Bảng
 * điều khiển (`StatCard`); cần sparkline ở đâu thì đi qua đây, đừng dựng lại chart.
 */

/** Trên ~16 điểm thì khung sparkline quá hẹp, đường thành răng cưa → gộp trung bình theo nhóm. */
const MAX_POINTS = 16;

function downsample(values: number[]): number[] {
  if (values.length <= MAX_POINTS) return values;
  const groupSize = Math.ceil(values.length / MAX_POINTS);
  const out: number[] = [];
  for (let i = 0; i < values.length; i += groupSize) {
    const group = values.slice(i, i + groupSize);
    out.push(group.reduce((sum, v) => sum + v, 0) / group.length);
  }
  return out;
}

export default function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  // useId sinh chuỗi chứa dấu ':' — không hợp lệ trong url(#...) nên phải bỏ đi.
  // Mỗi sparkline một id riêng, nếu trùng thì mọi cái sẽ ăn chung gradient của cái render đầu tiên.
  const gradientId = `spark-${useId().replace(/:/g, '')}`;
  const data = useMemo(() => downsample(values).map((v) => ({ v })), [values]);

  // Một điểm không vẽ thành đường — để trống còn hơn hiện một vệt phẳng gây hiểu nhầm.
  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      {/* margin trên/dưới 2px để stroke 2px không bị cắt ở đỉnh/đáy chart. */}
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        {/* Thang y bám min–max của CHÍNH chuỗi này. Mặc định recharts lấy đáy = 0, nên chuỗi dao
            động quanh một mức cao (vd 900→1200) bị ép thành một vệt gần như phẳng dính đáy. */}
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={2}
          fill={`url(#${gradientId})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
