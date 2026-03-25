import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, setLogLevel, setJsonMode } from '../logger.js';

describe('createLogger', () => {
  beforeEach(() => {
    setLogLevel('debug');
    setJsonMode(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setLogLevel('info');
    setJsonMode(false);
  });

  it('returns a logger with debug, info, warn, error methods', () => {
    const logger = createLogger('test');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('includes namespace in formatted messages', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = createLogger('my-namespace');
    logger.info('hello');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain('my-namespace');
  });

  it('includes message text in output', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createLogger('ns');
    logger.warn('something went wrong');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain('something went wrong');
  });

  it('appends extra data when provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger('ns');
    logger.error('fail', { code: 42 });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain('42');
  });

  describe('log levels', () => {
    it('suppresses debug when level is info', () => {
      setLogLevel('info');
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const logger = createLogger('ns');
      logger.debug('hidden');
      expect(spy).not.toHaveBeenCalled();
    });

    it('shows warn and error when level is warn', () => {
      setLogLevel('warn');
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = createLogger('ns');
      logger.info('hidden');
      logger.warn('visible');
      logger.error('also visible');
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(errorSpy).toHaveBeenCalledOnce();
    });

    it('suppresses all when level is silent', () => {
      setLogLevel('silent');
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = createLogger('ns');
      logger.debug('a');
      logger.info('b');
      logger.warn('c');
      logger.error('d');
      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('JSON mode', () => {
    it('outputs valid JSON with expected fields', () => {
      setJsonMode(true);
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const logger = createLogger('json-ns');
      logger.info('test message', { key: 'value' });
      expect(spy).toHaveBeenCalledOnce();
      const parsed = JSON.parse(spy.mock.calls[0][0] as string);
      expect(parsed.level).toBe('info');
      expect(parsed.namespace).toBe('json-ns');
      expect(parsed.message).toBe('test message');
      expect(parsed.key).toBe('value');
      expect(parsed.timestamp).toBeDefined();
    });

    it('includes timestamp as ISO string', () => {
      setJsonMode(true);
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = createLogger('ts');
      logger.error('err');
      const parsed = JSON.parse(spy.mock.calls[0][0] as string);
      expect(() => new Date(parsed.timestamp)).not.toThrow();
      expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
    });
  });
});
