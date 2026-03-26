export { ProjectDetector } from './project-detector.js';
export type { ProjectInfo } from './project-detector.js';
export { RepoMap } from './repo-map.js';
export type { RepoMapOptions } from './repo-map.js';

// Tree-sitter based code intelligence
export { CodeParser, CodeIndexer } from './tree-sitter/index.js';
export type {
  ParsedFile,
  CodeSymbol,
  ImportInfo,
  ExportInfo,
  ClassInfo,
  FunctionInfo,
  IndexOptions,
  CodeIndex,
  Reference,
  ProjectStructure,
} from './tree-sitter/index.js';

// LSP client integration
export { LSPClient, LSPManager } from './lsp/index.js';
export type {
  LSPClientOptions,
  Location,
  Position,
  CompletionItem,
  Diagnostic,
  DocumentSymbol,
} from './lsp/index.js';
