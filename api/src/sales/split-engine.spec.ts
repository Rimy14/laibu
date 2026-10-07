import { describe, expect, it } from 'vitest';
import { calculateSaleSplit } from './split-engine.js';

describe('SplitEngine canonical financial rules', () => {
  it('calculates direct sale (12.5% platform fee, 87.5% owner amount)', () => {
    // KES 1000 gross direct sale
    const result = calculateSaleSplit({
      gross: 1000.0,
      isPublisherSale: false,
    });

    expect(result.feeRate).toBe(12.5);
    expect(result.feeAmount).toBe(125.0);
    expect(result.ownerAmount).toBe(875.0);
    expect(result.authorRoyaltyAmount).toBe(0);
    expect(result.publisherMargin).toBe(0);
    // Invariant sum check
    expect(result.feeAmount + result.ownerAmount).toBe(result.gross);
  });

  it('calculates publisher sale with 1-10 sold titles (11% fee, 70% author royalty)', () => {
    // KES 500 gross sale
    // Fee (11%) = 55.00
    // Remainder = 445.00
    // Author (70% of 445) = 311.50
    // Publisher (remainder - author) = 133.50
    const result = calculateSaleSplit({
      gross: 500.0,
      isPublisherSale: true,
      publisherSoldTitles: 4,
      authorRoyaltyPct: 70,
    });

    expect(result.feeRate).toBe(11.0);
    expect(result.feeAmount).toBe(55.0);
    expect(result.authorRoyaltyAmount).toBe(311.5);
    expect(result.publisherMargin).toBe(133.5);
    expect(result.ownerAmount).toBe(0);
    // Invariant check
    expect(
      result.feeAmount + result.authorRoyaltyAmount + result.publisherMargin,
    ).toBe(result.gross);
  });

  it('calculates publisher sale with 11-20 sold titles (10.5% fee)', () => {
    const result = calculateSaleSplit({
      gross: 800.0,
      isPublisherSale: true,
      publisherSoldTitles: 15,
      authorRoyaltyPct: 60,
    });

    expect(result.feeRate).toBe(10.5);
    expect(result.feeAmount).toBe(84.0);
    // Remainder = 716
    // Author (60% of 716) = 429.60
    // Publisher = 286.40
    expect(result.authorRoyaltyAmount).toBe(429.6);
    expect(result.publisherMargin).toBe(286.4);
    expect(
      result.feeAmount + result.authorRoyaltyAmount + result.publisherMargin,
    ).toBe(result.gross);
  });

  it('calculates publisher sale with 21+ sold titles (10% fee)', () => {
    const result = calculateSaleSplit({
      gross: 2000.0,
      isPublisherSale: true,
      publisherSoldTitles: 25,
      authorRoyaltyPct: 80,
    });

    expect(result.feeRate).toBe(10.0);
    expect(result.feeAmount).toBe(200.0);
    // Remainder = 1800
    // Author (80% of 1800) = 1440.00
    // Publisher = 360.00
    expect(result.authorRoyaltyAmount).toBe(1440.0);
    expect(result.publisherMargin).toBe(360.0);
    expect(
      result.feeAmount + result.authorRoyaltyAmount + result.publisherMargin,
    ).toBe(result.gross);
  });
});
