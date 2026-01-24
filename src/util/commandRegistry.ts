export interface CommandArg {
    name: string;
    type: 'identifier' | 'label' | 'number' | 'expression';
    optional?: boolean;
}

export interface Command {
    name: string;
    args: CommandArg[];
}

export interface RegistryData {
    commands: Command[];
    identifiers: string[];
    stringTags: string[];
}

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class CommandRegistry {
    private commands: Map<string, Command> = new Map();

    constructor(private extensionUri: vscode.Uri) {}

    async load(workspaceRoot?: string) {
        this.commands.clear();
        
        // Load base commands
        try {
            const baseCommandsPath = path.join(this.extensionUri.fsPath, 'data', 'base-commands.json');
            const baseData: RegistryData = JSON.parse(fs.readFileSync(baseCommandsPath, 'utf8'));
            for (const cmd of baseData.commands) {
                this.commands.set(cmd.name, cmd);
            }
        } catch (e) {
            console.error('Failed to load base commands', e);
        }

        // Load user commands
        if (workspaceRoot) {
            try {
                const userCommandsPath = path.join(workspaceRoot, 'commands.json');
                if (fs.existsSync(userCommandsPath)) {
                    const userData: RegistryData = JSON.parse(fs.readFileSync(userCommandsPath, 'utf8'));
                    for (const cmd of userData.commands) {
                        this.commands.set(cmd.name, cmd);
                    }
                }
            } catch (e) {
                console.error('Failed to load user commands', e);
            }
        }
    }

    getCommand(name: string): Command | undefined {
        return this.commands.get(name);
    }

    getAllCommands(): Command[] {
        return Array.from(this.commands.values());
    }
}
