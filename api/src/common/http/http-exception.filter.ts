import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';

interface ErrorBody {
  error: { code: string; message: string; requestId?: string };
  /** §9: present on 428 so the client opens the terms modal. */
  requires_acceptance?: true;
}

/**
 * One error shape for the whole API, written for people: the UI shows `message`
 * as-is. Internal details (stack traces, SQL, constraint names) never leave the
 * server; they are logged against the request id instead.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const { status, body } = this.toResponse(exception);
    body.error.requestId = req.requestId;
    if (status === 428) body.requires_acceptance = true;

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.originalUrl} -> ${status} [${req.requestId}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    res.status(status).json(body);
  }

  private toResponse(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof ThrottlerException) {
      return err(429, 'too_many_requests', 'Too many attempts. Please wait a moment and try again.');
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'object' && payload !== null) {
        const message = (payload as { message?: unknown }).message;
        // class-validator returns a list of messages
        if (Array.isArray(message)) {
          return err(status, 'validation_failed', String(message[0] ?? 'Please check your details.'));
        }
        // Nest's default "Cannot GET /path" would echo the route back; keep 404s generic
        if (status === 404 && typeof message === 'string' && message.startsWith('Cannot ')) {
          return err(404, 'not_found', 'Not found.');
        }
        // Malformed JSON: don't echo parser internals
        if (status === 400 && typeof message === 'string' && /JSON/.test(message)) {
          return err(400, 'bad_request', 'The request could not be read.');
        }
        if (typeof message === 'string') return err(status, codeFor(status), message);
      }
      return err(status, codeFor(status), typeof payload === 'string' ? payload : exception.message);
    }

    // Body-parser errors (too large / malformed JSON) arrive before Nest's pipes
    const bodyError = (exception as { type?: string } | null)?.type;
    if (bodyError === 'entity.too.large') return err(413, 'payload_too_large', 'That request is too large.');
    if (bodyError === 'entity.parse.failed') return err(400, 'bad_request', 'The request could not be read.');

    // PostgreSQL errors raised by our own constraints and triggers
    const pgCode = (exception as { code?: string } | null)?.code;
    if (pgCode === '23505') return err(409, 'conflict', 'This already exists.');
    if (pgCode === '23514') {
      // check_violation messages written in our triggers are user-safe sentences
      const msg = (exception as Error).message;
      const safe = /^[a-z][a-z0-9 ,()'-]{5,200}$/i.test(msg);
      return err(422, 'rule_violation', safe ? sentence(msg) : 'This change is not allowed.');
    }
    if (pgCode === '42501') return err(409, 'locked', 'This record is locked and cannot be changed.');

    return err(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'internal_error',
      'Something went wrong on our side. Please try again.',
    );
  }
}

function err(status: number, code: string, message: string) {
  return { status, body: { error: { code, message } } as ErrorBody };
}

function codeFor(status: number): string {
  const codes: Record<number, string> = {
    400: 'bad_request',
    401: 'unauthenticated',
    403: 'forbidden',
    404: 'not_found',
    409: 'conflict',
    413: 'payload_too_large',
    422: 'unprocessable',
    428: 'terms_acceptance_required',
  };
  return codes[status] ?? 'error';
}

function sentence(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1) + (s.endsWith('.') ? '' : '.');
}
