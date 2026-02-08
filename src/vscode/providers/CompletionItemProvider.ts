import * as vscode from 'vscode';
import { SymbolTable, SymbolType } from '../../core/SymbolTable';
import { CommandRegistry } from '../../workspace/CommandRegistry';
import { getBuiltInCommandNames } from '../../core/BuiltInCommands';

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

    // Check if we are at the beginning of the line (only whitespace before cursor, or we are typing the first word)
    const firstWordMatch = lineUntilCursor.match(/^\s*([@%$a-zA-Z0-9_-]*)/);
    const isAtStartOfLine = firstWordMatch && lineUntilCursor.length === firstWordMatch[0].length;


    // We allow spaces after comma or at start of argument list.
    // However, if we've already started typing a word, we want that word to be the filter.
    // We adjust the regex to NOT include operators if they are at the end, to allow suggestions after them.
    let wordRange = document.getWordRangeAtPosition(position, /[@%$a-zA-Z0-9_-]+/);

    if (wordRange) {
      const word = document.getText(wordRange);
      // If the word ends with an operator-like character and the cursor is right after it,
      // we might want to shrink the range to exclude that character so suggestions work.
      // e.g. "var-" -> we want to suggest after "-"
      const lastChar = word[word.length - 1];
      const operators = ['-', '+', '*', '/', '>', '<', '=', '(', ')', '[', ']', ','];
      if (operators.includes(lastChar) && position.character === wordRange.end.character) {
        // SPECIAL CASE: if it's a hyphen, check if the preceding part looks like a word.
        // If it's 'statHp-', we want to suggest after '-'. 
        // If it's 'AccuracyCheck-', we might be typing 'AccuracyCheck-fail'.
        // But to trigger suggestions after '-', we MUST shrink the range.
        
        wordRange = new vscode.Range(wordRange.start, position.translate(0, -1));
        if (wordRange.isEmpty) {
          wordRange = undefined;
        }
      }
    }

    // Context for macro
    const contextPrefix = this.symbolTable.getContextPrefix(document.uri, position);
    const isInsideMacro = !!(contextPrefix && this.symbolTable.getSymbols(contextPrefix).some(s => s.type === SymbolType.MACRO && s.uri.toString() === document.uri.toString() && s.scopeRange?.contains(position)));

    // 1. Suggest Commands and Keywords at the start of the line
    if (isAtStartOfLine) {
      // Suggest Commands
      const commands = this.commandRegistry.getAllCommands();
      for (const cmd of commands) {
        const item = new vscode.CompletionItem(cmd.name, vscode.CompletionItemKind.Function);
        if (wordRange) {
          item.range = wordRange;
        }
        items.push(item);
      }

      // Suggest Base Commands
      const baseCommands = getBuiltInCommandNames();
      for (const cmd of baseCommands) {
        const item = new vscode.CompletionItem(cmd, vscode.CompletionItemKind.Keyword);
        if (wordRange) {
          item.range = wordRange;
        }
        items.push(item);
      }

      // Suggest Macros (they can be used as commands)
      const symbols = this.symbolTable.getAllSymbols();
      const seenMacros = new Set<string>();
      for (const s of symbols) {
        if (s.type === SymbolType.MACRO && !seenMacros.has(s.name)) {
          seenMacros.add(s.name);
          const item = new vscode.CompletionItem(s.name, vscode.CompletionItemKind.Module);
          if (wordRange) {
            item.range = wordRange;
          }
          items.push(item);
        }
      }

      // Suggest Keywords
      const keywords = ['var', 'def', 'macro', '@include', '@def'];
      if (isInsideMacro) {
        keywords.push('endmacro');
      }

      for (const kw of keywords) {
        const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword);
        if (wordRange) {
          item.range = wordRange;
        }
        items.push(item);
      }

      // At the start of the line, we ONLY suggest the above.
      return items;
    }

    // 4. Suggest Symbols from SymbolTable (Arguments context)
    const symbols = this.symbolTable.getAllSymbols();
    const seenNames = new Set<string>();

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
      // Don't suggest raw @def lookup values or macro args (those containing a colon)
      if (s.name.includes(':')) {
        continue;
      }

      // Macros are NOT allowed as arguments
      if (s.type === SymbolType.MACRO) {
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
      // Macros are not allowed as identifiers/arguments
      if (this.symbolTable.getSymbols(id).some(s => s.type === SymbolType.MACRO)) {
        continue;
      }

      const item = new vscode.CompletionItem(id, vscode.CompletionItemKind.Value);
      if (wordRange) {
        item.range = wordRange;
      }
      items.push(item);
    }

    return items;
  }
}
