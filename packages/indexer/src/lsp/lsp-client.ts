import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from 'vscode-jsonrpc/node.js';

export interface LSPClientOptions {
  command: string;
  args?: string[];
  rootUri: string;
  language: string;
}

export interface Position {
  line: number;
  character: number;
}

export interface Location {
  uri: string;
  range: { start: Position; end: Position };
}

export interface CompletionItem {
  label: string;
  kind: string;
  detail?: string;
}

export interface Diagnostic {
  range: { start: Position; end: Position };
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source?: string;
}

export interface DocumentSymbol {
  name: string;
  kind: string;
  range: { start: Position; end: Position };
  children?: DocumentSymbol[];
}

function filePathToUri(filePath: string): string {
  if (filePath.startsWith('file://')) return filePath;
  return `file://${filePath}`;
}

const SYMBOL_KIND_MAP: Record<number, string> = {
  1: 'File',
  2: 'Module',
  3: 'Namespace',
  4: 'Package',
  5: 'Class',
  6: 'Method',
  7: 'Property',
  8: 'Field',
  9: 'Constructor',
  10: 'Enum',
  11: 'Interface',
  12: 'Function',
  13: 'Variable',
  14: 'Constant',
  15: 'String',
  16: 'Number',
  17: 'Boolean',
  18: 'Array',
  19: 'Object',
  20: 'Key',
  21: 'Null',
  22: 'EnumMember',
  23: 'Struct',
  24: 'Event',
  25: 'Operator',
  26: 'TypeParameter',
};

const COMPLETION_KIND_MAP: Record<number, string> = {
  1: 'Text',
  2: 'Method',
  3: 'Function',
  4: 'Constructor',
  5: 'Field',
  6: 'Variable',
  7: 'Class',
  8: 'Interface',
  9: 'Module',
  10: 'Property',
  11: 'Unit',
  12: 'Value',
  13: 'Enum',
  14: 'Keyword',
  15: 'Snippet',
  16: 'Color',
  17: 'File',
  18: 'Reference',
  19: 'Folder',
  20: 'EnumMember',
  21: 'Constant',
  22: 'Struct',
  23: 'Event',
  24: 'Operator',
  25: 'TypeParameter',
};

function mapDiagnosticSeverity(
  severity: number | undefined,
): 'error' | 'warning' | 'info' | 'hint' {
  switch (severity) {
    case 1:
      return 'error';
    case 2:
      return 'warning';
    case 3:
      return 'info';
    case 4:
      return 'hint';
    default:
      return 'warning';
  }
}

interface RawDiagnostic {
  range: { start: Position; end: Position };
  severity?: number;
  message: string;
  source?: string;
}

interface RawLocationLink {
  targetUri: string;
  targetRange: { start: Position; end: Position };
  targetSelectionRange: { start: Position; end: Position };
}

interface RawLocation {
  uri: string;
  range: { start: Position; end: Position };
}

interface RawHoverResult {
  contents:
    | string
    | { value: string }
    | Array<string | { value: string }>;
}

interface RawCompletionItem {
  label: string;
  kind?: number;
  detail?: string;
}

interface RawCompletionList {
  items: RawCompletionItem[];
}

interface RawDocumentSymbol {
  name: string;
  kind: number;
  range?: { start: Position; end: Position };
  location?: { range: { start: Position; end: Position } };
  children?: RawDocumentSymbol[];
}

export class LSPClient {
  private process: ChildProcess | null = null;
  private connection: MessageConnection | null = null;
  private running = false;
  private readonly options: LSPClientOptions;
  private readonly diagnosticsMap = new Map<string, Diagnostic[]>();
  private readonly openDocuments = new Set<string>();
  private readonly diagnosticsListeners = new Map<string, Array<() => void>>();

  constructor(options: LSPClientOptions) {
    this.options = options;
  }

  async start(): Promise<void> {
    const proc = spawn(this.options.command, this.options.args ?? [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process = proc;

    // Wait for the process to spawn or fail (e.g. ENOENT)
    await new Promise<void>((resolve, reject) => {
      proc.once('spawn', resolve);
      proc.once('error', (err: Error) => {
        reject(
          new Error(
            `Failed to start language server "${this.options.command}": ${err.message}`,
          ),
        );
      });
    });

    if (!proc.stdout || !proc.stdin) {
      throw new Error(
        `Failed to start language server: stdio not available for "${this.options.command}"`,
      );
    }

    const connection = createMessageConnection(
      new StreamMessageReader(proc.stdout),
      new StreamMessageWriter(proc.stdin),
    );

    // Listen for published diagnostics from the server
    connection.onNotification(
      'textDocument/publishDiagnostics',
      (params: { uri: string; diagnostics: RawDiagnostic[] }) => {
        const diagnostics: Diagnostic[] = params.diagnostics.map((d) => ({
          range: d.range,
          severity: mapDiagnosticSeverity(d.severity),
          message: d.message,
          source: d.source,
        }));
        this.diagnosticsMap.set(params.uri, diagnostics);

        const listeners = this.diagnosticsListeners.get(params.uri);
        if (listeners) {
          for (const resolve of listeners) {
            resolve();
          }
          this.diagnosticsListeners.delete(params.uri);
        }
      },
    );

    connection.listen();

    proc.on('exit', () => {
      this.running = false;
    });

    // LSP initialize handshake
    await connection.sendRequest('initialize', {
      processId: process.pid,
      capabilities: {
        textDocument: {
          definition: { dynamicRegistration: false },
          references: { dynamicRegistration: false },
          hover: {
            dynamicRegistration: false,
            contentFormat: ['plaintext', 'markdown'],
          },
          completion: {
            dynamicRegistration: false,
            completionItem: { snippetSupport: false },
          },
          publishDiagnostics: { relatedInformation: false },
          documentSymbol: {
            dynamicRegistration: false,
            hierarchicalDocumentSymbolSupport: true,
          },
        },
      },
      rootUri: filePathToUri(this.options.rootUri),
      workspaceFolders: [
        { uri: filePathToUri(this.options.rootUri), name: 'workspace' },
      ],
    });

    connection.sendNotification('initialized', {});

    this.connection = connection;
    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.connection || !this.running) return;

    try {
      await this.connection.sendRequest('shutdown');
      this.connection.sendNotification('exit');
    } catch {
      // Server may have already exited
    }

    this.connection.dispose();
    this.connection = null;

    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    this.running = false;
    this.openDocuments.clear();
    this.diagnosticsMap.clear();
    this.diagnosticsListeners.clear();
  }

  isRunning(): boolean {
    return this.running;
  }

  private ensureRunning(): MessageConnection {
    if (!this.connection || !this.running) {
      throw new Error('LSP client is not running');
    }
    return this.connection;
  }

  private openDocument(filePath: string): void {
    const uri = filePathToUri(filePath);
    if (this.openDocuments.has(uri)) return;

    const content = readFileSync(filePath, 'utf-8');
    const conn = this.ensureRunning();

    conn.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId: this.options.language,
        version: 1,
        text: content,
      },
    });

    this.openDocuments.add(uri);
  }

  private normalizeLocations(result: unknown): Location[] {
    if (!result) return [];

    if (Array.isArray(result)) {
      return result.map((item: RawLocation | RawLocationLink) => {
        if ('targetUri' in item) {
          return {
            uri: item.targetUri,
            range: item.targetRange ?? item.targetSelectionRange,
          };
        }
        return { uri: item.uri, range: item.range };
      });
    }

    if (typeof result === 'object' && result !== null) {
      const r = result as RawLocation | RawLocationLink;
      if ('targetUri' in r) {
        return [
          { uri: r.targetUri, range: r.targetRange ?? r.targetSelectionRange },
        ];
      }
      if ('uri' in r) {
        return [{ uri: r.uri, range: r.range }];
      }
    }

    return [];
  }

  async getDefinition(
    filePath: string,
    line: number,
    character: number,
  ): Promise<Location[]> {
    const conn = this.ensureRunning();
    this.openDocument(filePath);

    const result: unknown = await conn.sendRequest('textDocument/definition', {
      textDocument: { uri: filePathToUri(filePath) },
      position: { line, character },
    });

    return this.normalizeLocations(result);
  }

  async getReferences(
    filePath: string,
    line: number,
    character: number,
  ): Promise<Location[]> {
    const conn = this.ensureRunning();
    this.openDocument(filePath);

    const result: unknown = await conn.sendRequest('textDocument/references', {
      textDocument: { uri: filePathToUri(filePath) },
      position: { line, character },
      context: { includeDeclaration: true },
    });

    return this.normalizeLocations(result);
  }

  async getHover(
    filePath: string,
    line: number,
    character: number,
  ): Promise<string | null> {
    const conn = this.ensureRunning();
    this.openDocument(filePath);

    const result: unknown = await conn.sendRequest('textDocument/hover', {
      textDocument: { uri: filePathToUri(filePath) },
      position: { line, character },
    });

    if (!result || typeof result !== 'object') return null;

    const hover = result as RawHoverResult;
    if (!hover.contents) return null;

    const { contents } = hover;
    if (typeof contents === 'string') return contents;
    if (typeof contents === 'object' && !Array.isArray(contents) && 'value' in contents) {
      return contents.value;
    }
    if (Array.isArray(contents)) {
      return contents
        .map((c) => (typeof c === 'string' ? c : c.value))
        .join('\n');
    }

    return null;
  }

  async getCompletions(
    filePath: string,
    line: number,
    character: number,
  ): Promise<CompletionItem[]> {
    const conn = this.ensureRunning();
    this.openDocument(filePath);

    const result: unknown = await conn.sendRequest('textDocument/completion', {
      textDocument: { uri: filePathToUri(filePath) },
      position: { line, character },
    });

    if (!result) return [];

    let items: RawCompletionItem[];
    if (Array.isArray(result)) {
      items = result as RawCompletionItem[];
    } else {
      items = (result as RawCompletionList).items ?? [];
    }

    return items.map((item) => ({
      label: item.label,
      kind: COMPLETION_KIND_MAP[item.kind ?? 0] ?? 'Unknown',
      detail: item.detail,
    }));
  }

  async getDiagnostics(filePath: string): Promise<Diagnostic[]> {
    this.ensureRunning();
    this.openDocument(filePath);

    const uri = filePathToUri(filePath);

    if (this.diagnosticsMap.has(uri)) {
      return this.diagnosticsMap.get(uri)!;
    }

    // Wait briefly for the server to publish diagnostics
    await new Promise<void>((resolve) => {
      const listeners = this.diagnosticsListeners.get(uri) ?? [];
      listeners.push(resolve);
      this.diagnosticsListeners.set(uri, listeners);
      setTimeout(resolve, 2000);
    });

    return this.diagnosticsMap.get(uri) ?? [];
  }

  async getDocumentSymbols(filePath: string): Promise<DocumentSymbol[]> {
    const conn = this.ensureRunning();
    this.openDocument(filePath);

    const result: unknown = await conn.sendRequest(
      'textDocument/documentSymbol',
      { textDocument: { uri: filePathToUri(filePath) } },
    );

    if (!result || !Array.isArray(result)) return [];

    const mapSymbol = (sym: RawDocumentSymbol): DocumentSymbol => ({
      name: sym.name,
      kind: SYMBOL_KIND_MAP[sym.kind] ?? 'Unknown',
      range: sym.range ?? sym.location?.range ?? { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      children: sym.children?.map(mapSymbol),
    });

    return (result as RawDocumentSymbol[]).map(mapSymbol);
  }
}
