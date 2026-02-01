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

    // Special case for @const lookups at the definition site
    if (document.lineAt(position.line).text.trim().startsWith('@const')) {
        const symbolsAtPosition = this.symbolTable.getAllSymbols().filter(s => 
            s.uri.toString() === document.uri.toString() && 
            s.range.contains(position) &&
            s.documentation?.startsWith('const ')
        );
        if (symbolsAtPosition.length > 0) {
            symbolName = symbolsAtPosition[0].documentation!.substring(6);
        }
    }

    // If it's a local label, we might need to qualify it
    if (word.startsWith('%')) {
        // Try to find the context (last global label or macro)
        // This is a simplification, ideally should use a more robust way
        const allSymbols = this.symbolTable.getAllSymbols();
        const matchingSymbols = allSymbols.filter(s => s.name.endsWith(word));
        
        if (matchingSymbols.length === 1) {
            symbolName = matchingSymbols[0].name;
        } else if (matchingSymbols.length > 1) {
            // If multiple, try to find the one in the current file or closest scope
            // For now, let's just use the first one or all of them if we were returning symbols
            // but we need a single name to look up references.
            // This is a known limitation of this simplified approach.
            const currentFileSymbol = matchingSymbols.find(s => s.uri.toString() === document.uri.toString());
            if (currentFileSymbol) {
                symbolName = currentFileSymbol.name;
            }
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
