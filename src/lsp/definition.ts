import * as vscode from 'vscode';
import { Lexer, TokenType } from '../parser/lexer';

export class FXScriptDefinitionProvider implements vscode.DefinitionProvider {
    async provideDefinition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Definition | null> {
        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            return null;
        }
        const word = document.getText(range);
        
        const files = await vscode.workspace.findFiles('**/*.fx{,s,t}');
        for (const file of files) {
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const text = Buffer.from(content).toString('utf8');
                const lexer = new Lexer(text);
                const tokens = lexer.tokenize();
                
                for (let i = 0; i < tokens.length; i++) {
                    const token = tokens[i];
                    if (token.type === TokenType.LABEL && token.value.slice(0, -1) === word) {
                        return new vscode.Location(file, new vscode.Position(token.line, token.column));
                    }
                    if (token.type === TokenType.PREPROCESSOR) {
                        if ((token.value === 'const' || token.value === 'macro') && tokens[i+1] && tokens[i+1].value === word) {
                            return new vscode.Location(file, new vscode.Position(tokens[i+1].line, tokens[i+1].column));
                        }
                    }
                }
            } catch (e) {
                // Ignore errors
            }
        }
        return null;
    }
}
