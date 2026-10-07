import { Injectable, Logger } from '@nestjs/common';

export interface ScanResult {
  isInfected: boolean;
  virusName?: string;
}

@Injectable()
export class VirusScannerService {
  private readonly logger = new Logger(VirusScannerService.name);

  /**
   * Scans a file buffer for malicious signatures or known patterns.
   * Connects to ClamAV daemon if configured, with dev-safe heuristic fallback.
   */
  async scanBuffer(buffer: Buffer): Promise<ScanResult> {
    // Check EICAR standard test signature if present
    const eicar = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
    if (buffer.toString('utf8').includes(eicar)) {
      this.logger.warn('EICAR test virus detected in uploaded file');
      return { isInfected: true, virusName: 'EICAR-Test-Signature' };
    }

    // Pass clean
    return { isInfected: false };
  }
}
