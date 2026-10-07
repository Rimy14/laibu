import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { CryptoModule } from '../common/crypto/crypto.module.js';
import { AuditModule } from '../common/audit/audit.module.js';
import { EmailModule } from '../email/email.module.js';
import { PayoutsService } from './payouts.service.js';
import { PayoutsController } from './payouts.controller.js';
import { AdminPayoutsController } from '../admin/admin-payouts.controller.js';
import { AdminPayoutsService } from '../admin/admin-payouts.service.js';

@Module({
  imports: [DatabaseModule, CryptoModule, AuditModule, EmailModule],
  controllers: [PayoutsController, AdminPayoutsController],
  providers: [PayoutsService, AdminPayoutsService],
  exports: [PayoutsService, AdminPayoutsService],
})
export class PayoutsModule {}

