import { isPayday, nthThursday, paydayWindowEnd, upcomingPaydays } from './payday.js';

// October 2026: Thursdays are 1, 8, 15, 22, 29 → paydays 8th and 22nd.
const eat = (iso: string) => new Date(`${iso}+03:00`);

describe('payday calendar', () => {
  it('finds the nth Thursday', () => {
    expect(nthThursday(2026, 10, 1)).toBe(1);
    expect(nthThursday(2026, 10, 2)).toBe(8);
    expect(nthThursday(2026, 10, 4)).toBe(22);
    expect(nthThursday(2026, 11, 2)).toBe(12); // Nov 2026 starts on a Sunday
  });

  it('fires on BOTH the 2nd and 4th Thursday (the doc sample missed the 4th)', () => {
    expect(isPayday(eat('2026-10-08T00:05:00'))).toBe(true);
    expect(isPayday(eat('2026-10-22T00:05:00'))).toBe(true);
  });

  it('does not fire on other Thursdays', () => {
    expect(isPayday(eat('2026-10-01T00:05:00'))).toBe(false);
    expect(isPayday(eat('2026-10-15T00:05:00'))).toBe(false);
    expect(isPayday(eat('2026-10-29T00:05:00'))).toBe(false);
  });

  it('uses Nairobi time: 00:05 EAT Thursday is still Wednesday in UTC', () => {
    const instant = eat('2026-10-08T00:05:00');
    expect(instant.getUTCDay()).toBe(3); // the doc's UTC getters see Wednesday
    expect(isPayday(instant)).toBe(true);
    expect(isPayday(eat('2026-10-07T23:59:00'))).toBe(false);
  });

  it('ends the earning window at Thursday 00:00 EAT (exclusive)', () => {
    expect(paydayWindowEnd({ year: 2026, month: 10, day: 8 }).toISOString()).toBe('2026-10-07T21:00:00.000Z');
  });

  it('lists upcoming paydays across month and year ends', () => {
    expect(upcomingPaydays(eat('2026-10-07T12:00:00'), 3)).toEqual([
      { year: 2026, month: 10, day: 8 },
      { year: 2026, month: 10, day: 22 },
      { year: 2026, month: 11, day: 12 },
    ]);
    expect(upcomingPaydays(eat('2026-12-25T12:00:00'), 1)).toEqual([{ year: 2027, month: 1, day: 14 }]);
  });
});
