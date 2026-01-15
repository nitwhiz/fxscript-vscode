import * as vscode from 'vscode';
import { readFXScript } from './util';
import { createCompletionProvider } from './completionProvider';
import { registerNavigationProviders } from './navigation';
import { registerSemanticTokenProvider } from './semanticTokens';
import { registerValidation } from './validation';
import { UnimplementedTreeDataProvider } from './unimplementedView';
import { SymbolCache } from './symbols';

export function activate(context: vscode.ExtensionContext) {
  const symbolCache = new SymbolCache();

  // Initial symbol collection
  symbolCache.refresh();

  // Watch for commands.json changes
  const watcher = vscode.workspace.createFileSystemWatcher('**/commands.json');
  context.subscriptions.push(watcher);

  const triggerGlobalValidation = () => {
    vscode.commands.executeCommand('fxscript.triggerValidation');
  };

  // Semantic Tokens Provider
  const semanticTokensProvider = registerSemanticTokenProvider(context, symbolCache);

  watcher.onDidChange(() => {
    triggerGlobalValidation();
    semanticTokensProvider.refresh();
  });
  watcher.onDidCreate(() => {
    triggerGlobalValidation();
    semanticTokensProvider.refresh();
  });
  watcher.onDidDelete(() => {
    triggerGlobalValidation();
    semanticTokensProvider.refresh();
  });

  // Update symbol cache on saves
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.languageId === 'fxscript') {
        symbolCache.refresh();
      }
    })
  );

  // Unimplemented View
  const unimplementedProvider = new UnimplementedTreeDataProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('fxscript-todo', unimplementedProvider),
    vscode.commands.registerCommand('fxscript.openUnimplemented', (uri: vscode.Uri, range: vscode.Range) => {
      vscode.window.showTextDocument(uri, { selection: range });
    }),
    vscode.commands.registerCommand('fxscript.refreshUnimplemented', () => {
      unimplementedProvider.refresh();
    })
  );

  // Completion Provider
  const completionProvider = createCompletionProvider(context, symbolCache);
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: 'fxscript', scheme: 'file' },
      completionProvider,
      ' ', '\"', '@', '{'
    )
  );

  // Navigation Providers (Hover, Signature Help, Definition, References, Document Symbols, Document Links)
  // config is now read dynamically in the provider
  registerNavigationProviders(context, { commands: [], identifiers: [] }, symbolCache);

  // Validation (Diagnostics)
  registerValidation(context, { commands: [], identifiers: [] }, symbolCache);
}

export function deactivate() {}
