// Timezone-safe local-date ISO formatter.
// IMPORTANT: never use `date.toISOString()` for local calendar dates -
// it converts to UTC first, which shifts the date by a day for any
// timezone ahead of UTC (e.g. Athens, UTC+2/+3) around local midnight.
export function toIsoLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// periods: 'this_month' | '3m' | '6m' | '12m' | 'ytd' | 'year' | 'all' | 'range'
export function periodRange(state) {
  const now = new Date();

  if (state.period === 'this_month') {
    const base = new Date(now.getFullYear(), now.getMonth() + (state.monthOffset || 0), 1);
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return {
      start: toIsoLocal(start),
      end: toIsoLocal(end),
      label: base.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    };
  }

  if (state.period === '3m' || state.period === '6m' || state.period === '12m') {
    const n = { '3m': 3, '6m': 6, '12m': 12 }[state.period];
    const s = new Date(now.getFullYear(), now.getMonth() - n + 1, 1);
    return {
      start: toIsoLocal(s),
      end: toIsoLocal(now),
      label: `Last ${n} months (through ${MONTH_NAMES[now.getMonth()]})`,
    };
  }

  if (state.period === 'ytd') {
    const s = new Date(now.getFullYear(), 0, 1);
    return { start: toIsoLocal(s), end: toIsoLocal(now), label: `Year to date ${now.getFullYear()}` };
  }

  if (state.period === 'year') {
    const y = state.yearSelect || now.getFullYear();
    const yStart = new Date(y, 0, 1);
    const yEnd = y === now.getFullYear() ? now : new Date(y, 11, 31);
    return { start: toIsoLocal(yStart), end: toIsoLocal(yEnd), label: String(y) + (y === now.getFullYear() ? ' (to date)' : '') };
  }

  if (state.period === 'all') {
    return { start: '1970-01-01', end: toIsoLocal(now), label: 'All time' };
  }

  if (state.period === 'range') {
    // Day-level custom range, per spec - not month granularity.
    const s = state.rangeStart ? new Date(state.rangeStart) : now;
    const e = state.rangeEnd ? new Date(state.rangeEnd) : now;
    return {
      start: toIsoLocal(s),
      end: toIsoLocal(e),
      label: `${toIsoLocal(s)} \u2013 ${toIsoLocal(e)}`,
    };
  }

  // fallback: this month
  const s = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: toIsoLocal(s), end: toIsoLocal(now), label: 'This month' };
}

// Split a [start,end] range into calendar-month buckets, e.g. for
// per-month budget resolution across multi-month views.
export function monthBuckets(start, end) {
  const buckets = [];
  const s = new Date(start);
  const e = new Date(end);
  let cursor = new Date(s.getFullYear(), s.getMonth(), 1);
  const last = new Date(e.getFullYear(), e.getMonth(), 1);
  while (cursor <= last) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    buckets.push({
      start: toIsoLocal(monthStart < s ? s : monthStart),
      end: toIsoLocal(monthEnd > e ? e : monthEnd),
      label: `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`,
      year: cursor.getFullYear(),
      month: cursor.getMonth(),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return buckets;
}
