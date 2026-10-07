import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PayoutsService } from './payouts.service.js';

describe('PayoutsService', () => {
  let service: PayoutsService;
  let mockDb: any;
  let mockCrypto: any;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
      transaction: vi.fn(),
    };
    mockCrypto = {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    };
    service = new PayoutsService(mockDb, mockCrypto);
  });

  it('should compile and calculate overview metrics correctly', async () => {
    mockDb.query
      .mockResolvedValueOnce({
        rows: [
          {
            type: 'mpesa',
            account_name: 'Smith Brock',
            bank_name: null,
            bank_branch: null,
            account_last4: '0712',
            full_name: 'Smith Brock',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            owner_amount: '437.50',
            author_royalty_amount: '0.00',
            publisher_margin: '0.00',
            is_publisher_sale: false,
            author_id: 'user-1',
            publisher_id: null,
            owner_id: 'user-1',
            payout_cycle_id: null,
            paid_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [],
      });

    const overview = await service.getPayeeEarningsOverview('user-1');

    expect(overview.lifetime_earned).toBe(437.5);
    expect(overview.lifetime_paid).toBe(0);
    expect(overview.unallocated_balance).toBe(437.5);
    expect(overview.payout_method?.type).toBe('mpesa');
    expect(overview.payout_method?.name_matches).toBe(true);
    expect(overview.next_payday).toBeDefined();
  });
});
