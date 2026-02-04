import { describe, it, expect } from 'vitest';
import { Lexer } from '../core/Lexer';
import { Parser } from '../core/Parser';
import { SymbolTable, SymbolType } from '../core/SymbolTable';
import { CommandRegistry } from '../workspace/CommandRegistry';
import * as vscode from 'vscode';

describe('FXScript Parsing', () => {
  const dummyUri = vscode.Uri.file('/test.fx');

  const parse = (content: string, customCommands: any = {}) => {
    const lexer = new Lexer(content);
    const tokens = lexer.tokenize();
    const symbolTable = new SymbolTable();
    const commandRegistry = new CommandRegistry();

    // Manually inject custom commands to avoid FS dependency in basic parsing tests
    if (customCommands.commands) {
        for (const cmd of customCommands.commands) {
            (commandRegistry as any).commands.set(cmd.name, cmd);
        }
    }
    if (customCommands.identifiers) {
        for (const id of customCommands.identifiers) {
            (commandRegistry as any).identifiers.add(id);
        }
    }

    const parser = new Parser(dummyUri, tokens, symbolTable, commandRegistry);
    parser.parseSymbols();
    return { symbolTable, diagnostics: parser.getDiagnostics() };
  };

  it('should parse labels', () => {
    const content = `
Main:
  set a, 1
%_local:
  goto Main
label-with-hyphen:
  goto label-with-hyphen
%local-with-hyphen:
  goto %local-with-hyphen
    `;
    const { symbolTable } = parse(content);
    const symbols = symbolTable.getAllSymbols();

    const mainLabel = symbols.find(s => s.name === 'Main');
    expect(mainLabel).toBeDefined();
    expect(mainLabel?.type).toBe(SymbolType.LABEL);

    // Prefix for local label outside macro is the last global label
    const localLabel = symbols.find(s => s.name === 'Main%_local');
    expect(localLabel).toBeDefined();
    expect(localLabel?.type).toBe(SymbolType.LABEL);

    const hyphenLabel = symbols.find(s => s.name === 'label-with-hyphen');
    expect(hyphenLabel).toBeDefined();

    const localHyphenLabel = symbols.find(s => s.name === 'label-with-hyphen%local-with-hyphen');
    expect(localHyphenLabel).toBeDefined();
  });

  it('should handle local labels in macros', () => {
    const content = `
macro MyMacro
%inner:
  jumpIf 1, %inner
endmacro

GlobalLabel:
%inner:
    `;
    const { symbolTable } = parse(content);
    
    // In MyMacro, %inner should be MyMacro%inner
    const macroInner = symbolTable.getSymbols('MyMacro%inner');
    expect(macroInner).toHaveLength(1);

    // After GlobalLabel, %inner should be GlobalLabel%inner
    const globalInner = symbolTable.getSymbols('GlobalLabel%inner');
    expect(globalInner).toHaveLength(1);
  });

  it('should parse var and @def', () => {
    const content = `
var myVar
@def myConst
    `;
    const { symbolTable } = parse(content);
    const symbols = symbolTable.getAllSymbols();

    const myVar = symbols.find(s => s.name === 'myVar');
    expect(myVar).toBeDefined();
    expect(myVar?.type).toBe(SymbolType.VARIABLE);

    const myConst = symbols.find(s => s.name === 'myConst');
    expect(myConst).toBeDefined();
    expect(myConst?.type).toBe(SymbolType.CONSTANT);
  });

  it('should parse macros', () => {
    const content = `
macro MyMacro $arg1, $arg2
  set $arg1, $arg2
endmacro
    `;
    const { symbolTable } = parse(content);
    const symbols = symbolTable.getAllSymbols();

    const myMacro = symbols.find(s => s.name === 'MyMacro');
    expect(myMacro).toBeDefined();
    expect(myMacro?.type).toBe(SymbolType.MACRO);
    expect(myMacro?.args).toContain('$arg1');
    expect(myMacro?.args).toContain('$arg2');
  });

  it('should parse complex expressions and nested parentheses', () => {
    const content = `
Main:
  set a, ((1 + 2) * (3 - 4)) / 5
  set b, a + (1 << 2) | 0xFF
    `;
    const { diagnostics } = parse(content);
    expect(diagnostics).toHaveLength(0);
  });

  it('should handle macro calls as commands', () => {
    const content = `
macro Outer $a
  set $a, 1
endmacro

macro Inner
  Outer 123
endmacro

Main:
  Inner
    `;
    const { symbolTable, diagnostics } = parse(content);
    expect(diagnostics).toHaveLength(0);
    
    const references = symbolTable.getAllReferences();
    expect(references.some(r => r.name === 'Outer')).toBe(true);
    expect(references.some(r => r.name === 'Inner')).toBe(true);
  });

  it('should report diagnostics for various error cases', () => {
    // 1. Label already defined
    const labelError = `
Main:
Main:
`;
    const { diagnostics: labelDiag } = parse(labelError);
    expect(labelDiag.some(d => d.message.includes("already defined"))).toBe(true);

    // 2. Variable already declared
    const varError = `
var myVar
var myVar
`;
    const { diagnostics: varDiag } = parse(varError);
    expect(varDiag.some(d => d.message.includes("already declared"))).toBe(true);

    // 3. Label used as command
    const labelAsCommand = `
MyLabel:
  MyLabel
`;
    const { diagnostics: labelAsCmdDiag } = parse(labelAsCommand);
    expect(labelAsCmdDiag.some(d => d.message.includes("label and cannot be used as a command"))).toBe(true);

    // 4. Incorrect argument count for built-in command
    const builtInArgError = `
  set 1
`;
    const { diagnostics: builtInDiag } = parse(builtInArgError);
    expect(builtInDiag.some(d => d.message.includes("expects 2 arguments, but got 1"))).toBe(true);

    // 5. Incorrect argument count for macro
    const macroArgError = `
macro MyMacro $a, $b
endmacro
MyMacro 1
`;
    const { diagnostics: macroDiag } = parse(macroArgError);
    expect(macroDiag.some(d => d.message.includes("expects 2 arguments, but got 1"))).toBe(true);

    // 6. Unexpected closing parenthesis
    const parenError = `
  set a, (1 + 2))
`;
    const { diagnostics: parenDiag } = parse(parenError);
    expect(parenDiag.some(d => d.message.includes("Unexpected closing parenthesis"))).toBe(true);

    // 7. Missing closing parenthesis
    const missingParenError = `
  set a, (1 + 2
`;
    const { diagnostics: missingParenDiag } = parse(missingParenError);
    expect(missingParenDiag.some(d => d.message.includes("Missing 1 closing parenthesis"))).toBe(true);

    // 8. Incomplete expression
    const incompleteExprError = `
  set a, 1 +
`;
    const { diagnostics: incompleteDiag } = parse(incompleteExprError);
    expect(incompleteDiag.some(d => d.message.includes("Incomplete expression"))).toBe(true);

    // 9. Macro used as argument
    const macroAsArgError = `
macro MyMacro
endmacro
  set a, MyMacro
`;
    const { diagnostics: macroAsArgDiag } = parse(macroAsArgError);
    expect(macroAsArgDiag.some(d => d.message.includes("cannot be used as an argument"))).toBe(true);

    // 10. Unexpected token at start of line
    const unexpectedTokenError = `
  )
`;
    const { diagnostics: unexpectedDiag } = parse(unexpectedTokenError);
    expect(unexpectedDiag.some(d => d.message.includes("Unexpected token RPAREN at start of line"))).toBe(true);
  });
});
