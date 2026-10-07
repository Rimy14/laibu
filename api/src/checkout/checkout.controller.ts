import { Body, Controller, Param, Post } from '@nestjs/common';
import { CurrentUser, Public } from '../common/auth/decorators.js';
import type { AuthUser } from '../common/auth/auth.types.js';
import { CheckoutService } from './checkout.service.js';
import { checkoutSchema } from './checkout.types.js';
import type { DarajaCallbackPayload } from './checkout.types.js';

@Controller()
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('checkout')
  async checkout(
    @CurrentUser() user: AuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    const dto = checkoutSchema.parse(body);
    return this.checkoutService.createCheckout(user.id, dto);
  }

  @Public()
  @Post('payments/webhook')
  async paymentWebhook(@Body() payload: DarajaCallbackPayload) {
    return this.checkoutService.processDarajaWebhook(payload);
  }

  /**
   * Dev helper to simulate M-Pesa PIN confirmation instantly for testing.
   */
  @Post('checkout/simulate-success/:orderId')
  async simulateSuccess(@Param('orderId') orderId: string) {
    await this.checkoutService.confirmOrderPayment(orderId);
    return { message: 'Order successfully confirmed and paid via simulated M-Pesa push.' };
  }
}
