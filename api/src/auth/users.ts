import type { Role } from '../common/auth/auth.types.js';

/** What the API ever reveals about a user to that user. Never the hash, counters or lock state. */
export interface PublicUser {
  id: string;
  role: Role;
  full_name: string;
  email: string;
  phone: string | null;
  room_unlocked: boolean;
  room_slug: string | null;
  created_at: Date;
}

export const PUBLIC_USER_COLUMNS = 'id, role, full_name, email, phone, room_unlocked, room_slug, created_at';

/** Collapses whitespace so "Wanjiru  Kamau " is stored as "Wanjiru Kamau". */
export function cleanName(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, ' ').trim();
}

export function cleanEmail(email: string): string {
  return email.normalize('NFC').trim().toLowerCase();
}

/**
 * Kenyan mobile numbers in any common form → 2547XXXXXXXX / 2541XXXXXXXX
 * (the format M-Pesa uses). Returns null if it isn't a valid Kenyan mobile.
 */
export function normaliseKenyanMobile(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, '').replace(/^\+/, '');
  let local: string | null = null;
  if (/^254[17]\d{8}$/.test(digits)) local = digits.slice(3);
  else if (/^0[17]\d{8}$/.test(digits)) local = digits.slice(1);
  else if (/^[17]\d{8}$/.test(digits)) local = digits;
  return local ? `254${local}` : null;
}
