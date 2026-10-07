import { describe, expect, it, vi } from 'vitest';
import { ApprovalsService } from './approvals.service.js';

describe('ApprovalsService split engine and token logic', () => {
  const mockDb = {
    query: vi.fn(),
  };
  const mockEmail = {
    sendAuthorApprovalRequest: vi.fn().mockResolvedValue(undefined),
    sendApprovalOutcome: vi.fn().mockResolvedValue(undefined),
  };

  const service = new ApprovalsService(mockDb as any, mockEmail as any);

  it('calculates the exact canonical fee split (worked example)', () => {
    // Spec example: Price KES 800, 60% author royalty, 11% fee rate
    // Fee (11% of 800) = 88.00
    // Remainder = 712.00
    // Author (60% of 712) = 427.20
    // Publisher (remainder - author) = 284.80
    const split = service.calculateSplit(800.0, 60, 11);

    expect(split.exFee).toBe(88.0);
    expect(split.exRemainder).toBe(712.0);
    expect(split.exAuthor).toBe(427.2);
    expect(split.exPublisher).toBe(284.8);
  });

  it('calculates 10% fee tier for high-volume publishers (21+ distinct titles)', () => {
    const split = service.calculateSplit(1000.0, 70, 10);

    expect(split.exFee).toBe(100.0);
    expect(split.exRemainder).toBe(900.0);
    expect(split.exAuthor).toBe(630.0);
    expect(split.exPublisher).toBe(270.0);
  });

  it('generates secure 32-byte hex tokens with sha256 hash', () => {
    const { rawToken, tokenHash } = service.generateToken();

    expect(rawToken).toHaveLength(64); // 32 bytes in hex = 64 chars
    expect(tokenHash).toHaveLength(64);
    expect(rawToken).not.toBe(tokenHash);
  });
});
