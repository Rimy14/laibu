import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsString, Length, Matches } from 'class-validator';
import type { Request } from 'express';
import { AuditService } from '../common/audit/audit.service.js';
import type { AuthUser } from '../common/auth/auth.types.js';
import { AdminOnly, CurrentUser, Public } from '../common/auth/decorators.js';
import { DatabaseService } from '../database/database.service.js';
import { TermsService, type TermsDoc } from './terms.service.js';

class PublishTermsDto {
  @IsIn(['terms_of_use', 'privacy_policy'])
  doc!: TermsDoc;

  @IsString()
  @Matches(/^[0-9A-Za-z.\-]{1,20}$/, { message: 'Version may only contain letters, numbers, dots and dashes.' })
  version!: string;

  @IsString()
  @Length(2, 120)
  title!: string;

  @Type(() => String)
  @IsString()
  @Length(20, 200_000, { message: 'The document text looks too short.' })
  content_md!: string;
}

@Controller()
export class TermsController {
  constructor(
    private readonly terms: TermsService,
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}

  /** The texts shown in the signup checkbox and the re-acceptance modal. */
  @Public()
  @Get('terms/current')
  async current() {
    const c = await this.terms.current();
    const pick = (v: (typeof c)['terms_of_use']) => ({
      version: v.version,
      title: v.title,
      content_md: v.content_md,
      published_at: v.published_at,
    });
    return { terms_of_use: pick(c.terms_of_use), privacy_policy: pick(c.privacy_policy) };
  }

  @AdminOnly()
  @Get('admin/terms')
  list() {
    return this.terms.list();
  }

  /** §9 "is_current maintained by an admin endpoint". Forces every user to re-accept. */
  @AdminOnly()
  @Post('admin/terms')
  publish(@Body() dto: PublishTermsDto, @CurrentUser() admin: AuthUser, @Req() req: Request) {
    return this.db.transaction(async (tx) => {
      const row = await this.terms.publish(dto.doc, dto, admin.id, tx);
      await this.audit.record(req, { action: 'terms.publish', entityType: 'terms_version', entityId: row.id, metadata: { doc: dto.doc, version: dto.version } }, tx);
      return row;
    });
  }
}
