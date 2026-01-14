import * as vscode from 'vscode';
import { SymbolCache } from './symbols';
import { readMovescript, tokenize, Token, stripCommentAndMaskStrings } from './util';

function makeItems(names: string[], kind: vscode.CompletionItemKind, detail?: string): vscode.CompletionItem[] {
  return names.map(n => {
    const item = new vscode.CompletionItem(n, kind);
    if (detail) item.detail = detail;
    return item;
  });
}

export function createCompletionProvider(context: vscode.ExtensionContext, symbolCache: SymbolCache) {
  const ms = readMovescript(context);
  const commands = ms.commands;
  const flagsFromConfig = ms.flags;
  const identifiersFromConfig = ms.identifiers;
  const variablesFromConfig = ms.variables || [];
  const tagsFromConfig = (ms.string_tags && ms.string_tags.length > 0 ? ms.string_tags : (ms.tags || []));

  const provider: vscode.CompletionItemProvider = {
    async provideCompletionItems(document, position, token, ctx) {
      const cache = symbolCache.symbols;
      const fullLine = document.lineAt(position.line).text;
      const lineToCursor = fullLine.substring(0, position.character);

      // Filter function to only show items that match the current word being typed
      const currentWordRange = document.getWordRangeAtPosition(position, /[A-Za-z0-9_-]+/);
      const currentWord = currentWordRange ? document.getText(currentWordRange).toLowerCase() : "";

      const filterItems = (items: vscode.CompletionItem[]) => {
        if (!currentWord) return items;
        return items.filter(it => it.label.toString().toLowerCase().includes(currentWord));
      };

      // 1. Check if inside string/tag context
      const tagItems: vscode.CompletionItem[] = [];
      const isInsideStringTagContext = (function suggestTagsInsideBraces() {
        let inString = false;
        let escaped = false;
        let lastQuoteIdx = -1;
        for (let i = 0; i < lineToCursor.length; i++) {
          const ch = lineToCursor[i];
          if (ch === '"' && !escaped) {
            inString = !inString;
            lastQuoteIdx = i;
          }
          escaped = ch === '\\' && !escaped;
        }
        if (!inString) return false;

        const afterQuote = lineToCursor.slice(lastQuoteIdx + 1);
        const openBraceIdx = afterQuote.lastIndexOf('{');
        if (openBraceIdx < 0) return false;
        const afterOpen = afterQuote.slice(openBraceIdx + 1);
        if (afterOpen.includes('}')) return false;

        for (const t of tagsFromConfig) {
          if (t.startsWith(afterOpen)) {
            const it = new vscode.CompletionItem(t, vscode.CompletionItemKind.EnumMember);
            it.detail = 'MoveScript Tag';
            tagItems.push(it);
          }
        }
        return true;
      })();

      if (isInsideStringTagContext) {
        return new vscode.CompletionList(filterItems(tagItems), true);
      }

      // 2. Determine command context
      const masked = stripCommentAndMaskStrings(fullLine, true);
      const maskedBefore = masked.substring(0, position.character);

      // Find the last command before cursor
      const allCommandsInLine = Array.from(maskedBefore.matchAll(/(?:^|,)\s*([A-Za-z_][A-Za-z0-9_-]*)/g)) as RegExpExecArray[];
      const lastCommandMatch = allCommandsInLine.pop();

      const items: vscode.CompletionItem[] = [];

      // If no command yet, or we're just after a comma that starts a new command segment
      const isStartOfCommand = !lastCommandMatch || (maskedBefore.trimEnd().endsWith(',') && (function isCommaCommandSeparator() {
        const trimmed = maskedBefore.trimEnd();
        const tokens = tokenize(trimmed);
        if (tokens.length === 0) return true;
        const lastToken = tokens[tokens.length - 1];
        if (lastToken.text !== ',') return false;

        if (!lastCommandMatch) return true;
        const cmdName = lastCommandMatch[1];
        const spec = commands.find(c => c.name === cmdName);
        if (!spec) return true;

        // If we have a spec, we can be more intelligent.
        // If the current command expects more arguments, this comma is likely an argument separator.
        const afterCmd = trimmed.slice(lastCommandMatch.index! + lastCommandMatch[0].length);
        const argSegments = afterCmd.split(',');
        const currentArgCount = argSegments.length - 1; // -1 because the last segment is empty after the comma

        return !(spec.args && currentArgCount < spec.args.length);
      })());

      if (isStartOfCommand || (currentWordRange && lastCommandMatch && currentWordRange.start.character === lastCommandMatch.index + lastCommandMatch[0].indexOf(lastCommandMatch[1]))) {
        items.push(...makeItems(commands.map(c => c.name), vscode.CompletionItemKind.Method, 'MoveScript Command'));
        items.push(...makeItems(['macro', 'const'], vscode.CompletionItemKind.Keyword));
        // Also suggest macros if it's not the absolute start of line?
        // MoveScript allows macros in command positions.
        if (lineToCursor.trim()) {
           items.push(...makeItems(cache.macros, vscode.CompletionItemKind.Module, 'Macro'));
        }
        return new vscode.CompletionList(filterItems(items), false);
      }

      // We are after a command
      const cmdName = lastCommandMatch[1];
      const spec = commands.find(c => c.name === cmdName);
      const cmdStartIdx = lastCommandMatch.index! + lastCommandMatch[0].indexOf(cmdName);
      const afterCmd = maskedBefore.slice(cmdStartIdx + cmdName.length);

      // Determine argument index
      const afterTokens = tokenize(afterCmd);
      const hasComma = afterCmd.includes(',');

      let argIndex = 0;
      if (hasComma) {
        const segments = afterCmd.split(',');
        argIndex = segments.length - 1;
      } else {
        const expectedCount = spec?.args?.length || 0;
        let i = 0;
        const args: Token[][] = [];
        const isOperator = (t: Token) => '-+*/%'.includes(t.text);

        while (i < afterTokens.length) {
          if (args.length < (expectedCount > 0 ? expectedCount - 1 : 0)) {
            let j = i + 1;
            while (j < afterTokens.length && (isOperator(afterTokens[j]) || isOperator(afterTokens[j - 1]))) {
              j++;
            }
            args.push(afterTokens.slice(i, j));
            i = j;
          } else {
            args.push(afterTokens.slice(i));
            break;
          }
        }
        const endsWithSpace = afterCmd.length > 0 && (afterCmd[afterCmd.length - 1] === ' ' || afterCmd[afterCmd.length - 1] === '\t');
        argIndex = afterTokens.length === 0 ? 0 : (args.length - (endsWithSpace ? 0 : 1));
      }

      // 3. Collect items based on context
      const argSpec = (spec && spec.args && argIndex < spec.args.length) ? spec.args[argIndex] : undefined;

      if (argSpec) {
        if (argSpec.type === 'label') {
          items.push(...makeItems(cache.labels, vscode.CompletionItemKind.Reference, 'Label'));
          items.push(...makeItems(cache.macros, vscode.CompletionItemKind.Module, 'Macro'));
        } else if (argSpec.type === 'flag') {
          items.push(...makeItems(flagsFromConfig, vscode.CompletionItemKind.EnumMember, 'Flag'));
        } else if (argSpec.type === 'variable') {
          items.push(...makeItems(variablesFromConfig, vscode.CompletionItemKind.Variable, 'Variable'));
          items.push(...makeItems(cache.consts.filter(c => c.type === 'number').map(c => c.name), vscode.CompletionItemKind.Constant, 'Constant'));
        } else if (argSpec.type === 'number') {
          items.push(...makeItems(variablesFromConfig, vscode.CompletionItemKind.Variable, 'Variable'));
          items.push(...makeItems(cache.consts.filter(c => c.type === 'number').map(c => c.name), vscode.CompletionItemKind.Constant, 'Constant'));
          items.push(...makeItems(identifiersFromConfig, vscode.CompletionItemKind.Variable, 'Identifier'));
        } else if (argSpec.type === 'string') {
          items.push(...makeItems(cache.consts.filter(c => c.type === 'string').map(c => c.name), vscode.CompletionItemKind.Constant, 'Constant'));
        } else if (argSpec.type === 'identifier') {
          items.push(...makeItems(identifiersFromConfig, vscode.CompletionItemKind.Variable, 'Identifier'));
        }
      } else {
        // Fallback for unknown commands or extra arguments: suggest everything
        items.push(...makeItems(cache.macros, vscode.CompletionItemKind.Module, 'Macro'));
        items.push(...makeItems(cache.consts.map(c => c.name), vscode.CompletionItemKind.Constant, 'Constant'));
        items.push(...makeItems(flagsFromConfig, vscode.CompletionItemKind.EnumMember, 'Flag'));
        items.push(...makeItems(identifiersFromConfig, vscode.CompletionItemKind.Variable, 'Identifier'));
        items.push(...makeItems(variablesFromConfig, vscode.CompletionItemKind.Variable, 'Variable'));
      }

      // Deduplicate
      const seen = new Set<string>();
      const finalItems = items.filter(it => {
        const key = `${it.label}-${it.kind}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return new vscode.CompletionList(filterItems(finalItems), true);
    }
  };

  return provider;
}
