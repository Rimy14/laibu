import { Module } from '@nestjs/common';
import { CryptoModule } from '../common/crypto/crypto.module.js';
import { StorageService } from './storage.service.js';
import { VirusScannerService } from './virus-scanner.service.js';
import { DrmService } from './drm.service.js';

@Module({
  imports: [CryptoModule],
  providers: [StorageService, VirusScannerService, DrmService],
  exports: [StorageService, VirusScannerService, DrmService],
})
export class DrmModule {}
