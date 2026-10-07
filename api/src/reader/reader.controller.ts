import { Controller, Get, Post, Param, Body, Req, Query } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser, Roles } from '../common/auth/decorators.js';
import type { AuthUser } from '../common/auth/auth.types.js';
import { ReaderService } from './reader.service.js';

@Controller('reader')
export class ReaderController {
  constructor(private readonly readerService: ReaderService) {}

  @Roles('buyer', 'author', 'publisher', 'superadmin')
  @Get('books/:bookId/session')
  async getSession(
    @Param('bookId') bookId: string,
    @Query('fingerprint') fingerprint: string,
    @Query('label') label: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const userAgent = req.headers['user-agent'];
    return this.readerService.getReaderSession(user.id, bookId, fingerprint || 'browser', label || 'Chrome Browser', ip, userAgent);
  }

  @Post('security-events')
  async logSecurityEvent(
    @Body() body: { book_id?: string; event_type: string; page?: string; device_label?: string },
    @CurrentUser() user: AuthUser | null,
    @Req() req: Request,
  ) {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string);
    const userAgent = req.headers['user-agent'];
    return this.readerService.recordSecurityEvent(
      user?.id || null,
      body.book_id || null,
      body.event_type,
      body.page,
      body.device_label,
      ip,
      userAgent,
    );
  }
}
