import * as vscode from 'vscode';
import { SymbolTable, SymbolType } from '../../core/SymbolTable';
import { CommandRegistry } from '../../workspace/CommandRegistry';

export class CompletionItemProvider implements vscode.CompletionItemProvider {
  constructor(
    private symbolTable: SymbolTable,
    private commandRegistry: CommandRegistry
  ) {}

  public async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[]> {
    const lineText = document.lineAt(position.line).text;
    const lineUntilCursor = lineText.substring(0, position.character);

    // If there's a '#' before the cursor on the current line, we're in a comment.
    if (lineUntilCursor.includes('#')) {
      return [];
    }

    const items: vscode.CompletionItem[] = [];

    // Check if we are at the beginning of the line (only whitespace before cursor)
    const isAtStartOfLine = lineUntilCursor.trim().length === 0;

    // A better check for argument position: if the first non-whitespace word is already there.
    const firstWordMatch = lineUntilCursor.match(/^\s*([@%a-zA-Z0-9_-]+)/);
    const isAtArgumentPosition = firstWordMatch && lineUntilCursor.length > firstWordMatch[0].length;

    // We allow spaces after comma or at start of argument list.
    // However, if we've already started typing a word, we want that word to be the filter.
    const wordRange = document.getWordRangeAtPosition(position, /[@%a-zA-Z0-9_-]+/);

    // 1. Suggest Commands
    // Only suggest at start of line
    if (isAtStartOfLine) {
      const commands = this.commandRegistry.getAllCommands();
      for (const cmd of commands) {
        const item = new vscode.CompletionItem(cmd.name, vscode.CompletionItemKind.Function);
        if (wordRange) {
          item.range = wordRange;
        }
        items.push(item);
      }

      // 2. Suggest Base Commands
      const baseCommands = ['set', 'goto', 'call', 'ret', 'jumpIf'];
      for (const cmd of baseCommands) {
        const item = new vscode.CompletionItem(cmd, vscode.CompletionItemKind.Keyword);
        if (wordRange) {
          item.range = wordRange;
        }
        items.push(item);
      }

      // 3. Suggest Keywords
      const keywords = ['var', 'const', 'macro', 'endmacro', '@include', '@const'];
      for (const kw of keywords) {
        const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword);
        if (wordRange) {
          item.range = wordRange;
        }
        items.push(item);
      }
    }

    // 4. Suggest Symbols from SymbolTable
    const symbols = this.symbolTable.getAllSymbols();
    const seenNames = new Set<string>();

    // Determine context for local labels
    const contextPrefix = this.symbolTable.getContextPrefix(document.uri, position);

    // 5. Suggest Macro Arguments if inside a macro
    if (contextPrefix) {
      const macroDefs = this.symbolTable.getSymbols(contextPrefix);
      const macroDef = macroDefs.find(s => s.type === SymbolType.MACRO && s.uri.toString() === document.uri.toString() && s.scopeRange?.contains(position));
      if (macroDef && macroDef.args) {
        for (const arg of macroDef.args) {
          const item = new vscode.CompletionItem(arg, vscode.CompletionItemKind.Variable);
          if (wordRange) {
            item.range = wordRange;
          }
          item.detail = `Macro argument of ${macroDef.name}`;
          items.push(item);
        }
      }
    }

    for (const s of symbols) {
      // Don't suggest raw @const lookup values (those containing a colon)
      if (s.name.includes(':')) {
        continue;
      }

      // Filter local labels
      if (s.localName) {
        if (contextPrefix) {
          if (!s.name.startsWith(contextPrefix)) {
            continue;
          }
        } else {
          continue;
        }
      } else if (s.type === SymbolType.LABEL && s.name.startsWith('_')) {
        // Filter "external" labels (starting with underscore, but not local)
        continue;
      }

      if (seenNames.has(s.name)) {
        continue;
      }
      seenNames.add(s.name);

      let kind = vscode.CompletionItemKind.Variable;
      switch (s.type) {
        case SymbolType.VARIABLE: kind = vscode.CompletionItemKind.Variable; break;
        case SymbolType.CONSTANT: kind = vscode.CompletionItemKind.Constant; break;
        case SymbolType.LABEL: kind = vscode.CompletionItemKind.Function; break;
        case SymbolType.MACRO:
          // Macros are only allowed in place of commands (-> macro calls)
          // They are not allowed as arguments.
          if (isAtArgumentPosition) {
            continue;
          }

          kind = vscode.CompletionItemKind.Module;
          break;
      }

      const label = s.localName || s.name;
      const item = new vscode.CompletionItem(label, kind);
      if (wordRange) {
        item.range = wordRange;
      }
      if (s.localName) {
        item.detail = s.name; // Show fully qualified name in detail
      }
      items.push(item);
    }

    // 5. Suggest Identifiers from commands.json
    // Typically these are used in argument positions
    const identifiers = this.commandRegistry.getAllIdentifiers();
    for (const id of identifiers) {
      const item = new vscode.CompletionItem(id, vscode.CompletionItemKind.Value);
      if (wordRange) {
        item.range = wordRange;
      }
      items.push(item);
    }

    return items;
  }
}
