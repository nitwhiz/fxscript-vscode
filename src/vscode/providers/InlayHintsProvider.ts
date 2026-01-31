import * as vscode from 'vscode';
import { SymbolTable, SymbolType } from '../../core/SymbolTable';

export class InlayHintsProvider implements vscode.InlayHintsProvider {
    constructor(private symbolTable: SymbolTable) {}

    provideInlayHints(document: vscode.TextDocument, range: vscode.Range, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.InlayHint[]> {
        const hints: vscode.InlayHint[] = [];
        const uriString = document.uri.toString();

        for (const symbol of this.symbolTable.getAllSymbols()) {
            if (symbol.uri.toString() === uriString && symbol.type === SymbolType.CONSTANT && symbol.documentation) {
                if (range.contains(symbol.range.start)) {
                    // We only want to show hints for the raw directive symbols (e.g. "move:dig")
                    // These have documentation starting with "const "
                    if (symbol.documentation.startsWith('const ')) {
                        const runtimeName = symbol.documentation.substring(6);
                        
                        const parts: vscode.InlayHintLabelPart[] = [];
                        parts.push(new vscode.InlayHintLabelPart(' as const '));
                        
                        const namePart = new vscode.InlayHintLabelPart(runtimeName);
                        // Use a command to show references
                        namePart.command = {
                            title: 'Show References',
                            command: 'editor.action.goToReferences',
                            arguments: [
                                symbol.uri,
                                symbol.range.start
                            ]
                        };
                        parts.push(namePart);

                        const hint = new vscode.InlayHint(
                            symbol.range.end,
                            parts,
                            vscode.InlayHintKind.Type
                        );
                        hints.push(hint);
                    }
                }
            }
        }

        return hints;
    }
}
