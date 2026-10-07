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
import { CurrentUser, Public, Roles } from '../common/auth/decorators.js';
import type { AuthUser } from '../common/auth/auth.types.js';
import { BooksService } from './books.service.js';
import { createBookSchema, UploadedFile } from './books.types.js';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Roles('author')
  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 },
      { name: 'cover', maxCount: 1 },
    ]),
  )
  async uploadBook(
    @CurrentUser() user: AuthUser,
    @Body() body: Record<string, unknown>,
    @UploadedFiles()
    files?: { file?: UploadedFile[]; cover?: UploadedFile[] },
  ) {
    const dto = createBookSchema.parse(body);
    const bookFile = files?.file?.[0];
    const coverFile = files?.cover?.[0];

    const book = await this.booksService.createAuthorBook(user.id, dto, bookFile, coverFile);
    return {
      message: 'Book uploaded successfully and sent for admin review.',
      book,
    };
  }

  @Roles('author')
  @Get('my')
  async getMyBooks(@CurrentUser() user: AuthUser) {
    const books = await this.booksService.getAuthorBooks(user.id);
    return { books };
  }

  @Public()
  @Get('slug/:slug')
  async getBookBySlug(@Param('slug') slug: string) {
    const book = await this.booksService.getBookBySlug(slug);
    return { book };
  }

  @Get(':id')
  async getBook(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    const book = await this.booksService.getBookById(id, user?.id, user?.role);
    return { book };
  }
}
