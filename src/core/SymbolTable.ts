import * as vscode from 'vscode';

export enum SymbolType {
  VARIABLE,
  CONSTANT,
  LABEL,
  MACRO
}

export interface SymbolDefinition {
  name: string;
  type: SymbolType;
  uri: vscode.Uri;
  range: vscode.Range;
  value?: string; // For constants
  documentation?: string;
  localName?: string;
  scopeRange?: vscode.Range; // For macros, to define their internal scope
  argCount?: number;
}

export interface SymbolReference {
  name: string;
  uri: vscode.Uri;
  range: vscode.Range;
  expectedType?: SymbolType;
}

export class SymbolTable {
  private symbols: Map<string, SymbolDefinition[]> = new Map();
  private references: Map<string, SymbolReference[]> = new Map();

  public addSymbol(symbol: SymbolDefinition) {
    let defs = this.symbols.get(symbol.name) || [];
    defs.push(symbol);
    this.symbols.set(symbol.name, defs);
  }

  public addReference(reference: SymbolReference) {
    let refs = this.references.get(reference.name) || [];
    refs.push(reference);
    this.references.set(reference.name, refs);
  }

  public getSymbols(name: string): SymbolDefinition[] {
    return this.symbols.get(name) || [];
  }

  public getReferences(name: string): SymbolReference[] {
    return this.references.get(name) || [];
  }

  public getAllReferences(): { name: string, references: SymbolReference[] }[] {
    const all: { name: string, references: SymbolReference[] }[] = [];
    for (const [name, refs] of this.references.entries()) {
      all.push({ name, references: refs });
    }
    return all;
  }

  public clearFileSymbols(uri: vscode.Uri) {
    const uriString = uri.toString();
    for (const [name, defs] of this.symbols.entries()) {
      const filtered = defs.filter(d => d.uri.toString() !== uriString);
      if (filtered.length === 0) {
        this.symbols.delete(name);
      } else {
        this.symbols.set(name, filtered);
      }
    }
    for (const [name, refs] of this.references.entries()) {
      const filtered = refs.filter(r => r.uri.toString() !== uriString);
      if (filtered.length === 0) {
        this.references.delete(name);
      } else {
        this.references.set(name, filtered);
      }
    }
  }

  public getAllSymbols(): SymbolDefinition[] {
    const all: SymbolDefinition[] = [];
    for (const defs of this.symbols.values()) {
      all.push(...defs);
    }
    return all;
  }

  public getContextPrefix(uri: vscode.Uri, position: vscode.Position): string | undefined {
    const symbols = this.getAllSymbols();
    const uriString = uri.toString();

    // 1. Check if inside a macro
    for (const s of symbols) {
      if (s.type === SymbolType.MACRO && s.uri.toString() === uriString && s.scopeRange?.contains(position)) {
        return s.name;
      }
    }

    // 2. Otherwise find the last global label before the position
    let lastLabel: string | undefined;
    let lastLine = -1;
    for (const s of symbols) {
      if (s.type === SymbolType.LABEL && !s.localName && s.uri.toString() === uriString) {
        if (s.range.start.line <= position.line && s.range.start.line > lastLine) {
          lastLine = s.range.start.line;
          lastLabel = s.name;
        }
      }
    }
    return lastLabel;
  }
}
