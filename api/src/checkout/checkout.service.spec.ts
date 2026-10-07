import { describe, expect, it, vi } from 'vitest';
import { CheckoutService } from './checkout.service.js';

describe('CheckoutService Kenyan phone normalization & orders', () => {
  const mockDb = {
    query: vi.fn(),
    transaction: vi.fn(),
  };

  const service = new CheckoutService(mockDb as any);

  it('normalizes 07... local formats to 2547... and extracts last 4 digits', () => {
    const res = service.normalizePhone('0712345678');
    expect(res.formatted).toBe('254712345678');
    expect(res.last4).toBe('5678');
  });

  it('normalizes +2547... and 2541... (Safaricom/Airtel) numbers correctly', () => {
    const res1 = service.normalizePhone('+254722000000');
    expect(res1.formatted).toBe('254722000000');
    expect(res1.last4).toBe('0000');

    const res2 = service.normalizePhone('0110123456');
    expect(res2.formatted).toBe('254110123456');
    expect(res2.last4).toBe('3456');
  });

  it('rejects invalid or non-Kenyan phone formats', () => {
    expect(() => service.normalizePhone('12345')).toThrow('Invalid Kenyan phone number');
    expect(() => service.normalizePhone('254999999999')).toThrow('Invalid Kenyan phone number');
  });
});
