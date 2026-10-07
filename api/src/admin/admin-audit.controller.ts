import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/auth/decorators.js';
import { AdminAuditService } from './admin-audit.service.js';

@Controller('admin')
@Roles('superadmin')
export class AdminAuditController {
  constructor(private readonly adminAudit: AdminAuditService) {}

  @Get('audit')
  async getAuditLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminAudit.listAuditLogs(
      limit ? parseInt(limit, 10) : 100,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('security-events')
  async getSecurityEvents(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminAudit.listSecurityEvents(
      limit ? parseInt(limit, 10) : 100,
      offset ? parseInt(offset, 10) : 0,
    );
  }
}
