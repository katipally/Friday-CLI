import { LSPClient, type LSPClientOptions } from './lsp-client.js';

interface ServerConfig {
  command: string;
  args: string[];
}

const SERVER_CONFIGS: Record<string, ServerConfig> = {
  typescript: { command: 'typescript-language-server', args: ['--stdio'] },
  javascript: { command: 'typescript-language-server', args: ['--stdio'] },
  typescriptreact: { command: 'typescript-language-server', args: ['--stdio'] },
  javascriptreact: { command: 'typescript-language-server', args: ['--stdio'] },
  python: { command: 'pylsp', args: [] },
  go: { command: 'gopls', args: [] },
  rust: { command: 'rust-analyzer', args: [] },
};

export class LSPManager {
  private readonly clients = new Map<string, LSPClient>();
  private readonly rootUri: string;

  constructor(rootUri: string) {
    this.rootUri = rootUri;
  }

  getServerConfig(language: string): LSPClientOptions | null {
    const config = SERVER_CONFIGS[language];
    if (!config) return null;

    return {
      command: config.command,
      args: config.args,
      rootUri: this.rootUri,
      language,
    };
  }

  async getClient(language: string): Promise<LSPClient | null> {
    const existing = this.clients.get(language);
    if (existing?.isRunning()) return existing;

    // Remove stale client if it stopped
    if (existing && !existing.isRunning()) {
      this.clients.delete(language);
    }

    const config = this.getServerConfig(language);
    if (!config) return null;

    const client = new LSPClient(config);

    try {
      await client.start();
      this.clients.set(language, client);
      return client;
    } catch {
      // Language server not installed or failed to start
      return null;
    }
  }

  async stopAll(): Promise<void> {
    const stops = Array.from(this.clients.values()).map((client) =>
      client.stop().catch(() => {
        // Ignore errors during shutdown
      }),
    );
    await Promise.all(stops);
    this.clients.clear();
  }

  getActiveClients(): Map<string, LSPClient> {
    return new Map(this.clients);
  }
}
