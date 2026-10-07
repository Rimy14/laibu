import { Controller, Get } from '@nestjs/common';
import { CurrentUser, Roles } from '../common/auth/decorators.js';
import type { AuthUser } from '../common/auth/auth.types.js';
import { PayoutsService } from './payouts.service.js';

@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Roles('author', 'publisher')
  @Get('me')
  async getMyPayouts(@CurrentUser() user: AuthUser) {
    return this.payoutsService.getPayeeEarningsOverview(user.id);
  }
}
