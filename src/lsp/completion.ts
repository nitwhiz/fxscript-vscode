import * as vscode from 'vscode';
import { Lexer, TokenType } from '../parser/lexer';
import { CommandRegistry } from '../util/commandRegistry';

export class FXScriptCompletionItemProvider implements vscode.CompletionItemProvider {
    constructor(private registry: CommandRegistry) {}

    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.CompletionItem[]> {
        const items: vscode.CompletionItem[] = [];

        // Commands
        for (const cmd of this.registry.getAllCommands()) {
            const item = new vscode.CompletionItem(cmd.name, vscode.CompletionItemKind.Function);
            item.detail = cmd.args.map(a => `${a.name}${a.optional ? '?' : ''}: ${a.type}`).join(', ');
            items.push(item);
        }

        // Preprocessor keywords
        ['const', 'macro', 'endmacro', '@include'].forEach(kw => {
            items.push(new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword));
        });

        // Workspace-wide suggestions
        const files = await vscode.workspace.findFiles('**/*.fx{,s,t}');
        for (const file of files) {
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const text = Buffer.from(content).toString('utf8');
                const lexer = new Lexer(text);
                const tokens = lexer.tokenize();

                for (let i = 0; i < tokens.length; i++) {
                    const token = tokens[i];
                    if (token.type === TokenType.LABEL) {
                        const labelName = token.value.slice(0, -1);
                        const item = new vscode.CompletionItem(labelName, vscode.CompletionItemKind.Reference);
                        item.detail = `Label in ${vscode.workspace.asRelativePath(file)}`;
                        items.push(item);
                    } else if (token.type === TokenType.PREPROCESSOR) {
                        if (token.value === 'const' && tokens[i+1]) {
                            const constName = tokens[i+1].value;
                            const item = new vscode.CompletionItem(constName, vscode.CompletionItemKind.Constant);
                            item.detail = `Constant in ${vscode.workspace.asRelativePath(file)}`;
                            items.push(item);
                        } else if (token.value === 'macro' && tokens[i+1]) {
                            const macroName = tokens[i+1].value;
                            const item = new vscode.CompletionItem(macroName, vscode.CompletionItemKind.Snippet);
                            item.detail = `Macro in ${vscode.workspace.asRelativePath(file)}`;
                            items.push(item);
                        }
                    }
                }
            } catch (e) {
                // Ignore errors
            }
        }

        return items;
    }
}
