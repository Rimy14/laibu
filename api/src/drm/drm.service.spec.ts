import { describe, expect, it } from 'vitest';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service.js';
import { StorageService } from './storage.service.js';
import { DrmService } from './drm.service.js';

describe('DrmService AES-256-GCM encryption', () => {
  const masterKey = Buffer.alloc(32, 7).toString('base64');
  const fieldEncryption = new FieldEncryptionService({
    get: (key: string) => (key === 'DATA_ENCRYPTION_KEY' ? masterKey : undefined),
  } as any);
  const storage = new StorageService();
  const drm = new DrmService(storage, fieldEncryption);

  it('encrypts and decrypts book content losslessly', () => {
    const rawContent = Buffer.from('This is a confidential DRM protected Kenya eBook content for Laibu marketplace.');
    const result = drm.encryptBookFile(rawContent);

    expect(result.encryptedBuffer).toBeDefined();
    expect(result.encryptedBuffer.length).toBeGreaterThan(rawContent.length);
    expect(result.keyRef).toBeDefined();
    expect(result.sha256).toBeDefined();
    expect(result.sizeBytes).toBe(rawContent.length);

    // Decrypt
    const decrypted = drm.decryptBookFile(result.encryptedBuffer, result.keyRef);
    expect(decrypted.toString('utf8')).toBe(rawContent.toString('utf8'));
  });

  it('generates unique per-book ciphertexts and keys for identical content', () => {
    const content = Buffer.from('Identical content');
    const res1 = drm.encryptBookFile(content);
    const res2 = drm.encryptBookFile(content);

    // Same plaintext SHA256
    expect(res1.sha256).toBe(res2.sha256);
    // Unique encrypted payloads and keyRefs due to random IV & random per-book key
    expect(res1.encryptedBuffer.equals(res2.encryptedBuffer)).toBe(false);
    expect(res1.keyRef).not.toBe(res2.keyRef);
  });
});
