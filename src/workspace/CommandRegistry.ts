import * as vscode from 'vscode';
import * as fs from 'fs';

export interface CommandArgument {
  type: 'identifier' | 'label' | 'number' | 'string';
}

export interface Command {
  name: string;
  args?: { [key: string]: CommandArgument }[];
}

export class CommandRegistry {
  private commands: Map<string, Command> = new Map();
  private identifiers: Set<string> = new Set();
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.watchCommands();
    this.loadCommands();
  }

  private watchCommands() {
    const watcher = vscode.workspace.createFileSystemWatcher('**/commands.json');
    watcher.onDidChange(() => this.loadCommands());
    watcher.onDidCreate(() => this.loadCommands());
    watcher.onDidDelete(() => {
      this.commands.clear();
      this.identifiers.clear();
    });
    this.disposables.push(watcher);
  }

  private async loadCommands() {
    const files = await vscode.workspace.findFiles('**/commands.json');
    if (files.length > 0) {
      try {
        const content = fs.readFileSync(files[0].fsPath, 'utf8');
        const data = JSON.parse(content);
        
        this.commands.clear();
        if (data.commands && Array.isArray(data.commands)) {
          for (const cmd of data.commands) {
            this.commands.set(cmd.name, cmd);
          }
        }

        this.identifiers.clear();
        if (data.identifiers && Array.isArray(data.identifiers)) {
          for (const id of data.identifiers) {
            this.identifiers.add(id);
          }
        }
      } catch (e) {
        console.error('Failed to load commands.json', e);
      }
    }
  }

  public getCommand(name: string): Command | undefined {
    return this.commands.get(name);
  }

  public getAllCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  public hasIdentifier(name: string): boolean {
    return this.identifiers.has(name);
  }

  public getAllIdentifiers(): string[] {
    return Array.from(this.identifiers);
  }

  public dispose() {
    this.disposables.forEach(d => d.dispose());
  }
}
