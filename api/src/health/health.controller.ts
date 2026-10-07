import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/auth/decorators.js';
import { DatabaseService } from '../database/database.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  /** Liveness + database check. Reveals nothing beyond up/down. */
  @Public()
  @SkipThrottle()
  @Get()
  async check() {
    const database = await this.db.isHealthy();
    if (!database) throw new ServiceUnavailableException('Service temporarily unavailable.');
    return { status: 'ok', database: 'up', time: new Date().toISOString() };
  }
}
