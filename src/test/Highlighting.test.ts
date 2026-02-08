import { describe, it, expect } from 'vitest';
import { SemanticTokensProvider } from '../vscode/providers/SemanticTokensProvider';
import { SymbolTable } from '../core/SymbolTable';
import { CommandRegistry } from '../workspace/CommandRegistry';
import { Lexer } from '../core/Lexer';
import { Parser } from '../core/Parser';
import * as vscode from 'vscode';

describe('FXScript Highlighting', () => {
  const dummyUri = vscode.Uri.file('/test.fx');

  const getTokens = async (content: string, customCommands: any = {}) => {
    const lexer = new Lexer(content);
    const tokens = lexer.tokenize();
    const symbolTable = new SymbolTable();
    const commandRegistry = new CommandRegistry();

    if (customCommands.commands) {
        for (const cmd of customCommands.commands) {
            (commandRegistry as any).commands.set(cmd.name, cmd);
        }
    }

    const parser = new Parser(dummyUri, tokens, symbolTable, commandRegistry);
    parser.parseSymbols();

    const provider = new SemanticTokensProvider(symbolTable, commandRegistry);
    const document = {
      uri: dummyUri,
      lineCount: content.split('\n').length,
      lineAt: (line: number) => ({ text: content.split('\n')[line] }),
    } as vscode.TextDocument;

    const result = await provider.provideDocumentSemanticTokens(document, {} as vscode.CancellationToken);
    return result.data;
  };

  it('should highlight labels, keywords and variables', async () => {
    const content = `
Main:
  var myVar
  set myVar, 123
  goto Main
`;
    const tokens = await getTokens(content);
    // Snapshot of tokens to ensure highlighting doesn't change unexpectedly
    expect(tokens).toMatchSnapshot();
  });

  it('should highlight macros and their arguments', async () => {
    const content = `
macro MyMacro $arg
  set $arg, 1
  %inner:
  jumpIf $arg, %inner
endmacro
MyMacro 123
`;
    const tokens = await getTokens(content);
    expect(tokens).toMatchSnapshot();
  });

  it('should highlight complex labels and expressions', async () => {
    const content = `
label-with-hyphen:
  set a, (1 + 2) * 0x123
  goto label-with-hyphen
  
Global:
%local:
  jumpIf a > 0, %local
`;
    const tokens = await getTokens(content);
    expect(tokens).toMatchSnapshot();
  });

  it('should highlight custom commands', async () => {
    const customCommands = {
        commands: [{ name: 'customCmd', args: [] }]
    };
    const content = `
Main:
  customCmd
`;
    const tokens = await getTokens(content, customCommands);
    expect(tokens).toMatchSnapshot();
  });

  it('should highlight various integer bases', async () => {
    const content = `
Main:
  set a, 123
  set b, 0xABC
  set c, 0b1010
  set d, 0c755
`;
    const tokens = await getTokens(content);
    expect(tokens).toMatchSnapshot();
  });
});
