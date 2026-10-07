import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CurrentUser, Roles } from '../common/auth/decorators.js';
import type { AuthUser } from '../common/auth/auth.types.js';
import { PublisherService } from './publisher.service.js';
import {
  createPublisherBookSchema,
  requestSellExistingSchema,
} from '../approvals/approvals.types.js';
import type { UploadedFile } from '../books/books.types.js';

@Roles('publisher')
@Controller('publisher')
export class PublisherController {
  constructor(private readonly publisherService: PublisherService) {}

  @Post('books')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 },
      { name: 'cover', maxCount: 1 },
    ]),
  )
  async createPublisherBook(
    @CurrentUser() user: AuthUser,
    @Body() body: Record<string, unknown>,
    @UploadedFiles()
    files?: { file?: UploadedFile[]; cover?: UploadedFile[] },
  ) {
    const dto = createPublisherBookSchema.parse(body);
    const bookFile = files?.file?.[0];
    const coverFile = files?.cover?.[0];

    const book = await this.publisherService.createPublisherBook(
      user.id,
      dto,
      bookFile,
      coverFile,
    );

    return {
      message: 'Book created and proposal email sent to the author for approval.',
      book,
    };
  }

  @Post('books/:id/request')
  async requestSellExisting(
    @CurrentUser() user: AuthUser,
    @Param('id') bookId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const dto = requestSellExistingSchema.parse(body);
    return this.publisherService.requestSellExisting(user.id, bookId, dto);
  }

  @Get('books')
  async getMyBooks(@CurrentUser() user: AuthUser) {
    const books = await this.publisherService.getPublisherBooks(user.id);
    return { books };
  }
}
