/**
 * Generates the RS256 key pair for access tokens and a data-encryption key,
 * printed as .env lines. Paste them into api/.env (never commit them).
 *
 *   npm run keys:generate
 */
import { generateKeyPairSync, randomBytes } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 3072,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const b64 = (s: string) => Buffer.from(s).toString('base64');
console.log(`JWT_PRIVATE_KEY=${b64(privateKey)}`);
console.log(`JWT_PUBLIC_KEY=${b64(publicKey)}`);
if (process.argv.includes('--with-data-key')) {
  console.log(`DATA_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`);
}
