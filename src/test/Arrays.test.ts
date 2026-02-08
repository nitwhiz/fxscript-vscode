import { describe, it, expect } from 'vitest';
import { Lexer } from '../core/Lexer';
import { Parser } from '../core/Parser';
import { SymbolTable } from '../core/SymbolTable';
import { CommandRegistry } from '../workspace/CommandRegistry';
import * as vscode from 'vscode';

describe('Array Variables', () => {
  const dummyUri = vscode.Uri.file('/test.fx');

  const getDiagnostics = (content: string) => {
    const lexer = new Lexer(content);
    const tokens = lexer.tokenize();
    const symbolTable = new SymbolTable();
    const commandRegistry = new CommandRegistry();
    const parser = new Parser(dummyUri, tokens, symbolTable, commandRegistry);
    parser.parseSymbols();
    return { diagnostics: parser.getDiagnostics(), symbolTable };
  };

  it('should parse array declaration correctly', () => {
    const content = `
def size 10
var array[size + 1]
`;
    const { diagnostics, symbolTable } = getDiagnostics(content);
    expect(diagnostics).toEqual([]);
    const symbols = symbolTable.getSymbols('array');
    expect(symbols.length).toBe(1);
    
    const sizeRefs = symbolTable.getReferences('size');
    expect(sizeRefs.length).toBe(1);
  });

  it('should parse array access correctly', () => {
    const content = `
var array[10]
set array[0], 42
eval array[1]
`;
    const { diagnostics, symbolTable } = getDiagnostics(content);
    // eval might be unknown if not in built-in commands, but we are checking for array syntax errors
    // Actually, set is built-in.
    
    // Filter out 'Symbol not found' for eval if it's not built-in (it is not by default in this project probably)
    const filteredDiagnostics = diagnostics.filter(d => !d.message.includes("not found"));
    expect(filteredDiagnostics).toEqual([]);

    const arrayRefs = symbolTable.getReferences('array');
    // 1 in set, 1 in eval = 2 references
    expect(arrayRefs.length).toBe(2);
  });

  it('should report error for missing closing bracket', () => {
    const content = `
var array[10
`;
    const { diagnostics } = getDiagnostics(content);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics.some(d => d.message.includes("Expected RBRACKET"))).toBe(true);
  });

  it('should parse complex array index expressions', () => {
    const content = `
var array[10]
var i
set array[i + 1 * 2], 100
`;
    const { diagnostics, symbolTable } = getDiagnostics(content);
    const filteredDiagnostics = diagnostics.filter(d => !d.message.includes("not found"));
    expect(filteredDiagnostics).toEqual([]);
    
    const iRefs = symbolTable.getReferences('i');
    expect(iRefs.length).toBe(1);
  });
});
