import { z } from 'zod';

export const checkoutSchema = z.object({
  book_id: z.string().uuid(),
  phone: z.string().min(9).max(15),
  idempotency_key: z.string().min(8).max(64).optional(),
});

export type CheckoutDto = z.infer<typeof checkoutSchema>;

export interface CheckoutResult {
  orderId: string;
  checkoutRequestId: string;
  customerMessage: string;
  status: 'pending' | 'paid';
  amountKes: number;
}

export interface DarajaCallbackPayload {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value?: string | number;
        }>;
      };
    };
  };
}
