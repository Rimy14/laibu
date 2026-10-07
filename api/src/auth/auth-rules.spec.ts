import { hashPassword, passwordProblem, verifyPassword } from './password.js';
import { cleanEmail, cleanName, normaliseKenyanMobile } from './users.js';

describe('password policy', () => {
  it('accepts a long passphrase', () => {
    expect(passwordProblem('green mango season', { email: 'w@x.ke', fullName: 'Wanjiru Kamau' })).toBeNull();
  });
  it('rejects short, common, repeated, and personal passwords', () => {
    expect(passwordProblem('short1')).toMatch(/at least 10/);
    expect(passwordProblem('password123')).toMatch(/too common/);
    expect(passwordProblem('aaaaaaaaaaaa')).toMatch(/too common/);
    expect(passwordProblem('wanjiru2026!!', { email: 'wanjiru@x.ke' })).toMatch(/email/);
    expect(passwordProblem('kamau-rocks-2026', { fullName: 'Wanjiru Kamau' })).toMatch(/name/);
  });
});

describe('argon2id hashing', () => {
  it('hashes with argon2id and verifies', async () => {
    const h = await hashPassword('green mango season');
    expect(h.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(h, 'green mango season')).toBe(true);
    expect(await verifyPassword(h, 'green mango seasoN')).toBe(false);
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false);
  });
});

describe('input normalisation', () => {
  it('normalises Kenyan mobiles to 254 format', () => {
    for (const v of ['0712345678', '0712 345 678', '+254712345678', '254712345678', '712345678']) {
      expect(normaliseKenyanMobile(v)).toBe('254712345678');
    }
    expect(normaliseKenyanMobile('0110123456')).toBe('254110123456');
    expect(normaliseKenyanMobile('0812345678')).toBeNull();
    expect(normaliseKenyanMobile('07123')).toBeNull();
  });
  it('cleans names and emails', () => {
    expect(cleanName('  Wanjiru   Kamau ')).toBe('Wanjiru Kamau');
    expect(cleanEmail(' W@X.KE ')).toBe('w@x.ke');
  });
});
