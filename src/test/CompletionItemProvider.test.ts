import { describe, it, expect } from 'vitest';
import { CompletionItemProvider } from '../vscode/providers/CompletionItemProvider';
import { SymbolTable, SymbolType } from '../core/SymbolTable';
import { CommandRegistry } from '../workspace/CommandRegistry';
import * as vscode from 'vscode';

describe('FXScript Suggestions (CompletionItemProvider)', () => {
  const dummyUri = vscode.Uri.file('/test.fx');

  const getSuggestions = async (content: string, line: number, character: number, symbolTable: SymbolTable = new SymbolTable()) => {
    const commandRegistry = new CommandRegistry();
    const provider = new CompletionItemProvider(symbolTable, commandRegistry);
    
    const lines = content.split('\n');
    const document = {
      uri: dummyUri,
      lineCount: lines.length,
      lineAt: (l: number) => ({ text: lines[l] }),
      getText: (range: vscode.Range) => {
          const l = lines[range.start.line];
          return l.substring(range.start.character, range.end.character);
      },
      getWordRangeAtPosition: (pos: vscode.Position, regex: RegExp) => {
          const l = lines[pos.line];
          // Simple mock for getWordRangeAtPosition
          const textUntil = l.substring(0, pos.character);
          const textAfter = l.substring(pos.character);
          
          const beforeMatch = textUntil.match(new RegExp(regex.source + '$'));
          const afterMatch = textAfter.match(new RegExp('^' + regex.source));
          
          if (!beforeMatch && !afterMatch) return undefined;
          
          const start = pos.character - (beforeMatch ? beforeMatch[0].length : 0);
          const end = pos.character + (afterMatch ? afterMatch[0].length : 0);
          return new vscode.Range(pos.line, start, pos.line, end);
      }
    } as any as vscode.TextDocument;

    const position = new vscode.Position(line, character);
    return await provider.provideCompletionItems(document, position, {} as any, {} as any);
  };

  it('should suggest built-in commands at start of line', async () => {
    const content = '  ';
    const suggestions = await getSuggestions(content, 0, 2);
    const labels = suggestions.map(s => s.label);
    expect(labels).toContain('set');
    expect(labels).toContain('goto');
    expect(labels).toContain('var');
  });

  it('should suggest global symbols in expressions', async () => {
    const symbolTable = new SymbolTable();
    symbolTable.addSymbol({
      name: 'myGlobalVar',
      type: SymbolType.VARIABLE,
      uri: dummyUri,
      range: new vscode.Range(0, 0, 0, 0)
    });

    const content = '  set a, ';
    const suggestions = await getSuggestions(content, 0, 9, symbolTable);
    const labels = suggestions.map(s => s.label);
    expect(labels).toContain('myGlobalVar');
  });

  it('should suggest local labels with prefix', async () => {
    const symbolTable = new SymbolTable();
    symbolTable.addSymbol({
      name: 'Main',
      type: SymbolType.LABEL,
      uri: dummyUri,
      range: new vscode.Range(0, 0, 0, 4)
    });
    symbolTable.addSymbol({
      name: 'Main%local',
      type: SymbolType.LABEL,
      uri: dummyUri,
      range: new vscode.Range(1, 0, 1, 6),
      localName: '%local'
    });

    // Content after Main label
    const content = 'Main:\n  goto ';
    const suggestions = await getSuggestions(content, 1, 7, symbolTable);
    const labels = suggestions.map(s => s.label);
    
    // It should suggest '%local' when inside 'Main' context
    expect(labels).toContain('%local');
  });

  it('should suggest hyphenated labels', async () => {
    const symbolTable = new SymbolTable();
    symbolTable.addSymbol({
      name: 'my-hyphenated-label',
      type: SymbolType.LABEL,
      uri: dummyUri,
      range: new vscode.Range(0, 0, 0, 0)
    });

    const content = '  goto my-';
    const suggestions = await getSuggestions(content, 0, 10, symbolTable);
    const labels = suggestions.map(s => s.label);
    expect(labels).toContain('my-hyphenated-label');
  });
});
