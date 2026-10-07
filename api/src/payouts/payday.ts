/**
 * Payout calendar (§2.5, §7): paydays are the 2nd and 4th Thursday of every
 * month, in Africa/Nairobi time.
 *
 * Corrects two bugs in the §7 sample code:
 *  - its isPayday() compared against the 1st and 2nd Thursdays, so the 4th
 *    Thursday never fired;
 *  - it read the date with UTC getters, but the job runs at 00:05 EAT, which
 *    is 21:05 the previous day in UTC (still Wednesday), so no payday ever matched.
 * Kenya has no daylight saving, so EAT is always UTC+3.
 */
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

/** Calendar date in Nairobi for an instant. */
export function nairobiDate(instant: Date): CalendarDate {
  const shifted = new Date(instant.getTime() + EAT_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

/** Day of month of the nth (1-based) Thursday. */
export function nthThursday(year: number, month: number, n: number): number {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const firstThu = 1 + ((4 - firstDow + 7) % 7);
  return firstThu + (n - 1) * 7;
}

export function isPayday(instant: Date): boolean {
  const { year, month, day } = nairobiDate(instant);
  return day === nthThursday(year, month, 2) || day === nthThursday(year, month, 4);
}

/** The instant a Nairobi calendar date starts (00:00:00 EAT). */
export function startOfNairobiDay({ year, month, day }: CalendarDate): Date {
  return new Date(Date.UTC(year, month - 1, day) - EAT_OFFSET_MS);
}

/**
 * Earning window for a payday, half-open [start, end): sales up to the end
 * of Wednesday count, Thursday's sales roll into the next cycle. end is
 * Thursday 00:00 EAT; the doc's "Wednesday 23:59:59" is the same boundary,
 * but a half-open window can't drop a sale made in the final second.
 */
export function paydayWindowEnd(payday: CalendarDate): Date {
  return startOfNairobiDay(payday);
}

/** The next `count` paydays on or after the given instant's Nairobi date. */
export function upcomingPaydays(from: Date, count = 2): CalendarDate[] {
  const today = nairobiDate(from);
  const out: CalendarDate[] = [];
  let { year, month } = today;
  while (out.length < count) {
    for (const n of [2, 4]) {
      const day = nthThursday(year, month, n);
      const isFuture = year > today.year || month > today.month || day >= today.day;
      if (isFuture && out.length < count) out.push({ year, month, day });
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}
