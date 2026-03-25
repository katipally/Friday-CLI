export class FridayError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'FridayError';
  }
}

export class ProviderError extends FridayError {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number,
    details?: Record<string, unknown>,
  ) {
    super(message, 'PROVIDER_ERROR', { provider, statusCode, ...details });
    this.name = 'ProviderError';
  }
}

export class ToolError extends FridayError {
  constructor(
    message: string,
    public readonly tool: string,
    details?: Record<string, unknown>,
  ) {
    super(message, 'TOOL_ERROR', { tool, ...details });
    this.name = 'ToolError';
  }
}

export class ConfigError extends FridayError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigError';
  }
}

export class PermissionError extends FridayError {
  constructor(
    message: string,
    public readonly tool: string,
    public readonly action: string,
    details?: Record<string, unknown>,
  ) {
    super(message, 'PERMISSION_ERROR', { tool, action, ...details });
    this.name = 'PermissionError';
  }
}

export class BudgetExceededError extends FridayError {
  constructor(
    public readonly currentCost: number,
    public readonly budget: number,
  ) {
    super(
      `Budget exceeded: $${currentCost.toFixed(4)} spent, budget is $${budget.toFixed(2)}`,
      'BUDGET_EXCEEDED',
      { currentCost, budget },
    );
    this.name = 'BudgetExceededError';
  }
}

export class ContextOverflowError extends FridayError {
  constructor(
    public readonly tokenCount: number,
    public readonly maxTokens: number,
  ) {
    super(
      `Context overflow: ${tokenCount} tokens exceeds limit of ${maxTokens}`,
      'CONTEXT_OVERFLOW',
      { tokenCount, maxTokens },
    );
    this.name = 'ContextOverflowError';
  }
}
