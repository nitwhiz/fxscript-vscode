import * as vscode from 'vscode';

export enum SymbolType {
  VARIABLE,
  CONSTANT,
  LABEL,
  MACRO,
  NUMBER
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
  args?: string[];
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
  private symbolsByUri: Map<string, SymbolDefinition[]> = new Map();
  private referencesByUri: Map<string, SymbolReference[]> = new Map();

  public addSymbol(symbol: SymbolDefinition) {
    let defs = this.symbols.get(symbol.name) || [];
    defs.push(symbol);
    this.symbols.set(symbol.name, defs);

    const uriString = symbol.uri.toString();
    let uriDefs = this.symbolsByUri.get(uriString) || [];
    uriDefs.push(symbol);
    this.symbolsByUri.set(uriString, uriDefs);
  }

  public addReference(reference: SymbolReference) {
    let refs = this.references.get(reference.name) || [];
    refs.push(reference);
    this.references.set(reference.name, refs);

    const uriString = reference.uri.toString();
    let uriRefs = this.referencesByUri.get(uriString) || [];
    uriRefs.push(reference);
    this.referencesByUri.set(uriString, uriRefs);
  }

  public getSymbols(name: string): SymbolDefinition[] {
    return this.symbols.get(name) || [];
  }

  public getReferences(name: string): SymbolReference[] {
    return this.references.get(name) || [];
  }

  public getSymbolsInFile(uri: vscode.Uri): SymbolDefinition[] {
    return this.symbolsByUri.get(uri.toString()) || [];
  }

  public getReferencesInFile(uri: vscode.Uri): SymbolReference[] {
    return this.referencesByUri.get(uri.toString()) || [];
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
    const fileSymbols = this.symbolsByUri.get(uriString);
    if (fileSymbols) {
        for (const sym of fileSymbols) {
            const defs = this.symbols.get(sym.name);
            if (defs) {
                const filtered = defs.filter(d => d.uri.toString() !== uriString);
                if (filtered.length === 0) {
                    this.symbols.delete(sym.name);
                } else {
                    this.symbols.set(sym.name, filtered);
                }
            }
        }
        this.symbolsByUri.delete(uriString);
    }

    const fileRefs = this.referencesByUri.get(uriString);
    if (fileRefs) {
        for (const ref of fileRefs) {
            const refs = this.references.get(ref.name);
            if (refs) {
                const filtered = refs.filter(r => r.uri.toString() !== uriString);
                if (filtered.length === 0) {
                    this.references.delete(ref.name);
                } else {
                    this.references.set(ref.name, filtered);
                }
            }
        }
        this.referencesByUri.delete(uriString);
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
