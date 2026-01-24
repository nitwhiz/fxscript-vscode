import * as vscode from 'vscode';
import { CommandRegistry } from './util/commandRegistry';
import { SemanticTokenProvider, legend } from './highlighting/semanticTokens';
import { FXScriptCompletionItemProvider } from './lsp/completion';
import { FXScriptHoverProvider } from './lsp/hover';
import { FXScriptDefinitionProvider } from './lsp/definition';
import { FXScriptDocumentSymbolProvider } from './lsp/symbols';

let registry: CommandRegistry;

export async function activate(context: vscode.ExtensionContext) {
    registry = new CommandRegistry(context.extensionUri);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    await registry.load(workspaceRoot);

    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
            { language: 'fxscript' },
            new SemanticTokenProvider(registry),
            legend
        )
    );

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { language: 'fxscript' },
            new FXScriptCompletionItemProvider(registry)
        )
    );

    context.subscriptions.push(
        vscode.languages.registerHoverProvider(
            { language: 'fxscript' },
            new FXScriptHoverProvider(registry)
        )
    );

    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(
            { language: 'fxscript' },
            new FXScriptDocumentSymbolProvider()
        )
    );

    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
            { language: 'fxscript' },
            new FXScriptDefinitionProvider()
        )
    );

    context.subscriptions.push(
        vscode.workspace.createFileSystemWatcher('**/commands.json').onDidChange(() => {
            registry.load(workspaceRoot);
        })
    );
}

export function deactivate() {}
