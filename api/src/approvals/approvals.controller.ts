import { Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../common/auth/decorators.js';
import { ApprovalsService } from './approvals.service.js';

@Public()
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get(':token')
  async getApprovalDetails(@Param('token') token: string) {
    const approval = await this.approvalsService.getApprovalByToken(token);
    return { approval };
  }

  @Post(':token/approve')
  async approve(@Param('token') token: string) {
    const approval = await this.approvalsService.approveToken(token);
    return {
      message: 'You have successfully approved this book publication request.',
      approval,
    };
  }

  @Post(':token/decline')
  async decline(@Param('token') token: string) {
    const approval = await this.approvalsService.declineToken(token);
    return {
      message: 'You have declined this publication request.',
      approval,
    };
  }
}
