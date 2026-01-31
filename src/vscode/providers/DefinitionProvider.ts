import * as vscode from 'vscode';
import { SymbolTable } from '../../core/SymbolTable';

export class DefinitionProvider implements vscode.DefinitionProvider {
  constructor(private symbolTable: SymbolTable) {}

  public async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Definition | undefined> {
    const range = document.getWordRangeAtPosition(position, /[@%a-zA-Z0-9_-]+/);
    if (!range) {
      return undefined;
    }

    let word = document.getText(range);
    
    // Normalize word
    if (word.endsWith(':')) {
        word = word.slice(0, -1);
    }

    let symbols = this.symbolTable.getSymbols(word);

    // If it's a local label, we might need to qualify it
    if (word.startsWith('%')) {
        const contextPrefix = this.symbolTable.getContextPrefix(document.uri, position);
        if (contextPrefix) {
            const fullName = `${contextPrefix}${word}`;
            symbols = this.symbolTable.getSymbols(fullName);
        }

        // Fallback: if not found by context, try searching with localName
        if (symbols.length === 0) {
            const allSymbols = this.symbolTable.getAllSymbols();
            symbols = allSymbols.filter(s => s.localName === word);
        }
    }

    if (symbols.length > 0) {
      return symbols.map(s => new vscode.Location(s.uri, s.range));
    }

    return undefined;
  }
}
