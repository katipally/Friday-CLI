import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

// ── Public interfaces ──────────────────────────────────────────────

export interface ParsedFile {
  filePath: string;
  language: string;
  symbols: CodeSymbol[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  classes: ClassInfo[];
  functions: FunctionInfo[];
}

export interface CodeSymbol {
  name: string;
  kind:
    | 'class'
    | 'function'
    | 'method'
    | 'variable'
    | 'interface'
    | 'type'
    | 'enum'
    | 'constant';
  startLine: number;
  endLine: number;
  parent?: string;
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  line: number;
}

export interface ExportInfo {
  name: string;
  kind: string;
  line: number;
}

export interface ClassInfo {
  name: string;
  methods: string[];
  properties: string[];
  extends?: string;
  implements?: string[];
  startLine: number;
  endLine: number;
}

export interface FunctionInfo {
  name: string;
  params: string[];
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
  startLine: number;
  endLine: number;
}

// ── Extension → language mapping ───────────────────────────────────

const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
};

const SUPPORTED_LANGUAGES = [...new Set(Object.values(EXTENSION_MAP))];

// ── CodeParser ─────────────────────────────────────────────────────

export class CodeParser {
  private initialized = false;

  /** Initialise the parser (loads WASM when available). */
  async initialize(): Promise<void> {
    // web-tree-sitter WASM grammars require runtime .wasm files that are
    // rarely bundled.  We initialise as a no-op and rely on the regex-based
    // extraction which works out of the box for all supported languages.
    this.initialized = true;
  }

  /** Parse a file on disk. */
  async parseFile(filePath: string, content?: string): Promise<ParsedFile> {
    if (!this.initialized) await this.initialize();

    const language = this.detectLanguage(filePath);
    if (!language) {
      return emptyParsedFile(filePath, 'unknown');
    }

    const source = content ?? (await readFile(filePath, 'utf-8'));
    return this.extractSymbols(source, language, filePath);
  }

  /** Parse an in-memory string. */
  async parseContent(content: string, language: string): Promise<ParsedFile> {
    if (!this.initialized) await this.initialize();
    return this.extractSymbols(content, language, '<string>');
  }

  /** Languages this parser can handle. */
  getSupportedLanguages(): string[] {
    return [...SUPPORTED_LANGUAGES];
  }

  /** Detect language from a file extension; returns `null` for unknowns. */
  detectLanguage(filePath: string): string | null {
    return EXTENSION_MAP[extname(filePath)] ?? null;
  }

  // ── Private: regex-based extraction ──────────────────────────────

  private extractSymbols(
    content: string,
    language: string,
    filePath: string,
  ): ParsedFile {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return this.extractTS(content, filePath, language);
      case 'python':
        return this.extractPython(content, filePath);
      case 'go':
        return this.extractGo(content, filePath);
      case 'rust':
        return this.extractRust(content, filePath);
      default:
        return emptyParsedFile(filePath, language);
    }
  }

  // ── TypeScript / JavaScript ──────────────────────────────────────

  private extractTS(
    content: string,
    filePath: string,
    language: string,
  ): ParsedFile {
    const lines = content.split('\n');
    const symbols: CodeSymbol[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
    const classes: ClassInfo[] = [];
    const functions: FunctionInfo[] = [];

    // Track current class context for methods
    let currentClass: ClassInfo | null = null;
    let classBraceDepth = 0;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Count braces for class scope tracking
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }

      if (currentClass && braceDepth < classBraceDepth) {
        currentClass.endLine = lineNum;
        currentClass = null;
      }

      // ── Imports ────────────────────────────────────────────────
      const importMatch = line.match(
        /import\s+(?:type\s+)?(?:\{([^}]+)\}|(\*\s+as\s+\w+)|(\w+))\s+from\s+['"]([^'"]+)['"]/,
      );
      if (importMatch) {
        const specStr = importMatch[1] ?? importMatch[2] ?? importMatch[3] ?? '';
        const specifiers = specStr
          .split(',')
          .map((s) => s.trim().replace(/\s+as\s+\w+/, ''))
          .filter(Boolean);
        imports.push({ source: importMatch[4], specifiers, line: lineNum });
        continue;
      }

      // ── Exports (named) ────────────────────────────────────────
      const exportMatch = line.match(
        /export\s+(?:default\s+)?(class|function|const|let|var|interface|type|enum|abstract\s+class)\s+(\w+)/,
      );
      if (exportMatch) {
        exports.push({
          name: exportMatch[2],
          kind: exportMatch[1].replace('abstract ', ''),
          line: lineNum,
        });
      }

      // ── Classes ────────────────────────────────────────────────
      const classMatch = line.match(
        /(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/,
      );
      if (classMatch) {
        const cls: ClassInfo = {
          name: classMatch[1],
          methods: [],
          properties: [],
          extends: classMatch[2] ?? undefined,
          implements: classMatch[3]
            ? classMatch[3].split(',').map((s) => s.trim())
            : undefined,
          startLine: lineNum,
          endLine: lineNum, // updated when closing brace found
        };
        classes.push(cls);
        currentClass = cls;
        classBraceDepth = braceDepth;
        symbols.push({
          name: cls.name,
          kind: 'class',
          startLine: lineNum,
          endLine: lineNum,
        });
        continue;
      }

      // ── Interfaces ─────────────────────────────────────────────
      const ifaceMatch = line.match(
        /(?:export\s+)?interface\s+(\w+)/,
      );
      if (ifaceMatch) {
        symbols.push({
          name: ifaceMatch[1],
          kind: 'interface',
          startLine: lineNum,
          endLine: lineNum,
        });
        continue;
      }

      // ── Type aliases ───────────────────────────────────────────
      const typeMatch = line.match(
        /(?:export\s+)?type\s+(\w+)\s*[=<]/,
      );
      if (typeMatch) {
        symbols.push({
          name: typeMatch[1],
          kind: 'type',
          startLine: lineNum,
          endLine: lineNum,
        });
        continue;
      }

      // ── Enums ──────────────────────────────────────────────────
      const enumMatch = line.match(
        /(?:export\s+)?(?:const\s+)?enum\s+(\w+)/,
      );
      if (enumMatch) {
        symbols.push({
          name: enumMatch[1],
          kind: 'enum',
          startLine: lineNum,
          endLine: lineNum,
        });
        continue;
      }

      // ── Function declarations ──────────────────────────────────
      const funcMatch = line.match(
        /(?:export\s+)?(?:default\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/,
      );
      if (funcMatch) {
        const isExported = /export\s/.test(line);
        const params = parseParams(funcMatch[3]);
        const returnType = extractReturnType(line);
        const fn: FunctionInfo = {
          name: funcMatch[2],
          params,
          returnType,
          isAsync: !!funcMatch[1],
          isExported,
          startLine: lineNum,
          endLine: lineNum,
        };
        functions.push(fn);
        symbols.push({
          name: fn.name,
          kind: 'function',
          startLine: lineNum,
          endLine: lineNum,
        });
        continue;
      }

      // ── Arrow functions / const fn ─────────────────────────────
      const arrowMatch = line.match(
        /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*\w[^=]*)?\s*=\s*(async\s+)?(?:\([^)]*\)|[^=])\s*=>/,
      );
      if (arrowMatch) {
        const isExported = /export\s/.test(line);
        const fn: FunctionInfo = {
          name: arrowMatch[1],
          params: [],
          isAsync: !!arrowMatch[2],
          isExported,
          startLine: lineNum,
          endLine: lineNum,
        };
        functions.push(fn);
        symbols.push({
          name: fn.name,
          kind: 'function',
          startLine: lineNum,
          endLine: lineNum,
        });
        continue;
      }

      // ── Class methods (inside a class body) ────────────────────
      if (currentClass) {
        const methodMatch = line.match(
          /^\s+(?:(?:public|private|protected|static|readonly|abstract|override)\s+)*(async\s+)?(\w+)\s*\(/,
        );
        if (methodMatch && methodMatch[2] !== 'if' && methodMatch[2] !== 'for' && methodMatch[2] !== 'while' && methodMatch[2] !== 'switch') {
          currentClass.methods.push(methodMatch[2]);
          symbols.push({
            name: methodMatch[2],
            kind: 'method',
            startLine: lineNum,
            endLine: lineNum,
            parent: currentClass.name,
          });
          continue;
        }

        // Properties
        const propMatch = line.match(
          /^\s+(?:(?:public|private|protected|static|readonly|abstract|override|declare)\s+)*(\w+)\s*[?!]?\s*:/,
        );
        if (propMatch && !line.includes('(')) {
          currentClass.properties.push(propMatch[1]);
          symbols.push({
            name: propMatch[1],
            kind: 'variable',
            startLine: lineNum,
            endLine: lineNum,
            parent: currentClass.name,
          });
        }
      }

      // ── Top-level constants ────────────────────────────────────
      if (!currentClass) {
        const constMatch = line.match(
          /(?:export\s+)?const\s+([A-Z][A-Z_0-9]+)\s*[=:]/,
        );
        if (constMatch) {
          symbols.push({
            name: constMatch[1],
            kind: 'constant',
            startLine: lineNum,
            endLine: lineNum,
          });
        }
      }
    }

    return { filePath, language, symbols, imports, exports, classes, functions };
  }

  // ── Python ───────────────────────────────────────────────────────

  private extractPython(content: string, filePath: string): ParsedFile {
    const lines = content.split('\n');
    const symbols: CodeSymbol[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
    const classes: ClassInfo[] = [];
    const functions: FunctionInfo[] = [];

    let currentClass: ClassInfo | null = null;
    let classIndent = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const indent = line.search(/\S/);

      // Reset class context when indent decreases
      if (currentClass && indent !== -1 && indent <= classIndent) {
        currentClass.endLine = lineNum - 1;
        currentClass = null;
      }

      // ── Imports ────────────────────────────────────────────────
      const fromImport = line.match(
        /^from\s+(\S+)\s+import\s+(.+)/,
      );
      if (fromImport) {
        const specifiers = fromImport[2]
          .split(',')
          .map((s) => s.trim().replace(/\s+as\s+\w+/, ''))
          .filter(Boolean);
        imports.push({ source: fromImport[1], specifiers, line: lineNum });
        continue;
      }

      const plainImport = line.match(/^import\s+(\S+)/);
      if (plainImport) {
        imports.push({
          source: plainImport[1].replace(/,.*/, ''),
          specifiers: [],
          line: lineNum,
        });
        continue;
      }

      // ── Classes ────────────────────────────────────────────────
      const classMatch = line.match(
        /^(\s*)class\s+(\w+)(?:\(([^)]*)\))?/,
      );
      if (classMatch) {
        const bases = classMatch[3]
          ? classMatch[3].split(',').map((s) => s.trim())
          : [];
        const cls: ClassInfo = {
          name: classMatch[2],
          methods: [],
          properties: [],
          extends: bases[0] ?? undefined,
          implements: bases.length > 1 ? bases.slice(1) : undefined,
          startLine: lineNum,
          endLine: lineNum,
        };
        classes.push(cls);
        currentClass = cls;
        classIndent = classMatch[1].length;
        symbols.push({
          name: cls.name,
          kind: 'class',
          startLine: lineNum,
          endLine: lineNum,
        });
        continue;
      }

      // ── Functions / methods ────────────────────────────────────
      const funcMatch = line.match(
        /^(\s*)(async\s+)?def\s+(\w+)\s*\(([^)]*)\)/,
      );
      if (funcMatch) {
        const funcIndent = funcMatch[1].length;
        const isMethod = currentClass && funcIndent > classIndent;
        const name = funcMatch[3];
        const params = parseParams(funcMatch[4]);
        const isAsync = !!funcMatch[2];

        if (isMethod && currentClass) {
          currentClass.methods.push(name);
          symbols.push({
            name,
            kind: 'method',
            startLine: lineNum,
            endLine: lineNum,
            parent: currentClass.name,
          });
        } else {
          const fn: FunctionInfo = {
            name,
            params,
            isAsync,
            isExported: true, // Python top-level functions are public
            startLine: lineNum,
            endLine: lineNum,
          };
          functions.push(fn);
          symbols.push({
            name,
            kind: 'function',
            startLine: lineNum,
            endLine: lineNum,
          });
        }
        continue;
      }

      // ── Constants (UPPER_CASE = ...) ───────────────────────────
      if (!currentClass) {
        const constMatch = line.match(/^([A-Z][A-Z_0-9]+)\s*=/);
        if (constMatch) {
          symbols.push({
            name: constMatch[1],
            kind: 'constant',
            startLine: lineNum,
            endLine: lineNum,
          });
        }
      }
    }

    return { filePath, language: 'python', symbols, imports, exports, classes, functions };
  }

  // ── Go ───────────────────────────────────────────────────────────

  private extractGo(content: string, filePath: string): ParsedFile {
    const lines = content.split('\n');
    const symbols: CodeSymbol[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
    const classes: ClassInfo[] = []; // structs
    const functions: FunctionInfo[] = [];

    let inImportBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // ── Imports ────────────────────────────────────────────────
      if (/^\s*import\s+\(/.test(line)) {
        inImportBlock = true;
        continue;
      }
      if (inImportBlock) {
        if (/^\s*\)/.test(line)) {
          inImportBlock = false;
          continue;
        }
        const impMatch = line.match(/^\s*(?:\w+\s+)?"([^"]+)"/);
        if (impMatch) {
          imports.push({ source: impMatch[1], specifiers: [], line: lineNum });
        }
        continue;
      }

      const singleImport = line.match(/^import\s+(?:\w+\s+)?"([^"]+)"/);
      if (singleImport) {
        imports.push({ source: singleImport[1], specifiers: [], line: lineNum });
        continue;
      }

      // ── Structs (treated as classes) ───────────────────────────
      const structMatch = line.match(/^type\s+(\w+)\s+struct\b/);
      if (structMatch) {
        const cls: ClassInfo = {
          name: structMatch[1],
          methods: [],
          properties: [],
          startLine: lineNum,
          endLine: lineNum,
        };
        classes.push(cls);
        symbols.push({
          name: structMatch[1],
          kind: 'class',
          startLine: lineNum,
          endLine: lineNum,
        });
        const isExported = /^[A-Z]/.test(structMatch[1]);
        if (isExported) {
          exports.push({ name: structMatch[1], kind: 'struct', line: lineNum });
        }
        continue;
      }

      // ── Interfaces ─────────────────────────────────────────────
      const ifaceMatch = line.match(/^type\s+(\w+)\s+interface\b/);
      if (ifaceMatch) {
        symbols.push({
          name: ifaceMatch[1],
          kind: 'interface',
          startLine: lineNum,
          endLine: lineNum,
        });
        if (/^[A-Z]/.test(ifaceMatch[1])) {
          exports.push({ name: ifaceMatch[1], kind: 'interface', line: lineNum });
        }
        continue;
      }

      // ── Type aliases ───────────────────────────────────────────
      const typeMatch = line.match(/^type\s+(\w+)\s+(?!struct\b|interface\b)(\w+)/);
      if (typeMatch) {
        symbols.push({
          name: typeMatch[1],
          kind: 'type',
          startLine: lineNum,
          endLine: lineNum,
        });
        continue;
      }

      // ── Methods (func (receiver) Name(...)) ────────────────────
      const methodMatch = line.match(
        /^func\s+\(\s*\w+\s+\*?(\w+)\s*\)\s+(\w+)\s*\(([^)]*)\)/,
      );
      if (methodMatch) {
        const receiverType = methodMatch[1];
        const name = methodMatch[2];
        const params = parseParams(methodMatch[3]);
        // Attach to the struct
        const cls = classes.find((c) => c.name === receiverType);
        if (cls) cls.methods.push(name);
        symbols.push({
          name,
          kind: 'method',
          startLine: lineNum,
          endLine: lineNum,
          parent: receiverType,
        });
        if (/^[A-Z]/.test(name)) {
          exports.push({ name, kind: 'method', line: lineNum });
        }
        continue;
      }

      // ── Functions ──────────────────────────────────────────────
      const funcMatch = line.match(/^func\s+(\w+)\s*\(([^)]*)\)/);
      if (funcMatch) {
        const name = funcMatch[1];
        const params = parseParams(funcMatch[2]);
        const returnType = extractGoReturnType(line);
        const isExported = /^[A-Z]/.test(name);
        const fn: FunctionInfo = {
          name,
          params,
          returnType,
          isAsync: false,
          isExported,
          startLine: lineNum,
          endLine: lineNum,
        };
        functions.push(fn);
        symbols.push({
          name,
          kind: 'function',
          startLine: lineNum,
          endLine: lineNum,
        });
        if (isExported) {
          exports.push({ name, kind: 'function', line: lineNum });
        }
        continue;
      }

      // ── Constants / vars ───────────────────────────────────────
      const constMatch = line.match(/^(?:const|var)\s+(\w+)\s/);
      if (constMatch) {
        const kind = line.startsWith('const') ? 'constant' as const : 'variable' as const;
        symbols.push({
          name: constMatch[1],
          kind,
          startLine: lineNum,
          endLine: lineNum,
        });
      }
    }

    return { filePath, language: 'go', symbols, imports, exports, classes, functions };
  }

  // ── Rust ─────────────────────────────────────────────────────────

  private extractRust(content: string, filePath: string): ParsedFile {
    const lines = content.split('\n');
    const symbols: CodeSymbol[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
    const classes: ClassInfo[] = []; // structs
    const functions: FunctionInfo[] = [];

    let currentImpl: string | null = null;
    let implBraceDepth = 0;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Track brace depth for impl blocks
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }

      if (currentImpl && braceDepth < implBraceDepth) {
        currentImpl = null;
      }

      // ── Use statements ─────────────────────────────────────────
      const useMatch = line.match(/^use\s+(.+);/);
      if (useMatch) {
        const source = useMatch[1].replace(/::\{[^}]+\}/, '');
        const specMatch = useMatch[1].match(/::\{([^}]+)\}/);
        const specifiers = specMatch
          ? specMatch[1].split(',').map((s) => s.trim())
          : [];
        imports.push({ source, specifiers, line: lineNum });
        continue;
      }

      // ── Structs ────────────────────────────────────────────────
      const structMatch = line.match(/^(?:pub(?:\([^)]*\))?\s+)?struct\s+(\w+)/);
      if (structMatch) {
        const cls: ClassInfo = {
          name: structMatch[1],
          methods: [],
          properties: [],
          startLine: lineNum,
          endLine: lineNum,
        };
        classes.push(cls);
        symbols.push({
          name: structMatch[1],
          kind: 'class',
          startLine: lineNum,
          endLine: lineNum,
        });
        if (/^pub\b/.test(line)) {
          exports.push({ name: structMatch[1], kind: 'struct', line: lineNum });
        }
        continue;
      }

      // ── Enums ──────────────────────────────────────────────────
      const enumMatch = line.match(/^(?:pub(?:\([^)]*\))?\s+)?enum\s+(\w+)/);
      if (enumMatch) {
        symbols.push({
          name: enumMatch[1],
          kind: 'enum',
          startLine: lineNum,
          endLine: lineNum,
        });
        if (/^pub\b/.test(line)) {
          exports.push({ name: enumMatch[1], kind: 'enum', line: lineNum });
        }
        continue;
      }

      // ── Traits (interface-like) ────────────────────────────────
      const traitMatch = line.match(/^(?:pub(?:\([^)]*\))?\s+)?trait\s+(\w+)/);
      if (traitMatch) {
        symbols.push({
          name: traitMatch[1],
          kind: 'interface',
          startLine: lineNum,
          endLine: lineNum,
        });
        if (/^pub\b/.test(line)) {
          exports.push({ name: traitMatch[1], kind: 'trait', line: lineNum });
        }
        continue;
      }

      // ── Impl blocks ───────────────────────────────────────────
      const implMatch = line.match(/^impl(?:<[^>]*>)?\s+(?:(\w+)\s+for\s+)?(\w+)/);
      if (implMatch) {
        currentImpl = implMatch[2];
        implBraceDepth = braceDepth;
        continue;
      }

      // ── Functions / methods ────────────────────────────────────
      const fnMatch = line.match(
        /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:const\s+)?(?:unsafe\s+)?(async\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/,
      );
      if (fnMatch) {
        const name = fnMatch[2];
        const params = parseParams(fnMatch[3]);
        const isAsync = !!fnMatch[1];
        const isExported = /pub\b/.test(line);
        const returnType = extractRustReturnType(line);

        if (currentImpl) {
          const cls = classes.find((c) => c.name === currentImpl);
          if (cls) cls.methods.push(name);
          symbols.push({
            name,
            kind: 'method',
            startLine: lineNum,
            endLine: lineNum,
            parent: currentImpl,
          });
        } else {
          const fn: FunctionInfo = {
            name,
            params,
            returnType,
            isAsync,
            isExported,
            startLine: lineNum,
            endLine: lineNum,
          };
          functions.push(fn);
          symbols.push({
            name,
            kind: 'function',
            startLine: lineNum,
            endLine: lineNum,
          });
        }

        if (isExported) {
          exports.push({ name, kind: 'function', line: lineNum });
        }
        continue;
      }

      // ── Constants / statics ────────────────────────────────────
      const constMatch = line.match(
        /^(?:pub(?:\([^)]*\))?\s+)?(?:const|static)\s+(\w+)\s*:/,
      );
      if (constMatch) {
        symbols.push({
          name: constMatch[1],
          kind: 'constant',
          startLine: lineNum,
          endLine: lineNum,
        });
      }
    }

    return { filePath, language: 'rust', symbols, imports, exports, classes, functions };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function emptyParsedFile(filePath: string, language: string): ParsedFile {
  return {
    filePath,
    language,
    symbols: [],
    imports: [],
    exports: [],
    classes: [],
    functions: [],
  };
}

function parseParams(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(',')
    .map((p) => p.trim().split(/\s*:\s*/)[0].replace(/^\.{3}/, ''))
    .filter(Boolean);
}

function extractReturnType(line: string): string | undefined {
  const match = line.match(/\)\s*:\s*([^{]+)/);
  return match ? match[1].trim() : undefined;
}

function extractGoReturnType(line: string): string | undefined {
  const match = line.match(/\)\s+(\(?\w[^{]*)\s*\{/);
  return match ? match[1].trim() : undefined;
}

function extractRustReturnType(line: string): string | undefined {
  const match = line.match(/->\s*([^{]+)/);
  return match ? match[1].trim() : undefined;
}
