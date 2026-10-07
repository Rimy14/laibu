import { randomBytes } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { FieldEncryptionService } from './field-encryption.service.js';

function makeService() {
  const key = randomBytes(32).toString('base64');
  const config = { get: () => key } as unknown as ConfigService<never, true>;
  return new FieldEncryptionService(config as never);
}

describe('FieldEncryptionService', () => {
  const svc = makeService();

  it('round-trips a value', () => {
    const blob = svc.encrypt('0712345678', 'user-1');
    expect(svc.decrypt(blob, 'user-1')).toBe('0712345678');
  });

  it('never stores plaintext and uses a fresh IV each time', () => {
    const a = svc.encrypt('0712345678', 'user-1');
    const b = svc.encrypt('0712345678', 'user-1');
    expect(a.toString('utf8')).not.toContain('0712345678');
    expect(a.equals(b)).toBe(false);
  });

  it('refuses a ciphertext moved to another user (AAD binding)', () => {
    const blob = svc.encrypt('0712345678', 'user-1');
    expect(() => svc.decrypt(blob, 'user-2')).toThrow();
  });

  it('refuses tampered ciphertext', () => {
    const blob = svc.encrypt('0712345678', 'user-1');
    blob[blob.length - 1] ^= 0xff;
    expect(() => svc.decrypt(blob, 'user-1')).toThrow();
  });

  it('refuses a different key', () => {
    const blob = svc.encrypt('0712345678', 'user-1');
    expect(() => makeService().decrypt(blob, 'user-1')).toThrow();
  });

  it('formats last4', () => {
    expect(FieldEncryptionService.last4('+254 712 345 678')).toBe('5678');
  });
});
