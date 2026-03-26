import { describe, it, expect, vi } from 'vitest';
import { withRetry, isRetryableError, isRetryableStatusCode } from '../retry.js';

describe('isRetryableStatusCode', () => {
  it('returns true for retryable status codes', () => {
    expect(isRetryableStatusCode(429)).toBe(true);
    expect(isRetryableStatusCode(500)).toBe(true);
    expect(isRetryableStatusCode(502)).toBe(true);
    expect(isRetryableStatusCode(503)).toBe(true);
    expect(isRetryableStatusCode(504)).toBe(true);
  });

  it('returns false for non-retryable status codes', () => {
    expect(isRetryableStatusCode(200)).toBe(false);
    expect(isRetryableStatusCode(400)).toBe(false);
    expect(isRetryableStatusCode(401)).toBe(false);
    expect(isRetryableStatusCode(403)).toBe(false);
    expect(isRetryableStatusCode(404)).toBe(false);
  });
});

describe('isRetryableError', () => {
  it('returns true for network errors', () => {
    const error = new Error('connect ECONNRESET');
    (error as NodeJS.ErrnoException).code = 'ECONNRESET';
    expect(isRetryableError(error)).toBe(true);
  });

  it('returns true for errors with retryable status codes', () => {
    const error = Object.assign(new Error('Too Many Requests'), { status: 429 });
    expect(isRetryableError(error)).toBe(true);
  });

  it('returns true for rate limit messages', () => {
    expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
  });

  it('returns false for auth errors', () => {
    const error = Object.assign(new Error('Invalid API key'), { status: 401 });
    expect(isRetryableError(error)).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isRetryableError('string error')).toBe(false);
    expect(isRetryableError(null)).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { maxRetries: 3 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and succeeds', async () => {
    const error = Object.assign(new Error('overloaded'), { status: 503 });
    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');

    const result = await withRetry(fn, { maxRetries: 3, initialDelayMs: 10 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries', async () => {
    const error = Object.assign(new Error('server error'), { status: 500 });
    const fn = vi.fn().mockRejectedValue(error);

    await expect(
      withRetry(fn, { maxRetries: 2, initialDelayMs: 10 }),
    ).rejects.toThrow('server error');
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('does not retry non-retryable errors', async () => {
    const error = Object.assign(new Error('bad request'), { status: 400 });
    const fn = vi.fn().mockRejectedValue(error);

    await expect(
      withRetry(fn, { maxRetries: 3, initialDelayMs: 10 }),
    ).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry callback', async () => {
    const error = Object.assign(new Error('overloaded'), { status: 503 });
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('ok');

    await withRetry(fn, { maxRetries: 3, initialDelayMs: 10, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(error, 1, expect.any(Number));
  });
});
