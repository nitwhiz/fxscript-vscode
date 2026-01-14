import * as vscode from 'vscode';
import { readMovescript } from './util';
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
    vscode.commands.executeCommand('movescript.triggerValidation');
  };

  watcher.onDidChange(() => {
    triggerGlobalValidation();
  });
  watcher.onDidCreate(() => {
    triggerGlobalValidation();
  });
  watcher.onDidDelete(() => {
    triggerGlobalValidation();
  });

  // Update symbol cache on saves
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.languageId === 'movescript') {
        symbolCache.refresh();
      }
    })
  );

  // Unimplemented View
  const unimplementedProvider = new UnimplementedTreeDataProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('movescript-todo', unimplementedProvider),
    vscode.commands.registerCommand('movescript.openUnimplemented', (uri: vscode.Uri, range: vscode.Range) => {
      vscode.window.showTextDocument(uri, { selection: range });
    }),
    vscode.commands.registerCommand('movescript.refreshUnimplemented', () => {
      unimplementedProvider.refresh();
    })
  );

  // Completion Provider
  const completionProvider = createCompletionProvider(context, symbolCache);
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: 'movescript', scheme: 'file' },
      completionProvider,
      ' ', '\"', '@', '{'
    )
  );

  // Navigation Providers (Hover, Signature Help, Definition, References, Document Symbols, Document Links)
  // config is now read dynamically in the provider
  registerNavigationProviders(context, { commands: [], flags: [], identifiers: [], variables: [] }, symbolCache);

  // Semantic Tokens Provider
  registerSemanticTokenProvider(context, symbolCache);

  // Validation (Diagnostics)
  registerValidation(context, { commands: [], flags: [], identifiers: [], variables: [] }, symbolCache);
}

export function deactivate() {}
