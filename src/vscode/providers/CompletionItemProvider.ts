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
    const items: vscode.CompletionItem[] = [];

    const wordRange = document.getWordRangeAtPosition(position, /[@%a-zA-Z0-9_-]+/);

    // 1. Suggest Commands
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

    // 4. Suggest Symbols from SymbolTable
    const symbols = this.symbolTable.getAllSymbols();
    const seenNames = new Set<string>();

    // Determine context for local labels
    const contextPrefix = this.symbolTable.getContextPrefix(document.uri, position);
    
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
          // No context, might be at the top of the file. 
          // Suggest it if it doesn't seem to belong to any other label/macro? 
          // Actually, if it's a local label, it MUST have a prefix if it was parsed correctly.
          // If we are at the top, maybe don't suggest local labels?
          continue; 
        }
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
        case SymbolType.MACRO: kind = vscode.CompletionItemKind.Module; break;
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
