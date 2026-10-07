import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { AdminAuditController } from '../../admin/admin-audit.controller.js';
import { AdminAuditService } from '../../admin/admin-audit.service.js';
import { DatabaseModule } from '../../database/database.module.js';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [AdminAuditController],
  providers: [AuditService, AdminAuditService],
  exports: [AuditService, AdminAuditService],
})
export class AuditModule {}

