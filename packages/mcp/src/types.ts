/**
 * MCP (Model Context Protocol) types for JSON-RPC communication.
 */

/** Configuration for connecting to an MCP server. */
export interface MCPServerConfig {
  name: string;
  /** Command to run for stdio transport. */
  command?: string;
  /** Arguments for the command (stdio transport). */
  args?: string[];
  /** URL for HTTP/SSE transport (not yet implemented). */
  url?: string;
  transport: 'stdio' | 'http-sse';
  /** Environment variables passed to the server process. */
  env?: Record<string, string>;
}

/** A tool exposed by an MCP server. */
export interface MCPTool {
  name: string;
  description: string;
  /** JSON Schema describing the tool's input parameters. */
  inputSchema: Record<string, unknown>;
}

/** Result returned from calling an MCP tool. */
export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/** A JSON-RPC 2.0 request message. */
export interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

/** A JSON-RPC 2.0 response message. */
export interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/** Information about a connected MCP server. */
export interface MCPServerInfo {
  name: string;
  version: string;
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
}
