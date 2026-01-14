import * as vscode from 'vscode';
import { ConstType, LabelDef, ConstDef, MacroDef } from './types';
import { extractSymbolsFromText, MACRO_DEF_RE, LABEL_DEF_RE, CONST_DEF_RE } from './util';

export async function collectWorkspaceSymbols(): Promise<{ macros: string[]; consts: { name: string; type: ConstType }[]; labels: string[] }> {
  const macros = new Set<string>();
  const consts = new Map<string, ConstType>();
  const labels = new Set<string>();
  const uris = await vscode.workspace.findFiles('**/*.fx');
  for (const uri of uris) {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const { macros: m, consts: c, labels: l } = extractSymbolsFromText(doc.getText());
      m.forEach(x => macros.add(x));
      c.forEach(x => consts.set(x.name, x.type));
      l.forEach(x => labels.add(x));
    } catch {
      // ignore
    }
  }
  return { macros: [...macros], consts: [...consts.entries()].map(([name, type]) => ({ name, type })), labels: [...labels] };
}

export async function collectAllMacroDefinitions(): Promise<Map<string, MacroDef[]>> {
  const map = new Map<string, MacroDef[]>();
  const uris = await vscode.workspace.findFiles('**/*.fx');
  for (const uri of uris) {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        const trimmed = text.trimStart();
        if (trimmed.startsWith('#')) continue;
        const m = trimmed.match(MACRO_DEF_RE);
        if (m) {
          const name = m[1];
          const startIdx = text.indexOf(name);
          const start = new vscode.Position(i, startIdx);
          const end = new vscode.Position(i, startIdx + name.length);

          const strictDocs: string[] = [];
          for (let j = i - 1; j >= 0; j--) {
            const prevLine = doc.lineAt(j).text.trim();
            if (prevLine.startsWith('#')) {
              strictDocs.unshift(prevLine.slice(1).trim());
            } else {
              break;
            }
          }

          const entry: MacroDef = {
            name,
            uri,
            range: new vscode.Range(start, end),
            documentation: strictDocs.length > 0 ? strictDocs.join('\n\n') : undefined
          };
          const arr = map.get(name) || [];
          arr.push(entry);
          map.set(name, arr);
        }
      }
    } catch {
      // ignore
    }
  }
  return map;
}

export async function collectAllLabelDefinitions(): Promise<Map<string, LabelDef[]>> {
  const map = new Map<string, LabelDef[]>();
  const uris = await vscode.workspace.findFiles('**/*.fx');
  for (const uri of uris) {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        const trimmed = text.trimStart();
        if (trimmed.startsWith('#')) continue;
        const m = text.match(LABEL_DEF_RE);
        if (m) {
          const nameWithColon = m[1];
          const name = nameWithColon.slice(0, -1);
          const startIdx = text.indexOf(name);
          const start = new vscode.Position(i, startIdx);
          const end = new vscode.Position(i, startIdx + name.length);

          const docs: string[] = [];
          for (let j = i - 1; j >= 0; j--) {
            const prevLine = doc.lineAt(j).text.trim();
            if (prevLine.startsWith('#')) {
              docs.unshift(prevLine.slice(1).trim());
            } else {
              break;
            }
          }

          const entry: LabelDef = {
            name,
            uri,
            range: new vscode.Range(start, end),
            documentation: docs.length > 0 ? docs.join('\n\n') : undefined
          };
          const arr = map.get(name) || [];
          arr.push(entry);
          map.set(name, arr);
        }
      }
    } catch {
      // ignore
    }
  }
  return map;
}

export async function collectAllConstDefinitions(): Promise<Map<string, ConstDef[]>> {
  const map = new Map<string, ConstDef[]>();
  const uris = await vscode.workspace.findFiles('**/*.fx');
  for (const uri of uris) {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        const trimmed = text.trimStart();
        if (trimmed.startsWith('#')) continue;
        const m = text.match(CONST_DEF_RE);
        if (m) {
          const name = m[1];
          const startIdx = text.indexOf(name);
          const start = new vscode.Position(i, startIdx);
          const end = new vscode.Position(i, startIdx + name.length);

          const entry: ConstDef = {
            name,
            uri,
            range: new vscode.Range(start, end)
          };
          const arr = map.get(name) || [];
          arr.push(entry);
          map.set(name, arr);
        }
      }
    } catch {
      // ignore
    }
  }
  return map;
}

export class SymbolCache {
  private cache: { macros: string[]; consts: { name: string; type: ConstType }[]; labels: string[] } = { macros: [], consts: [], labels: [] };
  private labelDefs: Map<string, LabelDef[]> = new Map();
  private macroDefs: Map<string, MacroDef[]> = new Map();
  private constDefs: Map<string, ConstDef[]> = new Map();
  private onRefreshListeners: (() => void)[] = [];

  async refresh() {
    this.cache = await collectWorkspaceSymbols();
    try {
      this.labelDefs = await collectAllLabelDefinitions();
      this.macroDefs = await collectAllMacroDefinitions();
      this.constDefs = await collectAllConstDefinitions();
    } catch {
      this.labelDefs = new Map();
      this.macroDefs = new Map();
      this.constDefs = new Map();
    }
    this.onRefreshListeners.forEach(l => l());
  }

  get symbols() {
    return this.cache;
  }

  get workspaceLabels() {
    return this.labelDefs;
  }

  get workspaceMacros() {
    return this.macroDefs;
  }

  get workspaceConsts() {
    return this.constDefs;
  }

  onRefresh(listener: () => void) {
    this.onRefreshListeners.push(listener);
  }
}
