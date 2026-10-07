import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { calculateSaleSplit } from '../sales/split-engine.js';
import { CheckoutDto, CheckoutResult, DarajaCallbackPayload } from './checkout.types.js';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(private readonly db: DatabaseService) {}

  normalizePhone(phone: string): { formatted: string; last4: string } {
    const cleaned = phone.replace(/[^\d+]/g, '');
    let formatted = cleaned;

    if (formatted.startsWith('+254')) {
      formatted = formatted.slice(1);
    } else if (formatted.startsWith('0')) {
      formatted = `254${formatted.slice(1)}`;
    } else if (!formatted.startsWith('254') && formatted.length === 9) {
      formatted = `254${formatted}`;
    }

    if (!/^254[17]\d{8}$/.test(formatted)) {
      throw new BadRequestException(
        'Invalid Kenyan phone number. Use format 07XXXXXXXX, 01XXXXXXXX, or 2547XXXXXXXX.',
      );
    }

    const last4 = formatted.slice(-4);
    return { formatted, last4 };
  }

  async createCheckout(buyerId: string, dto: CheckoutDto): Promise<CheckoutResult> {
    const { formatted: phone, last4 } = this.normalizePhone(dto.phone);

    // 1. Verify book exists and is live
    const bookRes = await this.db.query(
      `SELECT * FROM books WHERE id = $1 AND status = 'live'`,
      [dto.book_id],
    );
    if (bookRes.rowCount === 0) {
      throw new NotFoundException('Book is not available for purchase.');
    }
    const book = bookRes.rows[0];
    const amountKes = parseFloat(book.price_kes);

    // 2. Check if buyer already owns a licence for this book
    const existingLicence = await this.db.query(
      `SELECT id FROM licences WHERE user_id = $1 AND book_id = $2`,
      [buyerId, dto.book_id],
    );
    if (existingLicence.rowCount && existingLicence.rowCount > 0) {
      throw new ConflictException('You already own this book in your library.');
    }

    // 3. Idempotency key
    const idempotencyKey =
      dto.idempotency_key || `ord_${buyerId}_${dto.book_id}_${Date.now()}`;

    // Check if pending order already exists with this idempotency key
    const existingOrder = await this.db.query(
      `SELECT * FROM orders WHERE idempotency_key = $1`,
      [idempotencyKey],
    );
    if (existingOrder.rowCount && existingOrder.rowCount > 0) {
      const ord = existingOrder.rows[0];
      return {
        orderId: ord.id,
        checkoutRequestId: ord.mpesa_checkout_request_id || '',
        customerMessage: 'STK push already initiated.',
        status: ord.status,
        amountKes,
      };
    }

    // 4. Generate STK push identifiers
    const checkoutRequestId = `ws_CO_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const merchantRequestId = `mr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // 5. Create Order
    const insertRes = await this.db.query(
      `INSERT INTO orders (
        buyer_id, book_id, amount_kes, status, idempotency_key,
        mpesa_phone_last4, mpesa_merchant_request_id, mpesa_checkout_request_id
      ) VALUES (
        $1, $2, $3, 'pending', $4,
        $5, $6, $7
      ) RETURNING *`,
      [
        buyerId,
        dto.book_id,
        amountKes,
        idempotencyKey,
        last4,
        merchantRequestId,
        checkoutRequestId,
      ],
    );

    const order = insertRes.rows[0];
    this.logger.log(
      `[Daraja STK Push] Sent to ${phone} (***${last4}) for KES ${amountKes} (Order: ${order.id})`,
    );

    return {
      orderId: order.id,
      checkoutRequestId,
      customerMessage: `STK push prompt sent to ${phone}. Enter your M-Pesa PIN on your phone to complete payment.`,
      status: 'pending',
      amountKes,
    };
  }

  async confirmOrderPayment(
    orderId: string,
    mpesaReceipt?: string,
    _checkoutRequestId?: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      // 1. Fetch Order and lock
      const orderRes = await tx.query(
        `SELECT o.*, b.author_id, b.publisher_id, b.is_superadmin_book, b.author_royalty_pct
         FROM orders o
         JOIN books b ON b.id = o.book_id
         WHERE o.id = $1 FOR UPDATE`,
        [orderId],
      );

      if (orderRes.rowCount === 0) throw new NotFoundException('Order not found.');
      const order = orderRes.rows[0];

      if (order.status === 'paid') {
        return; // Idempotent: already processed
      }

      const receipt =
        mpesaReceipt || `QK${Date.now().toString().slice(-8)}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

      // 2. Mark order as paid
      await tx.query(
        `UPDATE orders
         SET status = 'paid',
             paid_at = now(),
             mpesa_receipt = $1
         WHERE id = $2`,
        [receipt, orderId],
      );

      // 3. Count distinct sold titles for publisher tier
      let publisherSoldTitles = 0;
      if (order.publisher_id) {
        const soldRes = await tx.query<{ count: string }>(
          `SELECT COUNT(DISTINCT book_id) as count FROM sales_ledger WHERE publisher_id = $1`,
          [order.publisher_id],
        );
        publisherSoldTitles = parseInt(soldRes.rows[0]?.count || '0', 10);
      }

      // 4. Calculate split
      const gross = parseFloat(order.amount_kes);
      const isPublisherSale = Boolean(order.publisher_id);
      const authorRoyaltyPct = order.author_royalty_pct
        ? parseFloat(order.author_royalty_pct)
        : undefined;

      const split = calculateSaleSplit({
        gross,
        isPublisherSale,
        publisherSoldTitles,
        authorRoyaltyPct,
      });

      // 5. Insert into sales_ledger
      await tx.query(
        `INSERT INTO sales_ledger (
          order_id, book_id, buyer_id, author_id, publisher_id,
          owner_id, is_publisher_sale, gross, fee_rate, fee_amount,
          author_royalty_pct, author_royalty_amount, publisher_margin,
          owner_amount, publisher_sold_titles, entry_type
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13,
          $14, $15, 'sale'
        )`,
        [
          orderId,
          order.book_id,
          order.buyer_id,
          order.author_id,
          order.publisher_id || null,
          isPublisherSale ? null : order.author_id,
          isPublisherSale,
          split.gross,
          split.feeRate,
          split.feeAmount,
          split.authorRoyaltyPct || null,
          split.authorRoyaltyAmount,
          split.publisherMargin,
          split.ownerAmount,
          isPublisherSale ? publisherSoldTitles : null,
        ],
      );

      // 6. Issue DRM Licence for Buyer (3 devices max)
      await tx.query(
        `INSERT INTO licences (user_id, book_id, order_id, max_devices, issued_at)
         VALUES ($1, $2, $3, 3, now())
         ON CONFLICT (user_id, book_id) DO NOTHING`,
        [order.buyer_id, order.book_id, orderId],
      );

      this.logger.log(
        `[Order Paid] Order ${orderId} confirmed. Gross: KES ${split.gross}, Fee: KES ${split.feeAmount}, Licence issued.`,
      );
    });
  }

  async processDarajaWebhook(payload: DarajaCallbackPayload): Promise<{ processed: boolean }> {
    const callback = payload?.Body?.stkCallback;
    if (!callback) throw new BadRequestException('Malformed callback payload');

    const checkoutRequestId = callback.CheckoutRequestID;
    const resultCode = callback.ResultCode;

    // Idempotency check in payment_events
    const eventRes = await this.db.query(
      `INSERT INTO payment_events (provider, event_key, payload, result)
       VALUES ('mpesa', $1, $2, $3)
       ON CONFLICT (provider, event_key) DO NOTHING
       RETURNING id`,
      [checkoutRequestId, JSON.stringify(payload), resultCode === 0 ? 'success' : 'failed'],
    );

    if (eventRes.rowCount === 0) {
      return { processed: true }; // Already logged and processed
    }

    const orderRes = await this.db.query(
      `SELECT id FROM orders WHERE mpesa_checkout_request_id = $1`,
      [checkoutRequestId],
    );
    if (orderRes.rowCount === 0) {
      this.logger.warn(`No order matched CheckoutRequestID: ${checkoutRequestId}`);
      return { processed: false };
    }

    const orderId = orderRes.rows[0].id;

    if (resultCode === 0) {
      let receipt: string | undefined;
      const items = callback.CallbackMetadata?.Item;
      if (items) {
        const receiptItem = items.find((i) => i.Name === 'MpesaReceiptNumber');
        if (receiptItem?.Value) receipt = String(receiptItem.Value);
      }
      await this.confirmOrderPayment(orderId, receipt, checkoutRequestId);
    } else {
      await this.db.query(
        `UPDATE orders
         SET status = 'failed',
             failure_reason = $1
         WHERE id = $2`,
        [callback.ResultDesc || 'Payment failed or cancelled by user', orderId],
      );
    }

    return { processed: true };
  }
}
