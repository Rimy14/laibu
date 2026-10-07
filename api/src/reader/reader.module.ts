import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { CryptoModule } from '../common/crypto/crypto.module.js';
import { DrmModule } from '../drm/drm.module.js';
import { ReaderService } from './reader.service.js';
import { ReaderController } from './reader.controller.js';

@Module({
  imports: [DatabaseModule, CryptoModule, DrmModule],
  controllers: [ReaderController],
  providers: [ReaderService],
  exports: [ReaderService],
})
export class ReaderModule {}
