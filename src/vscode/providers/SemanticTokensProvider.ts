import * as vscode from 'vscode';
import { SymbolTable, SymbolType } from '../../core/SymbolTable';
import { CommandRegistry } from '../../workspace/CommandRegistry';

export const legend = new vscode.SemanticTokensLegend(
    ['keyword', 'variable', 'function', 'parameter', 'macro'],
    ['declaration', 'documentation']
);

export class SemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    constructor(
        private symbolTable: SymbolTable,
        private commandRegistry: CommandRegistry
    ) {}

    async provideDocumentSemanticTokens(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): Promise<vscode.SemanticTokens> {
        const builder = new vscode.SemanticTokensBuilder(legend);
        const uriString = document.uri.toString();

        const allSymbols = this.symbolTable.getAllSymbols();
        for (const symbol of allSymbols) {
            if (symbol.uri.toString() !== uriString) {
                continue;
            }

            let type = 'variable';
            if (symbol.type === SymbolType.LABEL) {
                type = 'function';
            } else if (symbol.type === SymbolType.MACRO) {
                type = 'macro';
            } else if (symbol.type === SymbolType.CONSTANT) {
                type = 'variable';
            }

            // If it's a @const directive, highlight the keyword part as a keyword
            if (symbol.type === SymbolType.CONSTANT && symbol.uri.toString() === uriString) {
                const line = document.lineAt(symbol.range.start.line).text;
                const match = line.match(/^(\s*)@const\b/);
                if (match) {
                    const startChar = match[1].length;
                    const keywordRange = new vscode.Range(symbol.range.start.line, startChar, symbol.range.start.line, startChar + 6);
                    builder.push(keywordRange, 'keyword');
                    
                    // The rest of the symbol range should be variable (name:value)
                    const restStart = startChar + 6;
                    // Find where the actual value starts (skip whitespace)
                    let actualStart = restStart;
                    while (actualStart < line.length && (line[actualStart] === ' ' || line[actualStart] === '\t')) {
                        actualStart++;
                    }
                    
                    if (actualStart < line.length && actualStart < symbol.range.end.character) {
                        const restRange = new vscode.Range(symbol.range.start.line, actualStart, symbol.range.start.line, symbol.range.end.character);
                        builder.push(restRange, 'variable', ['declaration']);
                    }
                } else {
                    builder.push(symbol.range, type, ['declaration']);
                }
            } else {
                builder.push(symbol.range, type, ['declaration']);
            }
        }

        const allRefs = this.symbolTable.getAllReferences();
        const builtInCommands = ["set", "goto", "call", "ret", "jumpIf"];

        for (const { name, references } of allRefs) {
            for (const ref of references) {
                if (ref.uri.toString() !== uriString) {
                    continue;
                }

                // Check if it's a command call
                const isCustomCommand = this.commandRegistry.getCommand(name) !== undefined;
                const isBuiltIn = builtInCommands.includes(name);

                // We also want to check if it's a macro call
                const symbols = this.symbolTable.getSymbols(name);
                const isMacro = symbols.some(s => s.type === SymbolType.MACRO);
                const isLabel = symbols.some(s => s.type === SymbolType.LABEL);
                const isConst = symbols.some(s => s.type === SymbolType.CONSTANT);
                const isVar = symbols.some(s => s.type === SymbolType.VARIABLE);

                if (isBuiltIn || isCustomCommand) {
                    builder.push(ref.range, 'keyword');
                } else if (isMacro) {
                    builder.push(ref.range, 'macro');
                } else if (isLabel) {
                    builder.push(ref.range, 'function');
                } else if (isConst || isVar) {
                    builder.push(ref.range, 'variable');
                } else if (this.commandRegistry.hasIdentifier(name)) {
                    builder.push(ref.range, 'variable');
                }
            }
        }

        return builder.build();
    }
}
