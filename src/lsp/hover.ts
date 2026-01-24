import * as vscode from 'vscode';
import { CommandRegistry } from '../util/commandRegistry';

export class FXScriptHoverProvider implements vscode.HoverProvider {
    constructor(private registry: CommandRegistry) {}

    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            return null;
        }
        const word = document.getText(range);
        const cmd = this.registry.getCommand(word);
        if (cmd) {
            const args = cmd.args.map(a => `*${a.name}* (${a.type})${a.optional ? ' [optional]' : ''}`).join('\n- ');
            return new vscode.Hover(new vscode.MarkdownString(`**Command: ${cmd.name}**\n\nArguments:\n- ${args}`));
        }
        return null;
    }
}
