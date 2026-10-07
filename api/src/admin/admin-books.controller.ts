import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminOnly } from '../common/auth/decorators.js';
import { AdminBooksService } from './admin-books.service.js';
import { adminRejectSchema, BookStatus } from '../books/books.types.js';

@AdminOnly()
@Controller('admin/books')
export class AdminBooksController {
  constructor(private readonly adminBooksService: AdminBooksService) {}

  @Get()
  async listBooks(@Query('status') status?: string) {
    const books = await this.adminBooksService.listBooks(status as BookStatus | undefined);
    return { books };
  }

  @Get(':id')
  async getBookDetails(@Param('id') id: string) {
    const book = await this.adminBooksService.getBookDetails(id);
    return { book };
  }

  @Post(':id/approve')
  async approveBook(@Param('id') id: string, @Req() req: Request) {
    const book = await this.adminBooksService.approveBook(id, req);
    return {
      message: 'Book has been approved and is now live on the storefront.',
      book,
    };
  }

  @Post(':id/reject')
  async rejectBook(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
  ) {
    const dto = adminRejectSchema.parse(body);
    const book = await this.adminBooksService.rejectBook(id, req, dto.notes);
    return {
      message: 'Book has been rejected with review notes.',
      book,
    };
  }

  @Post(':id/delist')
  async delistBook(@Param('id') id: string, @Req() req: Request) {
    const book = await this.adminBooksService.delistBook(id, req);
    return {
      message: 'Book has been delisted.',
      book,
    };
  }
}
