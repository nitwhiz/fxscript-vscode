import * as vscode from 'vscode';
import { Lexer, TokenType } from '../parser/lexer';
import { CommandRegistry } from '../util/commandRegistry';

export const legend = new vscode.SemanticTokensLegend(
    ['keyword', 'variable', 'function', 'label', 'number', 'operator', 'string', 'macro', 'preprocessor'],
    []
);

export class SemanticTokenProvider implements vscode.DocumentSemanticTokensProvider {
    constructor(private registry: CommandRegistry) {}

    provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.ProviderResult<vscode.SemanticTokens> {
        const builder = new vscode.SemanticTokensBuilder(legend);
        const lexer = new Lexer(document.getText());
        const tokens = lexer.tokenize();

        let inMacro = false;

        for (const token of tokens) {
            let type: string | undefined;

            switch (token.type) {
                case TokenType.PREPROCESSOR:
                    type = 'preprocessor';
                    if (token.value === 'macro') inMacro = true;
                    if (token.value === 'endmacro') inMacro = false;
                    break;
                case TokenType.MACRO_PARAM:
                    type = 'variable';
                    break;
                case TokenType.LABEL:
                    type = 'label';
                    break;
                case TokenType.NUMBER:
                    type = 'number';
                    break;
                case TokenType.STRING:
                    type = 'string';
                    break;
                case TokenType.OPERATOR:
                    type = 'operator';
                    break;
                case TokenType.IDENTIFIER:
                    if (this.registry.getCommand(token.value)) {
                        type = 'function';
                    } else {
                        type = 'variable';
                    }
                    break;
            }

            if (type) {
                builder.push(token.line, token.column, token.value.length, legend.tokenTypes.indexOf(type), 0);
            }
        }

        return builder.build();
    }
}
