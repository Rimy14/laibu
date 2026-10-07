import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { CryptoModule } from './common/crypto/crypto.module.js';
import { AuditModule } from './common/audit/audit.module.js';
import { AccessGuard } from './common/auth/access.guard.js';
import { HttpExceptionFilter } from './common/http/http-exception.filter.js';
import { OriginCheckMiddleware } from './common/http/origin-check.middleware.js';
import { HealthController } from './health/health.controller.js';
import { AuthenticateMiddleware } from './auth/authenticate.middleware.js';
import { AdminAuthController, AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { TokenService } from './auth/token.service.js';
import { TermsController } from './terms/terms.controller.js';
import { TermsGuard } from './terms/terms.guard.js';
import { TermsService } from './terms/terms.service.js';
import { MeController } from './me/me.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    // Default limit for every route; sign-in, signup and payout changes are stricter (§10).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    CryptoModule,
    AuditModule,
  ],
  controllers: [HealthController, AuthController, AdminAuthController, TermsController, MeController],
  providers: [
    TokenService,
    AuthService,
    TermsService,
    // Order matters: rate limit → signed in / right role → current terms (§9)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
    { provide: APP_GUARD, useClass: TermsGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(OriginCheckMiddleware, AuthenticateMiddleware).forRoutes('*path');
  }
}
