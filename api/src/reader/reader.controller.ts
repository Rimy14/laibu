import { Controller, Get, Post, Param, Body, Req, Query, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
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

  @Roles('buyer', 'author', 'publisher', 'superadmin')
  @Get('books/:bookId/stream')
  async getStream(
    @Param('bookId') bookId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const { buffer, format } = await this.readerService.getBookStream(user.id, bookId);
    res.setHeader('Content-Type', format === 'epub' ? 'application/epub+zip' : 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.send(buffer);
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
