import * as vscode from 'vscode';
import { SymbolTable, SymbolType } from '../../core/SymbolTable';
import { CommandRegistry } from '../../workspace/CommandRegistry';

export const legend = new vscode.SemanticTokensLegend(
    ['keyword', 'variable', 'function', 'parameter'],
    ['declaration', 'documentation']
);

export class SemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    constructor(
        private symbolTable: SymbolTable,
        private commandRegistry: CommandRegistry,
        private onDidChangeSemanticTokensEvent?: vscode.Event<void>
    ) {}

    public get onDidChangeSemanticTokens() {
        return this.onDidChangeSemanticTokensEvent;
    }

    async provideDocumentSemanticTokens(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): Promise<vscode.SemanticTokens> {
        const builder = new vscode.SemanticTokensBuilder(legend);

        const symbols = this.symbolTable.getSymbolsInFile(document.uri);
        for (const symbol of symbols) {
            let type = 'variable';
            if (symbol.type === SymbolType.LABEL) {
                type = 'function';
            } else if (symbol.type === SymbolType.MACRO) {
                type = 'keyword';
            } else if (symbol.type === SymbolType.CONSTANT) {
                type = 'variable';
            }

            // If it's a @const directive, highlight the keyword part as a keyword
            if (symbol.type === SymbolType.CONSTANT) {
                const lineIndex = symbol.range.start.line;
                if (lineIndex >= document.lineCount) continue;
                const line = document.lineAt(lineIndex).text;
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

        const references = this.symbolTable.getReferencesInFile(document.uri);

        for (const ref of references) {
            const name = ref.name;
            // Check if it's a command call (custom or built-in)
            const isCustomCommand = this.commandRegistry.getCommand(name) !== undefined;
            const isBuiltInCommand = ["set", "goto", "call", "ret", "exit", "jumpIf"].includes(name);

            // We also want to check if it's a macro call
            const symbols = this.symbolTable.getSymbols(name);
            const isMacro = symbols.some(s => s.type === SymbolType.MACRO);
            const isLabel = symbols.some(s => s.type === SymbolType.LABEL);
            const isConst = symbols.some(s => s.type === SymbolType.CONSTANT);
            const isVar = symbols.some(s => s.type === SymbolType.VARIABLE);

            if (isCustomCommand || isBuiltInCommand) {
                builder.push(ref.range, 'keyword');
            } else if (isMacro) {
                builder.push(ref.range, 'keyword');
            } else if (isLabel) {
                builder.push(ref.range, 'function');
            } else if (isConst || isVar) {
                builder.push(ref.range, 'variable');
            } else if (this.commandRegistry.hasIdentifier(name)) {
                builder.push(ref.range, 'variable');
            }
        }

        return builder.build();
    }
}
