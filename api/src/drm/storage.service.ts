import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir = path.resolve(process.cwd(), 'uploads');

  constructor() {
    this.ensureDirs();
  }

  private async ensureDirs() {
    try {
      await fs.mkdir(path.join(this.uploadDir, 'raw'), { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'encrypted'), { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'covers'), { recursive: true });
    } catch (err) {
      this.logger.error('Failed to create upload directories', err);
    }
  }

  async saveRaw(filename: string, buffer: Buffer): Promise<string> {
    const key = `raw/${Date.now()}-${filename}`;
    const filePath = path.join(this.uploadDir, key);
    await fs.writeFile(filePath, buffer);
    return key;
  }

  async saveEncrypted(filename: string, buffer: Buffer): Promise<string> {
    const key = `encrypted/${Date.now()}-${filename}.enc`;
    const filePath = path.join(this.uploadDir, key);
    await fs.writeFile(filePath, buffer);
    return key;
  }

  async saveCover(filename: string, buffer: Buffer): Promise<string> {
    const key = `covers/${Date.now()}-${filename}`;
    const filePath = path.join(this.uploadDir, key);
    await fs.writeFile(filePath, buffer);
    return key;
  }

  async getFile(key: string): Promise<Buffer> {
    const filePath = path.join(this.uploadDir, key);
    return fs.readFile(filePath);
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const filePath = path.join(this.uploadDir, key);
      await fs.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }
}
