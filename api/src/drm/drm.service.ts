import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service.js';
import { StorageService } from './storage.service.js';

export interface EncryptionResult {
  encryptedBuffer: Buffer;
  keyRef: string;
  sha256: string;
  sizeBytes: number;
}

@Injectable()
export class DrmService {
  private readonly logger = new Logger(DrmService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly fieldEncryption: FieldEncryptionService,
  ) {}

  /**
   * Encrypts a raw book file using AES-256-GCM with a unique per-book key.
   * Format of encrypted buffer: [12-byte IV] + [16-byte AuthTag] + [Ciphertext]
   */
  encryptBookFile(rawBuffer: Buffer): EncryptionResult {
    // 1. Generate unique 32-byte per-book key (K_book)
    const bookKey = crypto.randomBytes(32);
    // 2. Generate 12-byte IV for GCM
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', bookKey, iv);
    const encrypted = Buffer.concat([cipher.update(rawBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Payload structure: IV (12) + Tag (16) + Encrypted data
    const payload = Buffer.concat([iv, authTag, encrypted]);

    // 3. Encrypt the K_book using the master DATA_ENCRYPTION_KEY to create a secure key_ref
    const keyRef = this.fieldEncryption.encrypt(bookKey.toString('base64'), 'drm_key_store').toString('base64');
    const sha256 = crypto.createHash('sha256').update(rawBuffer).digest('hex');

    return {
      encryptedBuffer: payload,
      keyRef,
      sha256,
      sizeBytes: rawBuffer.length,
    };
  }

  /**
   * Decrypts an encrypted book payload given its key_ref.
   */
  decryptBookFile(encryptedPayload: Buffer, keyRef: string): Buffer {
    const rawKeyBase64 = this.fieldEncryption.decrypt(Buffer.from(keyRef, 'base64'), 'drm_key_store');
    const bookKey = Buffer.from(rawKeyBase64, 'base64');

    const iv = encryptedPayload.subarray(0, 12);
    const authTag = encryptedPayload.subarray(12, 28);
    const ciphertext = encryptedPayload.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', bookKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  /**
   * Full DRM workflow for an uploaded book:
   * 1. Read raw file
   * 2. Encrypt with AES-256-GCM
   * 3. Save encrypted file
   * 4. Delete raw file
   */
  async processBookDrm(rawObjectKey: string, filename: string): Promise<{
    encryptedObjectKey: string;
    keyRef: string;
    sha256: string;
    sizeBytes: number;
  }> {
    const rawBuffer = await this.storage.getFile(rawObjectKey);
    const result = this.encryptBookFile(rawBuffer);

    const encryptedObjectKey = await this.storage.saveEncrypted(filename, result.encryptedBuffer);

    // Delete raw unencrypted file from private bucket/disk
    await this.storage.deleteFile(rawObjectKey);

    return {
      encryptedObjectKey,
      keyRef: result.keyRef,
      sha256: result.sha256,
      sizeBytes: result.sizeBytes,
    };
  }
}
