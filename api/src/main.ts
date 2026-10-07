import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';
import { requestId } from './common/http/request-id.middleware.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const isProd = config.get('NODE_ENV', { infer: true }) === 'production';

  // Real client IPs (rate limits, audit, terms evidence) behind the Next.js / load-balancer hop.
  app.set('trust proxy', isProd ? 1 : 'loopback');
  app.disable('x-powered-by');

  app.use(requestId);
  // The API only ever returns JSON, so the strictest policy applies.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] },
      },
      frameguard: { action: 'deny' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: isProd ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
    }),
  );
  // Small bodies by default; file uploads get their own streaming endpoint (Sprint 2).
  app.useBodyParser('json', { limit: '100kb' });
  app.useBodyParser('urlencoded', { limit: '100kb', extended: false });
  app.use(cookieParser());

  app.enableCors({
    origin: [config.get('WEB_ORIGIN', { infer: true }), config.get('ADMIN_ORIGIN', { infer: true })],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    maxAge: 600,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields
      forbidNonWhitelisted: true, // ...and reject requests that send them
      transform: true,
      stopAtFirstError: true,
    }),
  );
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(`Laibu API listening on http://localhost:${port}/api`);
}

await bootstrap();
