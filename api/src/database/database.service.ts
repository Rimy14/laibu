import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';
import type { Env } from '../config/env.js';

// Return NUMERIC columns (money) as strings so no precision is lost to floats.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => v);

/** Anything that can run a parameterised query: the pool service or a transaction client. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<pg.QueryResult>;
}

/** Transient Neon errors that are safe to retry once with a fresh connection. */
const RETRYABLE = new Set([
  'CONNECTION_ENDED',
  'ECONNRESET',
  'EPIPE',
  'ENOTFOUND',
  'ETIMEDOUT',
]);

function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  if (e.code && RETRYABLE.has(e.code)) return true;
  if (e.message?.toLowerCase().includes('connection terminated')) return true;
  if (e.message?.toLowerCase().includes('connection timeout')) return true;
  return false;
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  readonly pool: pg.Pool;

  constructor(config: ConfigService<Env, true>) {
    this.pool = new pg.Pool({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      ssl: config.get('DATABASE_SSL', { infer: true }) ? { rejectUnauthorized: false } : undefined,
      max: 5,
      // Neon serverless pauses idle connections ~5 min; recycle at 2 min to stay ahead.
      idleTimeoutMillis: 120_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 15_000,
      application_name: 'laibu-api',
    });
    this.pool.on('error', (err) => this.logger.warn(`Idle client error (pool): ${err.message}`));
  }

  /**
   * Parameterised queries only — never interpolate user input into SQL.
   * Retries once on transient Neon connection-reset errors.
   */
  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<pg.QueryResult<T>> {
    try {
      return await this.pool.query<T>(text, params);
    } catch (err) {
      if (isRetryable(err)) {
        this.logger.warn(`Retrying query after transient connection error: ${(err as Error).message}`);
        return await this.pool.query<T>(text, params);
      }
      throw err;
    }
  }

  /** Runs fn inside one transaction; rolls back on any thrown error. */
  async transaction<T>(fn: (tx: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
