import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPServerManager } from '../server-manager.js';
import { MCPClient } from '../client.js';

// Mock MCPClient
vi.mock('../client.js', () => {
  const MockMCPClient = vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue({
      name: 'test-server',
      version: '1.0.0',
      capabilities: { tools: true, resources: false, prompts: false },
    }),
    disconnect: vi.fn().mockResolvedValue(undefined),
    disconnectAll: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    listTools: vi.fn().mockReturnValue([
      {
        server: 'test-server',
        tool: {
          name: 'test_tool',
          description: 'A test tool',
          inputSchema: { type: 'object', properties: {} },
        },
      },
    ]),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'tool result' }],
      isError: false,
    }),
  }));

  return { MCPClient: MockMCPClient };
});

describe('MCPServerManager', () => {
  let manager: MCPServerManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new MCPServerManager();
  });

  it('should start with no connections', () => {
    const status = manager.getStatus();
    expect(status).toEqual([]);
  });

  it('should add a server via addServer', async () => {
    const info = await manager.addServer({
      name: 'test-server',
      command: 'echo',
      args: [],
      transport: 'stdio',
    });

    expect(info.name).toBe('test-server');
    expect(info.version).toBe('1.0.0');
  });

  it('should connect from config via startAll', async () => {
    await manager.startAll([
      { name: 'server1', command: 'echo', args: [], transport: 'stdio' },
      { name: 'server2', command: 'echo', args: [], transport: 'stdio' },
    ]);

    const status = manager.getStatus();
    expect(status).toHaveLength(2);
    expect(status[0].name).toBe('server1');
    expect(status[1].name).toBe('server2');
  });

  it('should aggregate tools from all servers', async () => {
    await manager.addServer({
      name: 'test-server',
      command: 'echo',
      args: [],
      transport: 'stdio',
    });

    const tools = manager.getAllTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('test_tool');
  });

  it('should report server status', async () => {
    await manager.addServer({
      name: 'test-server',
      command: 'echo',
      args: [],
      transport: 'stdio',
    });

    const status = manager.getStatus();
    expect(status).toHaveLength(1);
    expect(status[0]).toEqual({
      name: 'test-server',
      connected: true,
      tools: 1,
    });
  });

  it('should call tool on a specific server', async () => {
    await manager.addServer({
      name: 'test-server',
      command: 'echo',
      args: [],
      transport: 'stdio',
    });

    const result = await manager.callTool('test-server', 'test_tool', { input: 'hello' });
    expect(result).toEqual({
      content: [{ type: 'text', text: 'tool result' }],
      isError: false,
    });
  });

  it('should restart a server', async () => {
    await manager.addServer({
      name: 'test-server',
      command: 'echo',
      args: [],
      transport: 'stdio',
    });

    await expect(manager.restart('test-server')).resolves.not.toThrow();

    const client = manager.getUnderlyingClient();
    expect(client.disconnect).toHaveBeenCalledWith('test-server');
    expect(client.connect).toHaveBeenCalledTimes(2);
  });

  it('should throw on restart of unknown server', async () => {
    await expect(manager.restart('unknown')).rejects.toThrow(
      'No config found for server "unknown"',
    );
  });

  it('should remove a server', async () => {
    await manager.addServer({
      name: 'test-server',
      command: 'echo',
      args: [],
      transport: 'stdio',
    });

    await manager.removeServer('test-server');
    const status = manager.getStatus();
    expect(status).toHaveLength(0);
  });

  it('should shutdown all servers', async () => {
    await manager.addServer({
      name: 'test-server',
      command: 'echo',
      args: [],
      transport: 'stdio',
    });

    await manager.stopAll();
    const client = manager.getUnderlyingClient();
    expect(client.disconnectAll).toHaveBeenCalled();
  });

  it('should return undefined for disconnected server client', () => {
    // Mock isConnected to return false for unknown servers
    const client = manager.getUnderlyingClient();
    (client.isConnected as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const result = manager.getClient('nonexistent');
    expect(result).toBeUndefined();
  });

  it('should handle connectFromConfig with failed servers gracefully', async () => {
    const mockClient = manager.getUnderlyingClient();
    (mockClient.connect as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ name: 'server1', version: '1.0', capabilities: {} })
      .mockRejectedValueOnce(new Error('Connection refused'));

    await expect(
      manager.connectFromConfig([
        { name: 'server1', command: 'echo', args: [], transport: 'stdio' },
        { name: 'server2', command: 'bad', args: [], transport: 'stdio' },
      ]),
    ).resolves.not.toThrow();
  });
});
