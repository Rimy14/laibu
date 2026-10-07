import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { DrmModule } from '../drm/drm.module.js';
import { AuditModule } from '../common/audit/audit.module.js';
import { BooksController } from './books.controller.js';
import { BooksService } from './books.service.js';
import { AdminBooksController } from '../admin/admin-books.controller.js';
import { AdminBooksService } from '../admin/admin-books.service.js';

@Module({
  imports: [DatabaseModule, DrmModule, AuditModule],
  controllers: [BooksController, AdminBooksController],
  providers: [BooksService, AdminBooksService],
  exports: [BooksService, AdminBooksService],
})
export class BooksModule {}
