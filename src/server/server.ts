import {
    createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    InitializeResult,
    Location,
    Range,
    DefinitionParams
} from 'vscode-languageserver/node';

import {
    TextDocument
} from 'vscode-languageserver-textdocument';

import * as fs from 'fs';
import * as path from 'path';
import { URI } from 'vscode-uri';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: [' ', ',', '@']
            },
            definitionProvider: true,
            referencesProvider: true
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});

connection.onInitialized(() => {
    connection.console.log('Server initialized');
    if (hasConfigurationCapability) {
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
    // Initial indexing
    indexWorkspace();
});

// Define symbol types
interface SymbolInfo {
    name: string;
    kind: CompletionItemKind;
    location: Location;
}

interface WorkspaceSymbols {
    labels: Map<string, SymbolInfo[]>;
    variables: Map<string, SymbolInfo[]>;
    constants: Map<string, SymbolInfo[]>;
    macros: Map<string, SymbolInfo[]>;
}

let workspaceSymbols: WorkspaceSymbols = {
    labels: new Map(),
    variables: new Map(),
    constants: new Map(),
    macros: new Map()
};

let customCommands: any[] = [];
let customIdentifiers: string[] = [];

// Re-index all files in workspace
async function indexWorkspace() {
    workspaceSymbols = {
        labels: new Map(),
        variables: new Map(),
        constants: new Map(),
        macros: new Map()
    };

    const folders = await connection.workspace.getWorkspaceFolders();
    if (folders) {
        for (const folder of folders) {
            const rootPath = URI.parse(folder.uri).fsPath;
            await indexDirectory(rootPath);
            await loadCommandsJson(rootPath);
        }
    }
}

async function loadCommandsJson(rootPath: string) {
    const commandsPath = path.join(rootPath, 'commands.json');
    if (fs.existsSync(commandsPath)) {
        try {
            const content = fs.readFileSync(commandsPath, 'utf8');
            const data = JSON.parse(content);
            customCommands = data.commands || [];
            customIdentifiers = data.identifiers || [];
        } catch (e) {
            connection.console.error(`Failed to load commands.json: ${e}`);
        }
    }
}

async function indexDirectory(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && !file.startsWith('.')) {
                await indexDirectory(fullPath);
            }
        } else if (file.endsWith('.fx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            indexFile(URI.file(fullPath).toString(), content);
        }
    }
}

function indexFile(uri: string, content: string) {
    const lines = content.split(/\r?\n/);

    // Clear previous symbols for this file
    const clearFileSymbols = (map: Map<string, SymbolInfo[]>) => {
        for (const [name, infos] of map.entries()) {
            const filtered = infos.filter(info => info.location.uri !== uri);
            if (filtered.length === 0) {
                map.delete(name);
            } else {
                map.set(name, filtered);
            }
        }
    };

    clearFileSymbols(workspaceSymbols.labels);
    clearFileSymbols(workspaceSymbols.variables);
    clearFileSymbols(workspaceSymbols.constants);
    clearFileSymbols(workspaceSymbols.macros);

    const diagnostics: Diagnostic[] = [];

    lines.forEach((line, i) => {
        // Label definitions: LabelName: or %_LocalLabel:
        const labelMatch = line.match(/^\s*([%_a-zA-Z0-9]+):/);
        if (labelMatch) {
            addSymbol(workspaceSymbols.labels, labelMatch[1], CompletionItemKind.Function, uri, i, line.indexOf(labelMatch[1]));
        }

        // Variable definitions: var name
        const varMatch = line.match(/\bvar\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (varMatch) {
            addSymbol(workspaceSymbols.variables, varMatch[1], CompletionItemKind.Variable, uri, i, line.indexOf(varMatch[1]));
        }

        // Constant definitions: const name value or @const name:value
        const constMatch = line.match(/\bconst\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (constMatch) {
            addSymbol(workspaceSymbols.constants, constMatch[1], CompletionItemKind.Constant, uri, i, line.indexOf(constMatch[1]));
        }

        const atConstMatch = line.match(/@const\s+([^\s#]+)(?:\s+#\s*([a-zA-Z_][a-zA-Z0-9_]*))?/);
        if (atConstMatch) {
            const externalName = atConstMatch[1];
            addSymbol(workspaceSymbols.constants, externalName, CompletionItemKind.Constant, uri, i, line.indexOf(externalName));

            const renderedName = atConstMatch[2];
            if (renderedName) {
                addSymbol(workspaceSymbols.constants, renderedName, CompletionItemKind.Constant, uri, i, line.indexOf(renderedName));
            }
        }

        // Macro definitions: macro Name
        const macroMatch = line.match(/\bmacro\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (macroMatch) {
            addSymbol(workspaceSymbols.macros, macroMatch[1], CompletionItemKind.Module, uri, i, line.indexOf(macroMatch[1]));
        }

        // Basic validation: Unknown command (very naive)
        const commandMatch = line.match(/^\s*([a-zA-Z0-9_]+)\b/);
        if (commandMatch && !line.trim().startsWith('@') && !line.trim().startsWith('#') && !line.includes(':')) {
            const cmdName = commandMatch[1];
            if (!builtInCommands.includes(cmdName) &&
                !customCommands.some(c => c.name === cmdName) &&
                !workspaceSymbols.macros.has(cmdName) &&
                cmdName !== 'var' && cmdName !== 'const' && cmdName !== 'macro' && cmdName !== 'endmacro' &&
                !workspaceSymbols.constants.has(cmdName)) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: Range.create(i, line.indexOf(cmdName), i, line.indexOf(cmdName) + cmdName.length),
                    message: `Unknown command or macro: ${cmdName}`,
                    source: 'fxscript'
                });
            }
        }
    });

    connection.sendDiagnostics({ uri, diagnostics });
}

function addSymbol(map: Map<string, SymbolInfo[]>, name: string, kind: CompletionItemKind, uri: string, line: number, character: number) {
    if (!map.has(name)) {
        map.set(name, []);
    }
    map.get(name)!.push({
        name,
        kind,
        location: {
            uri,
            range: Range.create(line, character, line, character + name.length)
        }
    });
}

documents.onDidOpen(e => {
    indexFile(e.document.uri, e.document.getText());
});

documents.onDidSave(e => {
    indexFile(e.document.uri, e.document.getText());
});

connection.onDidChangeWatchedFiles(_change => {
    indexWorkspace();
    // Re-validate all open documents after re-indexing
    documents.all().forEach(doc => indexFile(doc.uri, doc.getText()));
});

const builtInCommands = ['set', 'goto', 'call', 'ret', 'jumpIf', 'nop', 'push', 'pop'];

connection.onCompletion((_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    const completions: CompletionItem[] = [];

    // Add built-in commands
    builtInCommands.forEach(cmd => {
        completions.push({
            label: cmd,
            kind: CompletionItemKind.Keyword
        });
    });

    // Add custom commands
    customCommands.forEach(cmd => {
        completions.push({
            label: cmd.name,
            kind: CompletionItemKind.Function,
            detail: 'Custom command'
        });
    });

    // Add macros
    for (const name of workspaceSymbols.macros.keys()) {
        completions.push({
            label: name,
            kind: CompletionItemKind.Module
        });
    }

    // Add labels (often used after goto, call, jumpIf)
    for (const name of workspaceSymbols.labels.keys()) {
        completions.push({
            label: name,
            kind: CompletionItemKind.Function
        });
    }

    // Add variables and constants
    for (const name of workspaceSymbols.variables.keys()) {
        completions.push({
            label: name,
            kind: CompletionItemKind.Variable
        });
    }
    for (const name of workspaceSymbols.constants.keys()) {
        completions.push({
            label: name,
            kind: CompletionItemKind.Constant
        });
    }
    customIdentifiers.forEach(id => {
        completions.push({
            label: id,
            kind: CompletionItemKind.Variable,
            detail: 'Custom identifier'
        });
    });

    return completions;
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return item;
});

connection.onDefinition((params: DefinitionParams): Location[] | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const line = document.getText(Range.create(params.position.line, 0, params.position.line, 1000));
    const wordMatch = getWordAt(line, params.position.character);
    if (!wordMatch) return null;

    const word = wordMatch.word;

    // Search in labels, variables, constants, macros
    const sources = [
        workspaceSymbols.labels,
        workspaceSymbols.variables,
        workspaceSymbols.constants,
        workspaceSymbols.macros
    ];

    for (const source of sources) {
        if (source.has(word)) {
            return source.get(word)!.map(info => info.location);
        }
    }

    // Handle @include
    if (line.includes('@include')) {
        const includeMatch = line.match(/@include\s+([a-zA-Z0-9._-]+)/);
        if (includeMatch && includeMatch[1] === word) {
             // Try to find the file
             const currentDir = path.dirname(URI.parse(params.textDocument.uri).fsPath);
             const targetPath = path.join(currentDir, word);
             if (fs.existsSync(targetPath)) {
                 return [{
                     uri: URI.file(targetPath).toString(),
                     range: Range.create(0, 0, 0, 0)
                 }];
             }
        }
    }

    return null;
});

function getWordAt(line: string, character: number) {
    const left = line.substring(0, character).split(/[^a-zA-Z0-9_%$.]/).pop()!;
    const right = line.substring(character).split(/[^a-zA-Z0-9_%$.]/)[0];
    if (!left && !right) return null;
    return {
        word: left + right,
        start: character - left.length
    };
}

connection.onReferences((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const line = document.getText(Range.create(params.position.line, 0, params.position.line, 1000));
    const wordMatch = getWordAt(line, params.position.character);
    if (!wordMatch) return null;

    const word = wordMatch.word;
    const references: Location[] = [];

    // This is a naive implementation: search all files for the word
    // In a real implementation, we would use a more sophisticated index or a parser
    for (const doc of documents.all()) {
        const text = doc.getText();
        let match;
        const regex = new RegExp(`\\b${word.replace('%', '\\%')}\\b`, 'g');
        while ((match = regex.exec(text)) !== null) {
            const pos = doc.positionAt(match.index);
            references.push({
                uri: doc.uri,
                range: Range.create(pos.line, pos.character, pos.line, pos.character + word.length)
            });
        }
    }

    return references;
});

documents.listen(connection);
connection.listen();

// Removed redundant initial indexing at the end
