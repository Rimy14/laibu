import { Controller, Get, Post, Param, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser, Roles } from '../common/auth/decorators.js';
import type { AuthUser } from '../common/auth/auth.types.js';
import { AdminPayoutsService } from './admin-payouts.service.js';

@Controller('admin/payout-cycles')
@Roles('superadmin')
export class AdminPayoutsController {
  constructor(private readonly adminPayouts: AdminPayoutsService) {}

  @Get()
  async listCycles() {
    return this.adminPayouts.listCycles();
  }

  @Get(':id')
  async getCycleDetails(@Param('id') id: string) {
    return this.adminPayouts.getCycleDetails(id);
  }

  @Post('generate')
  async generateCycle(
    @Body() body: { payday?: string },
    @CurrentUser() adminUser: AuthUser,
    @Req() req: Request,
  ) {
    return this.adminPayouts.triggerCycleGeneration(body.payday, adminUser, req);
  }

  @Post('lines/:lineId/mark-paid')
  async markLinePaid(
    @Param('lineId') lineId: string,
    @Body() body: { payment_reference: string },
    @CurrentUser() adminUser: AuthUser,
    @Req() req: Request,
  ) {
    return this.adminPayouts.markLinePaid(lineId, body.payment_reference, adminUser, req);
  }

  @Post('lines/:lineId/hold')
  async toggleHold(
    @Param('lineId') lineId: string,
    @Body() body: { hold: boolean; hold_reason?: string },
    @CurrentUser() adminUser: AuthUser,
    @Req() req: Request,
  ) {
    return this.adminPayouts.toggleLineHold(lineId, body.hold, body.hold_reason, adminUser, req);
  }
}
