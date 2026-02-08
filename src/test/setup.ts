import { vi } from 'vitest';

const vscode = {
  Range: class {
    constructor(public startLine: number, public startChar: number, public endLine: number, public endChar: number) {}
    get start() { return { line: this.startLine, character: this.startChar }; }
    get end() { return { line: this.endLine, character: this.endChar }; }
    contains(position: any) {
      if (position.line < this.startLine || position.line > this.endLine) return false;
      if (position.line === this.startLine && position.character < this.startChar) return false;
      if (position.line === this.endLine && position.character > this.endChar) return false;
      return true;
    }
  },
  Position: class {
    constructor(public line: number, public character: number) {}
    translate(lineDelta: number = 0, characterDelta: number = 0) {
      return new vscode.Position(this.line + lineDelta, this.character + characterDelta);
    }
  },
  CompletionItem: class {
    range?: any;
    constructor(public label: string, public kind: any) {}
  },
  CompletionItemKind: {
    Keyword: 13,
    Function: 2,
    Variable: 5,
    Module: 8,
    Type: 21,
    Constant: 20
  },
  SemanticTokens: class {
    constructor(public data: Uint32Array) {}
  },
  Uri: {
    file: (path: string) => ({
      toString: () => `file://${path}`,
      fsPath: path,
      scheme: 'file'
    }),
    parse: (uri: string) => ({
      toString: () => uri,
      scheme: uri.split(':')[0]
    })
  },
  DiagnosticSeverity: {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3
  },
  Diagnostic: class {
    constructor(public range: any, public message: string, public severity: any) {}
  },
  SemanticTokensBuilder: class {
    tokens: any[] = [];
    push(range: any, type: string, modifiers?: string[]) {
      this.tokens.push({ range, type, modifiers });
    }
    build() { return { data: this.tokens }; }
  },
  SemanticTokensLegend: class {
    constructor(public tokenTypes: string[], public tokenModifiers: string[]) {}
  },
  EventEmitter: class {
    event = vi.fn();
    fire = vi.fn();
  },
  workspace: {
    textDocuments: [],
    onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    onDidOpenTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    createFileSystemWatcher: () => ({
      onDidChange: vi.fn(),
      onDidCreate: vi.fn(),
      onDidDelete: vi.fn(),
      dispose: vi.fn()
    }),
    findFiles: async () => []
  }
};

vi.mock('vscode', () => vscode);
