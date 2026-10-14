import type { Range } from '../../search/match';
import { C } from '../../styles/colors';

/** Tô sáng các vùng khớp (chỉ số trên chuỗi gốc — search/match.ts). */
export default function HighlightText({ text, ranges }: { text: string; ranges?: readonly Range[] }) {
  if (!ranges || ranges.length === 0) return <>{text}</>;
  const parts: JSX.Element[] = [];
  let at = 0;
  ranges.forEach(([start, end], i) => {
    if (start > at) parts.push(<span key={`t${i}`}>{text.slice(at, start)}</span>);
    parts.push(
      <mark key={`m${i}`} style={{ background: 'transparent', color: C.primary, fontWeight: 800, padding: 0 }}>
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  });
  if (at < text.length) parts.push(<span key="rest">{text.slice(at)}</span>);
  return <>{parts}</>;
}
