import * as vscode from 'vscode';
import { LABEL_DEF_RE } from './util';

export class UnimplementedTreeItem extends vscode.TreeItem {
  constructor(
    public readonly labelName: string,
    public readonly fileName: string,
    public readonly uri: vscode.Uri,
    public readonly range: vscode.Range,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(labelName, collapsibleState);
    this.description = fileName;
    this.tooltip = `${fileName}:${range.start.line + 1}`;
    this.command = {
      command: 'fxscript.openUnimplemented',
      title: 'Open Unimplemented Location',
      arguments: [uri, range]
    };
  }
}

export class UnimplementedTreeDataProvider implements vscode.TreeDataProvider<UnimplementedTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<UnimplementedTreeItem | undefined | void> = new vscode.EventEmitter<UnimplementedTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<UnimplementedTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: UnimplementedTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: UnimplementedTreeItem): Promise<UnimplementedTreeItem[]> {
    if (element) return [];

    const items: UnimplementedTreeItem[] = [];
    const uris = await vscode.workspace.findFiles('**/*.fx');

    for (const uri of uris) {
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        const fileName = vscode.workspace.asRelativePath(uri);

        for (let i = 0; i < doc.lineCount; i++) {
          const line = doc.lineAt(i);
          const text = line.text;
          // Updated regex to find _notImplemented anywhere in the line, possibly as a comma-separated command
          const niMatch = text.match(/(?:^|\s|,)\s*(_notImplemented)\b/);
          if (niMatch) {
            // Find the nearest label above this line
            let labelName = 'unknown';
            for (let j = i; j >= 0; j--) {
              const prevLine = doc.lineAt(j).text;
              const lm = prevLine.match(LABEL_DEF_RE);
              if (lm) {
                labelName = lm[1].slice(0, -1);
                break;
              }
            }
            const startIdx = text.indexOf('_notImplemented');
            const range = new vscode.Range(i, startIdx, i, startIdx + '_notImplemented'.length);
            items.push(new UnimplementedTreeItem(labelName, fileName, uri, range, vscode.TreeItemCollapsibleState.None));
          }
        }
      } catch {
        // ignore
      }
    }

    return items.sort((a, b) => a.range.start.line - b.range.start.line || a.fileName.localeCompare(b.fileName));
  }
}
