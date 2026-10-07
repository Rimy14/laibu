import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { DrmModule } from '../drm/drm.module.js';
import { EmailModule } from '../email/email.module.js';
import { ApprovalsModule } from '../approvals/approvals.module.js';
import { PublisherController } from './publisher.controller.js';
import { PublisherService } from './publisher.service.js';

@Module({
  imports: [DatabaseModule, DrmModule, EmailModule, ApprovalsModule],
  controllers: [PublisherController],
  providers: [PublisherService],
  exports: [PublisherService],
})
export class PublisherModule {}
