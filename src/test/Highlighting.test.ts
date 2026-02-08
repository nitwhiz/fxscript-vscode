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

  it('should highlight identifiers in various contexts', async () => {
    const content = `
@def MY_CONST 42
var myVar
Main:
  set myVar, MY_CONST + 1
%local:
  set myVar, myVar * 2
  jumpIf myVar > 0, %local
`;
    const tokens = await getTokens(content);
    expect(tokens).toMatchSnapshot();
  });

  it('should highlight macro arguments inside macro', async () => {
    const content = `
macro MyMacro $arg1, $arg2
  set $arg1, $arg2
endmacro
`;
    const tokens = await getTokens(content);
    expect(tokens).toMatchSnapshot();
  });

  it('should highlight @def directive and its value', async () => {
    const content = `
@def SOME_VALUE 100
`;
    const tokens = await getTokens(content);
    expect(tokens).toMatchSnapshot();
  });

  it('should highlight identifiers used as arguments to custom commands', async () => {
    const customCommands = {
        commands: [{ name: 'myCmd', args: [{ 'arg1': { type: 'identifier' } }] }]
    };
    const content = `
var x
Main:
  myCmd x
`;
    const tokens = await getTokens(content, customCommands);
    expect(tokens).toMatchSnapshot();
  });

  it('should highlight various operators as keywords if they are at start of line (rare but possible in some grammars)', async () => {
     // Testing how the parser handles weird start of lines
     const content = `
+ 1, 2
`;
     const tokens = await getTokens(content);
     expect(tokens).toMatchSnapshot();
  });

  it('should highlight nested expressions correctly', async () => {
    const content = `
Main:
  set a, (1 + (2 * (3 / 4)))
`;
    const tokens = await getTokens(content);
    expect(tokens).toMatchSnapshot();
  });

  it('should highlight identifiers in jumpIf conditions', async () => {
    const content = `
Main:
  jumpIf a > b && c == d, Main
`;
    const tokens = await getTokens(content);
    expect(tokens).toMatchSnapshot();
  });
});
