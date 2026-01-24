import * as vscode from 'vscode';
import { Lexer, TokenType } from '../parser/lexer';

export class FXScriptDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    provideDocumentSymbols(document: vscode.TextDocument): vscode.ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
        const symbols: vscode.DocumentSymbol[] = [];
        const lexer = new Lexer(document.getText());
        const tokens = lexer.tokenize();

        for (const token of tokens) {
            if (token.type === TokenType.LABEL && !token.value.startsWith('_')) {
                const labelName = token.value.slice(0, -1);
                const range = new vscode.Range(token.line, token.column, token.line, token.column + labelName.length);
                symbols.push(new vscode.DocumentSymbol(
                    labelName,
                    '',
                    vscode.SymbolKind.Function,
                    range,
                    range
                ));
            }
        }
        return symbols;
    }
}
