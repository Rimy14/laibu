import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../common/auth/decorators.js';
import { StorefrontService } from './storefront.service.js';

@Public()
@Controller()
export class StorefrontController {
  constructor(private readonly storefrontService: StorefrontService) {}

  @Get('storefront')
  async getCatalogue(
    @Query('q') search?: string,
    @Query('category') category?: string,
  ) {
    const books = await this.storefrontService.getCatalogue(search, category);
    return { books };
  }

  @Get('books/detail/:slug')
  async getBookDetails(@Param('slug') slug: string) {
    const book = await this.storefrontService.getBookDetails(slug);
    return { book };
  }

  @Get('authors/:slug/room')
  async getAuthorRoom(@Param('slug') slug: string) {
    const room = await this.storefrontService.getAuthorRoom(slug);
    return { room };
  }
}
