import { Controller, Get, Query } from '@nestjs/common';
import { AdminOnly, CurrentUser } from '../common/auth/decorators.js';
import type { AuthUser } from '../common/auth/auth.types.js';
import { SalesService } from './sales.service.js';

@Controller()
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('me/sales')
  async getMySales(
    @CurrentUser() user: AuthUser,
    @Query('book_id') bookId?: string,
  ) {
    return this.salesService.getUserSales(user.id, user.role, bookId);
  }

  @Get('me/library')
  async getMyLibrary(@CurrentUser() user: AuthUser) {
    const library = await this.salesService.getBuyerLibrary(user.id);
    return { library };
  }

  @AdminOnly()
  @Get('admin/ledger')
  async getAdminLedger(
    @Query('book_id') bookId?: string,
    @Query('publisher_id') publisherId?: string,
  ) {
    return this.salesService.getAdminLedger(bookId, publisherId);
  }
}
