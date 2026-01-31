import * as vscode from 'vscode';
import { SymbolTable, SymbolType } from '../../core/SymbolTable';

export class WorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
  constructor(private symbolTable: SymbolTable) {}

  public async provideWorkspaceSymbols(
    query: string,
    _token: vscode.CancellationToken
  ): Promise<vscode.SymbolInformation[]> {
    const symbols = this.symbolTable.getAllSymbols();
    const filtered = symbols.filter(s => 
        s.name.toLowerCase().includes(query.toLowerCase()) || 
        (s.localName && s.localName.toLowerCase().includes(query.toLowerCase()))
    );

    return filtered.map(s => {
      let kind = vscode.SymbolKind.Variable;
      switch (s.type) {
        case SymbolType.VARIABLE:
          kind = vscode.SymbolKind.Variable;
          break;
        case SymbolType.CONSTANT:
          kind = vscode.SymbolKind.Constant;
          break;
        case SymbolType.LABEL:
          kind = vscode.SymbolKind.Function;
          break;
        case SymbolType.MACRO:
          kind = vscode.SymbolKind.Module;
          break;
      }
      const label = s.localName ? `${s.localName} (${s.name})` : s.name;
      return new vscode.SymbolInformation(label, kind, s.range, s.uri);
    });
  }
}
