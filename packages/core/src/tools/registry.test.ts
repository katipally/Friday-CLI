import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from './registry.js';
import type { Tool, ToolContext, ToolResult } from '@fridaycode/shared';

function mockTool(name: string, readOnly = false): Tool {
  return {
    definition: {
      name,
      description: `Mock ${name} tool`,
      inputSchema: { type: 'object', properties: {}, required: [] },
      requiresPermission: !readOnly,
      isReadOnly: readOnly,
    },
    async execute(): Promise<ToolResult> {
      return { toolCallId: '', content: `${name} executed`, isError: false };
    },
  };
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('should register and retrieve tools', () => {
    const tool = mockTool('TestTool');
    registry.register(tool);
    expect(registry.has('TestTool')).toBe(true);
    expect(registry.get('TestTool')).toBe(tool);
  });

  it('should list registered tool names', () => {
    registry.register(mockTool('Alpha'));
    registry.register(mockTool('Beta'));
    expect(registry.listNames()).toEqual(['Alpha', 'Beta']);
  });

  it('should return tool definitions', () => {
    registry.register(mockTool('Read', true));
    const defs = registry.getDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0].name).toBe('Read');
    expect(defs[0].isReadOnly).toBe(true);
  });

  it('should return undefined for missing tools', () => {
    expect(registry.get('NonExistent')).toBeUndefined();
    expect(registry.has('NonExistent')).toBe(false);
  });

  it('should search tools by query', () => {
    registry.register(mockTool('ReadFile'));
    registry.register(mockTool('WriteFile'));
    registry.register(mockTool('Bash'));
    const results = registry.search('file');
    expect(results.map((t) => t.name)).toEqual(['ReadFile', 'WriteFile']);
  });
});
