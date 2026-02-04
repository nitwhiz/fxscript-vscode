import * as vscode from 'vscode';
import { SymbolTable } from '../../core/SymbolTable';

export class ReferenceProvider implements vscode.ReferenceProvider {
  constructor(private symbolTable: SymbolTable) {}

  public async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.Location[] | undefined> {
    const lineText = document.lineAt(position.line).text;
    const lineUntilCursor = lineText.substring(0, position.character);

    if (lineUntilCursor.includes('#')) {
      return undefined;
    }

    const range = document.getWordRangeAtPosition(position, /[@%a-zA-Z0-9_-]+/);
    if (!range) {
      return undefined;
    }

    let word = document.getText(range);

    // Normalize word
    if (word.endsWith(':')) {
        word = word.slice(0, -1);
    }

    let symbolName = word;

    // Special case for @def lookups at the definition site
    if (document.lineAt(position.line).text.trim().startsWith('@def')) {
        const symbolsAtPosition = this.symbolTable.getAllSymbols().filter(s =>
            s.uri.toString() === document.uri.toString() &&
            s.range.contains(position) &&
            s.documentation?.startsWith('def ')
        );
        if (symbolsAtPosition.length > 0) {
            symbolName = symbolsAtPosition[0].documentation!.substring(4);
        }
    }

    // Local labels
    if (word.startsWith('%')) {
        const contextPrefix = this.symbolTable.getContextPrefix(document.uri, position);
        if (contextPrefix) {
            symbolName = `${contextPrefix}${word}`;
        } else {
            // Fallback: search for unique local name if no context found
            const allSymbols = this.symbolTable.getAllSymbols();
            const matching = allSymbols.filter(s => s.name.endsWith(word));
            if (matching.length === 1) {
                symbolName = matching[0].name;
            } else if (matching.length > 1) {
                 const currentFile = matching.find(s => s.uri.toString() === document.uri.toString());
                 if (currentFile) {
                     symbolName = currentFile.name;
                 }
            }
        }
    } else if (word.startsWith('$')) {
        // Macro argument
        const contextPrefix = this.symbolTable.getContextPrefix(document.uri, position);
        if (contextPrefix) {
            symbolName = `${contextPrefix}:${word}`;
        }
    }

    const references = this.symbolTable.getReferences(symbolName);
    const locations = references.map(r => new vscode.Location(r.uri, r.range));

    if (context.includeDeclaration) {
        const symbols = this.symbolTable.getSymbols(symbolName);
        locations.push(...symbols.map(s => new vscode.Location(s.uri, s.range)));
    }

    return locations.length > 0 ? locations : undefined;
  }
}
