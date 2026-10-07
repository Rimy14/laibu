import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

const SAFE_ID = /^[A-Za-z0-9-]{8,64}$/;

/** Tags every request with an id that appears in logs, audit rows and error responses. */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.get('x-request-id');
  req.requestId = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
