import { z } from 'zod';

/**
 * Every setting the API reads from the environment, validated once at boot.
 * A missing or malformed secret stops the server instead of running insecurely.
 */
const base64Key32 = z
  .string()
  .refine((v) => Buffer.from(v, 'base64').length === 32, {
    message: 'must be 32 random bytes, base64-encoded (openssl rand -base64 32)',
  });

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  // Payout logic depends on this (§11)
  TZ: z.literal('Africa/Nairobi'),

  DATABASE_URL: z.string().startsWith('postgres'),
  DATABASE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Browser origins allowed to call the API (public site + separate admin host)
  WEB_ORIGIN: z.url(),
  ADMIN_ORIGIN: z.url(),

  // AES-256-GCM key for payout account numbers / M-Pesa phones
  DATA_ENCRYPTION_KEY: base64Key32,

  // RS256 key pair for access tokens, base64-encoded PEM (npm run keys:generate)
  JWT_PRIVATE_KEY: z.string().min(100, 'run `npm run keys:generate` and paste the output into .env'),
  JWT_PUBLIC_KEY: z.string().min(100, 'run `npm run keys:generate` and paste the output into .env'),
  // Sprint 2+
  REDIS_URL: z.string().optional(),

  BRAND_NAME: z.string().default('Laibu'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
