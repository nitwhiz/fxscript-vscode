import * as vscode from 'vscode';
import * as fs from 'fs';
import { Lexer } from '../core/Lexer';
import { Parser } from '../core/Parser';
import { SymbolTable, SymbolType, SymbolDefinition } from '../core/SymbolTable';
import { CommandRegistry } from './CommandRegistry';

export class WorkspaceIndexer {
  private symbolTable: SymbolTable;
  private commandRegistry?: CommandRegistry;
  private diagnosticsCollection?: vscode.DiagnosticCollection;
  private disposables: vscode.Disposable[] = [];

  private pendingChanges = new Map<string, NodeJS.Timeout>();

  constructor(symbolTable: SymbolTable, commandRegistry?: CommandRegistry, diagnosticsCollection?: vscode.DiagnosticCollection) {
    this.symbolTable = symbolTable;
    this.commandRegistry = commandRegistry;
    this.diagnosticsCollection = diagnosticsCollection;
    this.watchFiles();
    this.watchDocuments();
    this.indexWorkspace();
  }

  private watchFiles() {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.fx');
    watcher.onDidChange(uri => {
      // If we have the document open, onDidChangeTextDocument will handle it
      if (!vscode.workspace.textDocuments.some(doc => doc.uri.toString() === uri.toString())) {
        this.indexFile(uri);
      }
    });
    watcher.onDidCreate(uri => this.indexFile(uri));
    watcher.onDidDelete(uri => {
      this.symbolTable.clearFileSymbols(uri);
      this.cancelPending(uri);
    });
    this.disposables.push(watcher);
  }

  private watchDocuments() {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.languageId === 'fxscript') {
          this.enqueueIndex(event.document);
        }
      })
    );
  }

  private enqueueIndex(document: vscode.TextDocument) {
    const uriString = document.uri.toString();
    this.cancelPending(document.uri);

    const timeout = setTimeout(() => {
      this.pendingChanges.delete(uriString);
      this.indexDocument(document);
    }, 100); // reduced from 300ms

    this.pendingChanges.set(uriString, timeout);
  }

  private cancelPending(uri: vscode.Uri) {
    const uriString = uri.toString();
    const existing = this.pendingChanges.get(uriString);
    if (existing) {
      clearTimeout(existing);
      this.pendingChanges.delete(uriString);
    }
  }

  public async indexWorkspace() {
    const files = await vscode.workspace.findFiles('**/*.fx');
    for (const file of files) {
      const openDoc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === file.toString());
      if (openDoc) {
        this.indexDocument(openDoc);
      } else {
        await this.indexFile(file);
      }
    }
  }

  private async indexFile(uri: vscode.Uri) {
    try {
      const content = fs.readFileSync(uri.fsPath, 'utf8');
      this.indexContent(uri, content);
    } catch (e) {
      console.error(`Failed to index file: ${uri.fsPath}`, e);
    }
  }

  private indexDocument(document: vscode.TextDocument) {
    this.indexContent(document.uri, document.getText());
  }

  private indexContent(uri: vscode.Uri, content: string) {
    const lexer = new Lexer(content);
    const tokens = lexer.tokenize();

    this.symbolTable.clearFileSymbols(uri);
    
    const parser = new Parser(uri, tokens, this.symbolTable, this.commandRegistry);
    parser.parseSymbols();
    
    const parserDiagnostics = parser.getDiagnostics();
    this.diagnosticsByUriFromParser.set(uri.toString(), parserDiagnostics);

    if (this.diagnosticsCollection) {
      this.diagnosticsCollection.set(uri, parserDiagnostics);
    }

    // Trigger re-validation of all files because symbols might have changed
    this.revalidateAll();
  }

  private onDidChangeSemanticTokensEmitter = new vscode.EventEmitter<void>();
  public onDidChangeSemanticTokens = this.onDidChangeSemanticTokensEmitter.event;

  private diagnosticsByUriFromParser = new Map<string, vscode.Diagnostic[]>();

  private revalidateAll() {
    if (this.pendingRevalidation) {
        clearTimeout(this.pendingRevalidation);
    }
    this.pendingRevalidation = setTimeout(() => {
        this.validateWorkspace();
        this.onDidChangeSemanticTokensEmitter.fire();
    }, 200); // reduced from 500ms
  }

  private pendingRevalidation?: NodeJS.Timeout;

  private validateWorkspace() {
    if (!this.diagnosticsCollection) {
        return;
    }

    const allRefs = this.symbolTable.getAllReferences();
    const diagnosticsByUri = new Map<string, vscode.Diagnostic[]>();

    for (const { name, references } of allRefs) {
        const symbols = this.symbolTable.getSymbols(name);
        const isBuiltIn = ["set", "goto", "call", "ret", "exit", "jumpIf"].includes(name);
        const command = this.commandRegistry?.getCommand(name);
        const exists = symbols.length > 0 || (this.commandRegistry?.hasIdentifier(name) ?? false) || (command !== undefined) || isBuiltIn;

        if (!exists) {
            for (const ref of references) {
                const uriString = ref.uri.toString();
                let diagnostics = diagnosticsByUri.get(uriString) || [];
                
                let message = `Symbol '${name}' not found`;
                if (ref.expectedType !== undefined) {
                    const typeStr = SymbolType[ref.expectedType].toLowerCase();
                    message = `${typeStr.charAt(0).toUpperCase() + typeStr.slice(1)} '${name}' not found`;
                }

                diagnostics.push(new vscode.Diagnostic(
                    ref.range,
                    message,
                    vscode.DiagnosticSeverity.Error
                ));
                diagnosticsByUri.set(uriString, diagnostics);
            }
        }
    }

    // Also check for workspace-wide variable redeclaration
    const allSymbols = this.symbolTable.getAllSymbols();
    const varsByName = new Map<string, SymbolDefinition[]>();
    for (const s of allSymbols) {
        if (s.type === SymbolType.VARIABLE) {
            let list = varsByName.get(s.name) || [];
            list.push(s);
            varsByName.set(s.name, list);
        }
    }

    for (const [name, defs] of varsByName.entries()) {
        if (defs.length > 1) {
            for (const def of defs) {
                const uriString = def.uri.toString();
                let diagnostics = diagnosticsByUri.get(uriString) || [];
                diagnostics.push(new vscode.Diagnostic(
                    def.range,
                    `Variable '${name}' is redeclared. First declared at ${defs[0].uri.fsPath}:${defs[0].range.start.line + 1}`,
                    vscode.DiagnosticSeverity.Error
                ));
                diagnosticsByUri.set(uriString, diagnostics);
            }
        }
    }

    // Clear previous semantic diagnostics for all files that were not mentioned this time
    // but were previously mentioned.
    const allKnownUris = new Set([...this.diagnosticsByUriFromParser.keys(), ...diagnosticsByUri.keys()]);

    for (const uriString of allKnownUris) {
        const uri = vscode.Uri.parse(uriString);
        const parserDiagnostics = this.diagnosticsByUriFromParser.get(uriString) || [];
        const semanticDiagnostics = diagnosticsByUri.get(uriString) || [];
        this.diagnosticsCollection.set(uri, [...parserDiagnostics, ...semanticDiagnostics]);
    }
  }

  public dispose() {
    this.disposables.forEach(d => d.dispose());
  }
}
