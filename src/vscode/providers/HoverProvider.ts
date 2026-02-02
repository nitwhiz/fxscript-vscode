import * as vscode from 'vscode';
import { SymbolTable } from '../../core/SymbolTable';

export class HoverProvider implements vscode.HoverProvider {
  constructor(private symbolTable: SymbolTable) {}

  public async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    const lineText = document.lineAt(position.line).text;
    const lineUntilCursor = lineText.substring(0, position.character);

    if (lineUntilCursor.includes('#')) {
      return undefined;
    }

    const range = document.getWordRangeAtPosition(position, /[@%$a-zA-Z0-9_-]+/);
    if (!range) {
      return undefined;
    }

    let word = document.getText(range);
    const contextPrefix = this.symbolTable.getContextPrefix(document.uri, position);

    // If it's a macro argument ($arg), we can try to find the macro it belongs to
    if (word.startsWith('$') && contextPrefix) {
      const macroName = contextPrefix;
      const fullName = `${macroName}:${word}`;
      const argSymbols = this.symbolTable.getSymbols(fullName);
      if (argSymbols.length > 0) {
          let contents = `**${word}**\n\nMacro argument of \`${macroName}\``;
          return new vscode.Hover(new vscode.MarkdownString(contents));
      }
    }

    if (word.endsWith(':')) {
      word = word.slice(0, -1);
    }

    let symbols = this.symbolTable.getSymbols(word);

    // Fallback for local labels
    if (word.startsWith('%')) {
        const contextPrefix = this.symbolTable.getContextPrefix(document.uri, position);
        if (contextPrefix) {
            const fullName = `${contextPrefix}${word}`;
            const qualifiedSymbols = this.symbolTable.getSymbols(fullName);
            if (qualifiedSymbols.length > 0) {
                symbols = qualifiedSymbols;
            }
        }

        if (symbols.length === 0) {
            const allSymbols = this.symbolTable.getAllSymbols();
            symbols = allSymbols.filter(s => s.localName === word);
        }
    }

    if (symbols.length > 0) {
      const s = symbols[0];
      let contents = `**${s.name}**`;
      if (s.localName) {
        contents = `**${s.localName}** (qualified: \`${s.name}\`)`;
      }
      if (s.documentation) {
        contents += `\n\n${s.documentation}`;
      }
      return new vscode.Hover(new vscode.MarkdownString(contents));
    }

    return undefined;
  }
}
