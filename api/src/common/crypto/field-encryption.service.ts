import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Env } from '../../config/env.js';

const VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * AES-256-GCM for sensitive columns (bank account numbers, M-Pesa phones).
 * Layout: [version:1][iv:12][tag:16][ciphertext]. GCM authenticates, so a
 * tampered value fails to decrypt instead of returning garbage.
 * `context` (e.g. the user id) is bound as AAD, so a ciphertext copied onto
 * another user's row will not decrypt.
 */
@Injectable()
export class FieldEncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService<Env, true>) {
    this.key = Buffer.from(config.get('DATA_ENCRYPTION_KEY', { infer: true }), 'base64');
  }

  encrypt(plaintext: string, context: string): Buffer {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), ct]);
  }

  decrypt(blob: Buffer, context: string): string {
    if (blob.length < 1 + IV_BYTES + TAG_BYTES || blob[0] !== VERSION) {
      throw new Error('Unsupported or corrupt encrypted value');
    }
    const iv = blob.subarray(1, 1 + IV_BYTES);
    const tag = blob.subarray(1 + IV_BYTES, 1 + IV_BYTES + TAG_BYTES);
    const ct = blob.subarray(1 + IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  }

  /** Display helper: "•••• 4821". */
  static last4(value: string): string {
    return value.replace(/\D/g, '').slice(-4);
  }
}
