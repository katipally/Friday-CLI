import { describe, it, expect } from 'vitest';
import {
  FridayError,
  ProviderError,
  ToolError,
  ConfigError,
  PermissionError,
  BudgetExceededError,
  ContextOverflowError,
} from '../errors.js';

describe('FridayError', () => {
  it('sets name, message, and code', () => {
    const err = new FridayError('something broke', 'SOME_CODE');
    expect(err.name).toBe('FridayError');
    expect(err.message).toBe('something broke');
    expect(err.code).toBe('SOME_CODE');
  });

  it('stores optional details', () => {
    const err = new FridayError('msg', 'CODE', { extra: true });
    expect(err.details).toEqual({ extra: true });
  });

  it('is an instance of Error', () => {
    const err = new FridayError('msg', 'CODE');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('ProviderError', () => {
  it('sets name and provider', () => {
    const err = new ProviderError('api fail', 'openai', 429);
    expect(err.name).toBe('ProviderError');
    expect(err.provider).toBe('openai');
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('PROVIDER_ERROR');
  });

  it('inherits from FridayError', () => {
    const err = new ProviderError('fail', 'anthropic');
    expect(err).toBeInstanceOf(FridayError);
    expect(err).toBeInstanceOf(Error);
  });

  it('merges details with provider and statusCode', () => {
    const err = new ProviderError('fail', 'openai', 500, { retryable: true });
    expect(err.details).toEqual({
      provider: 'openai',
      statusCode: 500,
      retryable: true,
    });
  });
});

describe('ToolError', () => {
  it('sets name, tool, and code', () => {
    const err = new ToolError('exec failed', 'bash');
    expect(err.name).toBe('ToolError');
    expect(err.tool).toBe('bash');
    expect(err.code).toBe('TOOL_ERROR');
  });

  it('inherits from FridayError', () => {
    expect(new ToolError('msg', 'tool')).toBeInstanceOf(FridayError);
  });

  it('merges details with tool', () => {
    const err = new ToolError('msg', 'bash', { exitCode: 1 });
    expect(err.details).toEqual({ tool: 'bash', exitCode: 1 });
  });
});

describe('ConfigError', () => {
  it('sets name and code', () => {
    const err = new ConfigError('missing field');
    expect(err.name).toBe('ConfigError');
    expect(err.code).toBe('CONFIG_ERROR');
    expect(err.message).toBe('missing field');
  });

  it('inherits from FridayError', () => {
    expect(new ConfigError('msg')).toBeInstanceOf(FridayError);
  });
});

describe('PermissionError', () => {
  it('sets name, tool, action, and code', () => {
    const err = new PermissionError('denied', 'bash', 'execute');
    expect(err.name).toBe('PermissionError');
    expect(err.tool).toBe('bash');
    expect(err.action).toBe('execute');
    expect(err.code).toBe('PERMISSION_ERROR');
  });

  it('inherits from FridayError', () => {
    expect(new PermissionError('msg', 't', 'a')).toBeInstanceOf(FridayError);
  });

  it('merges details with tool and action', () => {
    const err = new PermissionError('msg', 'fs', 'write', { path: '/etc' });
    expect(err.details).toEqual({ tool: 'fs', action: 'write', path: '/etc' });
  });
});

describe('BudgetExceededError', () => {
  it('sets name, code, currentCost, and budget', () => {
    const err = new BudgetExceededError(1.5, 1.0);
    expect(err.name).toBe('BudgetExceededError');
    expect(err.code).toBe('BUDGET_EXCEEDED');
    expect(err.currentCost).toBe(1.5);
    expect(err.budget).toBe(1.0);
  });

  it('builds a descriptive message', () => {
    const err = new BudgetExceededError(0.1234, 0.1);
    expect(err.message).toContain('$0.1234');
    expect(err.message).toContain('$0.10');
  });

  it('inherits from FridayError', () => {
    expect(new BudgetExceededError(1, 0.5)).toBeInstanceOf(FridayError);
  });
});

describe('ContextOverflowError', () => {
  it('sets name, code, tokenCount, and maxTokens', () => {
    const err = new ContextOverflowError(200000, 128000);
    expect(err.name).toBe('ContextOverflowError');
    expect(err.code).toBe('CONTEXT_OVERFLOW');
    expect(err.tokenCount).toBe(200000);
    expect(err.maxTokens).toBe(128000);
  });

  it('builds a descriptive message', () => {
    const err = new ContextOverflowError(200000, 128000);
    expect(err.message).toContain('200000');
    expect(err.message).toContain('128000');
  });

  it('inherits from FridayError', () => {
    expect(new ContextOverflowError(1, 1)).toBeInstanceOf(FridayError);
  });
});
