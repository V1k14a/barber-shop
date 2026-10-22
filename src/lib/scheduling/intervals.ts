/**
 * Half-open time intervals [start, end) expressed as epoch milliseconds.
 * Half-open means a booking ending at 10:30 does not collide with one
 * starting at 10:30.
 */
export interface Interval {
  start: number;
  end: number;
}

export const MINUTE = 60_000;

/** Sorts, drops empty intervals and merges overlapping or touching ones. */
export function normalize(intervals: Interval[]): Interval[] {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const cur of sorted) {
    const last = out[out.length - 1];
    if (last && cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/** Returns the parts of `base` not covered by any interval in `cuts`. */
export function subtract(base: Interval[], cuts: Interval[]): Interval[] {
  const holes = normalize(cuts);
  const result: Interval[] = [];
  for (const b of normalize(base)) {
    let cursor = b.start;
    for (const h of holes) {
      if (h.end <= cursor) continue;
      if (h.start >= b.end) break;
      if (h.start > cursor) result.push({ start: cursor, end: h.start });
      cursor = Math.max(cursor, h.end);
      if (cursor >= b.end) break;
    }
    if (cursor < b.end) result.push({ start: cursor, end: b.end });
  }
  return result;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** True if `inner` lies completely inside one of the (normalized) `outer` intervals. */
export function isContained(inner: Interval, outer: Interval[]): boolean {
  return outer.some((o) => o.start <= inner.start && inner.end <= o.end);
}
