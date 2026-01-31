import * as vscode from 'vscode';
import * as fs from 'fs';
import { Lexer } from '../core/Lexer';
import { Parser } from '../core/Parser';
import { SymbolTable } from '../core/SymbolTable';

export class WorkspaceIndexer {
  private symbolTable: SymbolTable;
  private diagnosticsCollection?: vscode.DiagnosticCollection;
  private disposables: vscode.Disposable[] = [];

  private pendingChanges = new Map<string, NodeJS.Timeout>();

  constructor(symbolTable: SymbolTable, diagnosticsCollection?: vscode.DiagnosticCollection) {
    this.symbolTable = symbolTable;
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
    }, 300); // 300ms debounce

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
    if (this.diagnosticsCollection) {
      this.diagnosticsCollection.delete(uri);
    }
    const parser = new Parser(uri, tokens, this.symbolTable);
    parser.parseSymbols();
    
    if (this.diagnosticsCollection) {
      this.diagnosticsCollection.set(uri, parser.getDiagnostics());
    }
  }

  public dispose() {
    this.disposables.forEach(d => d.dispose());
  }
}
