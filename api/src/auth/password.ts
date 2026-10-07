import { hash, verify } from '@node-rs/argon2';

/**
 * argon2id (§10) with OWASP-recommended parameters: 19 MiB, 2 passes, 1 lane.
 * Algorithm 2 = argon2id in @node-rs/argon2.
 */
const OPTIONS = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

// Verified against when the email doesn't exist, so a wrong email takes as long
// as a wrong password (no timing hint about which accounts exist).
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('laibu-timing-equaliser-not-a-real-password');
  await verifyPassword(await dummyHash, password);
}

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

const COMMON = new Set([
  'password', 'password1', 'password123', '1234567890', '12345678910', 'qwertyuiop', 'iloveyou12',
  'qwerty1234', 'abcdefghij', 'kenya12345', 'nairobi123', 'mpesa12345', 'laibu12345', 'welcome123',
  'letmein123', 'admin12345', 'football12', 'sunshine12', 'princess12', '0000000000', '1111111111',
  'passw0rd12', 'changeme12', 'asdfghjkl1', 'zxcvbnm123',
]);

/**
 * Length-first policy (NIST 800-63B): no forced symbols, but at least 10
 * characters, not a well-known password and not built from the user's own
 * name or email. Returns a message the user can act on, or null if fine.
 */
export function passwordProblem(password: string, ctx: { email?: string; fullName?: string } = {}): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return 'This password is too common. Try a short phrase you can remember.';
  const emailName = ctx.email?.split('@')[0]?.toLowerCase();
  if (emailName && emailName.length >= 4 && lower.includes(emailName)) return "Don't use your email address in your password.";
  const nameParts = (ctx.fullName ?? '').toLowerCase().split(/\s+/).filter((p) => p.length >= 4);
  if (nameParts.some((p) => lower.includes(p))) return "Don't use your name in your password.";
  return null;
}
