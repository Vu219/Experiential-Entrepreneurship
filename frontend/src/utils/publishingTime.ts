/** Publishing dates are absolute instants; calendar inputs are wall clocks in this IANA zone. */
let publishingTimezone = 'Asia/Ho_Chi_Minh';
export const getPublishingTimezone = () => publishingTimezone;
export function setPublishingTimezone(zone: string) {
  new Intl.DateTimeFormat('en', { timeZone: zone }).format(); // validate before accepting
  publishingTimezone = zone;
}

export function wallTime(instant: Date | string, zone = publishingTimezone): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

/** Offset-bearing value preserves the instant while existing calendar views slice its local date. */
export function zonedTimestamp(instant: string, zone = publishingTimezone): string {
  const local = wallTime(instant, zone);
  const offset = Math.round((Date.parse(`${local}Z`) - Date.parse(instant)) / 60_000);
  const absolute = Math.abs(offset);
  return `${local}${offset < 0 ? '-' : '+'}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

/** Reject missing/ambiguous DST wall times instead of silently moving the selected time. */
export function publishingInstant(input: string, zone = publishingTimezone): string {
  if (/(Z|[+-]\d{2}:\d{2})$/.test(input)) return new Date(input).toISOString();
  const local = input.length === 16 ? `${input}:00` : input;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(local)) throw new RangeError('Invalid publishing time');
  const naive = Date.parse(`${local}Z`);
  const candidates = new Set<number>();
  // Offsets on either side of a transition; no dependency on the browser timezone.
  for (const delta of [-36, 0, 36]) {
    const probe = naive + delta * 3_600_000;
    const offset = Date.parse(`${wallTime(new Date(probe), zone)}Z`) - probe;
    const candidate = naive - offset;
    if (wallTime(new Date(candidate), zone) === local) candidates.add(candidate);
  }
  if (candidates.size !== 1) throw new RangeError('Publishing time is missing or ambiguous in this timezone');
  return new Date([...candidates][0]).toISOString();
}

/** Calendar-only Date: fields represent workspace today, never use this as a publishing instant. */
export const publishingToday = () => new Date(`${wallTime(new Date()).slice(0, 10)}T12:00:00`);
