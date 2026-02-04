import * as vscode from 'vscode';
import { SymbolTable } from '../core/SymbolTable';
import { CommandRegistry } from '../workspace/CommandRegistry';
import { WorkspaceIndexer } from '../workspace/WorkspaceIndexer';
import { DefinitionProvider } from './providers/DefinitionProvider';
import { WorkspaceSymbolProvider } from './providers/WorkspaceSymbolProvider';
import { HoverProvider } from './providers/HoverProvider';
import { CompletionItemProvider } from './providers/CompletionItemProvider';
import { ReferenceProvider } from './providers/ReferenceProvider';
import { RenameProvider } from './providers/RenameProvider';
import { InlayHintsProvider } from './providers/InlayHintsProvider';
import { SemanticTokensProvider, legend } from './providers/SemanticTokensProvider';

export function activate(context: vscode.ExtensionContext) {
  const symbolTable = new SymbolTable();
  const commandRegistry = new CommandRegistry();
  const diagnosticsCollection = vscode.languages.createDiagnosticCollection('fxscript');
  const workspaceIndexer = new WorkspaceIndexer(symbolTable, commandRegistry, diagnosticsCollection);

  context.subscriptions.push(commandRegistry);
  context.subscriptions.push(workspaceIndexer);
  context.subscriptions.push(diagnosticsCollection);

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      { language: 'fxscript', scheme: 'file' },
      new DefinitionProvider(symbolTable)
    )
  );

  context.subscriptions.push(
    vscode.languages.registerReferenceProvider(
      { language: 'fxscript', scheme: 'file' },
      new ReferenceProvider(symbolTable)
    )
  );

  context.subscriptions.push(
    vscode.languages.registerRenameProvider(
      { language: 'fxscript', scheme: 'file' },
      new RenameProvider(symbolTable)
    )
  );

  context.subscriptions.push(
    vscode.languages.registerWorkspaceSymbolProvider(
      new WorkspaceSymbolProvider(symbolTable)
    )
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { language: 'fxscript', scheme: 'file' },
      new HoverProvider(symbolTable)
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: 'fxscript', scheme: 'file' },
      new CompletionItemProvider(symbolTable, commandRegistry),
      ',', ' ', '-', '+', '*', '/', '>', '<', '=', '(', ')' // Trigger characters
    )
  );

  context.subscriptions.push(
    vscode.languages.registerInlayHintsProvider(
      { language: 'fxscript', scheme: 'file' },
      new InlayHintsProvider(symbolTable)
    )
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: 'fxscript', scheme: 'file' },
      new SemanticTokensProvider(symbolTable, commandRegistry, workspaceIndexer.onDidChangeSemanticTokens),
      legend
    )
  );

  // Trigger initial semantic token refresh
  setTimeout(() => {
    workspaceIndexer.indexWorkspace().then(() => {
        // Semantic tokens are fired by indexWorkspace -> indexDocument -> indexContent -> revalidateAll
    });
  }, 500);

  console.log('FXScript extension activated');
}

export function deactivate() {}
