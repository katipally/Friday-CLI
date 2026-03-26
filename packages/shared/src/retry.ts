import { createLogger } from './logger.js';

const logger = createLogger('retry');

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelayMs: number;
  /** Maximum delay in ms between retries (default: 30000) */
  maxDelayMs: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier: number;
  /** Jitter factor 0-1 to randomize delays (default: 0.1) */
  jitterFactor: number;
  /** Function to determine if an error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Callback on each retry attempt */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

/**
 * Check if an HTTP error status code is retryable.
 * Retries on: 429 (rate limit), 500, 502, 503, 504 (server errors)
 */
export function isRetryableStatusCode(statusCode: number): boolean {
  return [429, 500, 502, 503, 504].includes(statusCode);
}

/**
 * Default retryable error checker. Retries on:
 * - Network errors (ECONNRESET, ETIMEDOUT, etc.)
 * - HTTP 429/5xx status codes
 * - Known provider error patterns
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // Network errors
  const networkCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN'];
  const errorCode = (error as NodeJS.ErrnoException).code;
  if (errorCode && networkCodes.includes(errorCode)) return true;

  // Check for status code on error objects
  const statusCode = (error as { status?: number; statusCode?: number }).status
    ?? (error as { status?: number; statusCode?: number }).statusCode;
  if (typeof statusCode === 'number' && isRetryableStatusCode(statusCode)) return true;

  // Common retryable error messages
  const retryablePatterns = [
    'rate limit',
    'too many requests',
    'overloaded',
    'capacity',
    'timeout',
    'GOAWAY',
    'socket hang up',
    'network',
    'fetch failed',
  ];
  const msg = error.message.toLowerCase();
  return retryablePatterns.some((pattern) => msg.includes(pattern));
}

/**
 * Calculate delay with exponential backoff and jitter.
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
  const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);
  const clampedDelay = Math.min(exponentialDelay, options.maxDelayMs);

  // Add jitter
  const jitter = clampedDelay * options.jitterFactor * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(clampedDelay + jitter));
}

/**
 * Execute a function with retry logic using exponential backoff and jitter.
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => provider.generate(request),
 *   { maxRetries: 3, initialDelayMs: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
  const shouldRetry = opts.isRetryable ?? isRetryableError;

  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= opts.maxRetries || !shouldRetry(error)) {
        throw error;
      }

      const delay = calculateDelay(attempt, opts);
      logger.warn(`Retry attempt ${attempt + 1}/${opts.maxRetries}`, {
        error: (error as Error).message,
        delayMs: delay,
      });

      opts.onRetry?.(error, attempt + 1, delay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Async generator wrapper that retries the entire generator on failure.
 * Useful for retrying streaming operations.
 */
export async function* withRetryStream<T>(
  fn: () => AsyncGenerator<T>,
  options?: Partial<RetryOptions>,
): AsyncGenerator<T> {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
  const shouldRetry = opts.isRetryable ?? isRetryableError;

  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      yield* fn();
      return;
    } catch (error) {
      lastError = error;

      if (attempt >= opts.maxRetries || !shouldRetry(error)) {
        throw error;
      }

      const delay = calculateDelay(attempt, opts);
      logger.warn(`Stream retry attempt ${attempt + 1}/${opts.maxRetries}`, {
        error: (error as Error).message,
        delayMs: delay,
      });

      opts.onRetry?.(error, attempt + 1, delay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
