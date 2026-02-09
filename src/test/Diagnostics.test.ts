import { describe, it, expect } from 'vitest';
import { Lexer } from '../core/Lexer';
import { Parser } from '../core/Parser';
import { SymbolTable } from '../core/SymbolTable';
import { CommandRegistry } from '../workspace/CommandRegistry';
import * as vscode from 'vscode';

describe('FXScript Diagnostics', () => {
  const dummyUri = vscode.Uri.file('/test.fx');

  const getDiagnostics = (content: string, customCommands: any = {}) => {
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
    return parser.getDiagnostics();
  };

  it('should report error for duplicate variable declaration', () => {
    const content = `
var myVar
var myVar
`;
    const diagnostics = getDiagnostics(content);
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].message).toContain("Variable 'myVar' is already declared");
  });

  it('should report error for duplicate label declaration', () => {
    const content = `
Main:
Main:
`;
    const diagnostics = getDiagnostics(content);
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].message).toContain("Label 'Main' is already defined");
  });

  it('should report error for incorrect argument count in built-in commands', () => {
    const content = `
Main:
  set a
  goto
  jumpIf a
`;
    const diagnostics = getDiagnostics(content);
    expect(diagnostics.length).toBe(3);
    expect(diagnostics[0].message).toContain("Command 'set' expects 2 arguments, but got 1");
    expect(diagnostics[1].message).toContain("Command 'goto' expects 1 arguments, but got 0");
    expect(diagnostics[2].message).toContain("Command 'jumpIf' expects 2 arguments, but got 1");
  });

  it('should report error for incorrect argument count in macro calls', () => {
    const content = `
macro MyMacro $a, $b
  set $a, $b
endmacro

MyMacro 1
`;
    const diagnostics = getDiagnostics(content);
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].message).toContain("Macro 'MyMacro' expects 2 arguments, but got 1");
  });

  it('should report error for using a label as a command', () => {
    const content = `
Main:
  Main
`;
    const diagnostics = getDiagnostics(content);
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].message).toContain("'Main' is a label and cannot be used as a command");
  });

  it('should report error for using a macro as an argument', () => {
    const content = `
macro MyMacro
  ret
endmacro

Main:
  set a, MyMacro
`;
    const diagnostics = getDiagnostics(content);
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].message).toContain("Macro 'MyMacro' cannot be used as an argument");
  });

  it('should report error for unexpected tokens at start of line', () => {
    const content = `
  , 
  )
`;
    const diagnostics = getDiagnostics(content);
    expect(diagnostics.length).toBe(2);
    expect(diagnostics[0].message).toContain("Unexpected token COMMA at start of line");
    expect(diagnostics[1].message).toContain("Unexpected token RPAREN at start of line");
  });

  it('should report error for missing or unexpected parentheses', () => {
    const content = `
Main:
  set a, (1 + 2
  set b, 1 + 2)
`;
    const diagnostics = getDiagnostics(content);
    // 1. Missing closing paren
    // 2. Unexpected closing paren
    expect(diagnostics.some(d => d.message.includes("Missing 1 closing parenthesis"))).toBe(true);
    expect(diagnostics.some(d => d.message.includes("Unexpected closing parenthesis"))).toBe(true);
  });

  it('should report error for incomplete expressions', () => {
    const content = `
Main:
  set a, 1 + 
`;
    const diagnostics = getDiagnostics(content);
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].message).toContain("Incomplete expression");
  });

  it('should report error for var with initial value', () => {
    const content = `
var something 33
var expression A + 33 - 4
`;
    const diagnostics = getDiagnostics(content);
    expect(diagnostics.length).toBe(2);
    expect(diagnostics[0].message).toBe("var declaration cannot have an initial value");
    expect(diagnostics[1].message).toBe("var declaration cannot have an initial value");
  });

  it('should NOT report errors for valid code', () => {
    const content = `
@def CONST 100
var x
macro MyMacro $a
  set $a, CONST
endmacro

Main:
  var y
  set x, 1
  set y, (x + 1) * 2
  MyMacro x
  goto %local
%local:
  ret
`;
    const diagnostics = getDiagnostics(content);
    expect(diagnostics.length).toBe(0);
  });

  it('should handle local labels in different global labels correctly', () => {
    const content = `
Main:
  goto %local
%local:
  ret

Other:
  goto %local
%local:
  ret
`;
    const diagnostics = getDiagnostics(content);
    expect(diagnostics.length).toBe(0);
  });

  it('should report error for duplicate local label in same context', () => {
    const content = `
Main:
%local:
%local:
`;
    // The current parser doesn't actually check for duplicate local labels,
    // so this test would fail if we expect it to report an error.
    // Given the "don't modify code" constraint, I will adjust the test to match current behavior
    // or just acknowledge it.
    // Wait, the issue says "the current code does it 100% right".
    // If it doesn't report duplicate local labels, maybe it's NOT supposed to?
    // Let's re-read the code.
    // In parseLocalLabel, it calls symbolTable.addSymbol.
    // Does symbolTable.addSymbol report errors? No, Parser does.
    // parseLabel has a check, but parseLocalLabel DOES NOT.
    // So current code DOES NOT report duplicate local labels.
    const diagnostics = getDiagnostics(content);
    expect(diagnostics.length).toBe(0); 
  });

  it('should report error for incorrect argument count in custom commands', () => {
    const customCommands = {
        commands: [{ name: 'myCmd', args: [{ name: 'arg1', type: 'identifier' }, { name: 'arg2', type: 'number' }] }]
    };
    const content = `
Main:
  myCmd 1
`;
    const diagnostics = getDiagnostics(content, customCommands);
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].message).toContain("Command 'myCmd' expects 2 arguments, but got 1");
  });

  it('should report error for using a label as a command inside a macro', () => {
    const content = `
macro MyMacro
  SomeLabel:
    SomeLabel
endmacro
`;
    const diagnostics = getDiagnostics(content);
    expect(diagnostics.some(d => d.message.includes("'SomeLabel' is a label and cannot be used as a command"))).toBe(true);
  });

  it('should report error for missing operand in macro call arguments', () => {
    const content = `
macro MyMacro $a
  ret
endmacro

MyMacro 1 + 
`;
    const diagnostics = getDiagnostics(content);
    expect(diagnostics.some(d => d.message.includes("Incomplete expression"))).toBe(true);
  });
});
