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
    DefinitionParams,
    InlayHint,
    InlayHintParams,
    InlayHintKind,
    InlayHintRequest
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
            referencesProvider: true,
            inlayHintProvider: true,
            hoverProvider: true
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
    files: Map<string, string>;
}

let workspaceSymbols: WorkspaceSymbols = {
    labels: new Map(),
    variables: new Map(),
    constants: new Map(),
    macros: new Map(),
    files: new Map<string, string>()
};

const builtInCommands = [
    'set', 'goto', 'call', 'ret', 'jumpIf', 'nop', 'push', 'pop'
];

let customCommands: any[] = [];
let customIdentifiers: string[] = [];

// Re-index all files in workspace
async function indexWorkspace() {
    workspaceSymbols = {
        labels: new Map(),
        variables: new Map(),
        constants: new Map(),
        macros: new Map(),
        files: new Map()
    };

    const folders = await connection.workspace.getWorkspaceFolders();
    if (folders) {
        for (const folder of folders) {
            const rootPath = URI.parse(folder.uri).fsPath;
            await loadCommandsJson(rootPath);
            await indexDirectory(rootPath);
        }
    }
    // Validate all documents after initial indexing
    documents.all().forEach(doc => validateFile(doc.uri));
}

async function loadCommandsJson(rootPath: string) {
    const findCommandsJson = (dir: string): string | null => {
        const filePath = path.join(dir, 'commands.json');
        if (fs.existsSync(filePath)) {
            return filePath;
        }
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory() && file !== 'node_modules' && !file.startsWith('.')) {
                const found = findCommandsJson(fullPath);
                if (found) return found;
            }
        }
        return null;
    };

    const commandsPath = findCommandsJson(rootPath);
    if (commandsPath) {
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
    workspaceSymbols.files.set(uri, content);
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

    let currentMacro: string | null = null;
    let currentLabel: string | null = null;

    lines.forEach((line, i) => {
        const trimmedLine = line.trim();
        // Skip empty lines
        if (trimmedLine === '') {
            return;
        }

        // Macro definitions: macro Name $arg1, $arg2...
        const macroMatch = line.match(/^\s*macro\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (macroMatch) {
            currentMacro = macroMatch[1];
            currentLabel = null;
            addSymbol(workspaceSymbols.macros, macroMatch[1], CompletionItemKind.Module, uri, i, line.indexOf(macroMatch[1]));
            return;
        }

        const endMacroMatch = line.match(/^\s*endmacro\b/);
        if (endMacroMatch) {
            currentMacro = null;
            currentLabel = null;
            return;
        }
        
        // Label definitions: LabelName: or %_LocalLabel:
        const labelMatch = line.match(/^\s*([%_a-zA-Z0-9\.$\-]+):(?!\S)/);
        if (labelMatch) {
            let labelName = labelMatch[1];
            if (labelName.startsWith('%')) {
                const prefix = currentMacro || currentLabel;
                if (prefix) {
                    labelName = prefix + labelName;
                }
            } else {
                currentLabel = labelName;
            }
            addSymbol(workspaceSymbols.labels, labelName, CompletionItemKind.Function, uri, i, line.indexOf(labelMatch[1]));
            return; // It's a label definition, no need to check for command
        }

        // Variable definitions: var name
        const varMatch = line.match(/^\s*var\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (varMatch) {
            addSymbol(workspaceSymbols.variables, varMatch[1], CompletionItemKind.Variable, uri, i, line.indexOf(varMatch[1]));
            return;
        }

        // Constant definitions: const name value
        const constMatch = line.match(/^\s*const\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (constMatch) {
            addSymbol(workspaceSymbols.constants, constMatch[1], CompletionItemKind.Constant, uri, i, line.indexOf(constMatch[1]));
            return;
        }

        // Directives: @include, @const
        const atConstMatch = line.match(/^\s*(@const)\s+([^\s#]+)/);
        if (atConstMatch) {
            const externalName = atConstMatch[2];
            addSymbol(workspaceSymbols.constants, externalName, CompletionItemKind.Constant, uri, i, line.indexOf(externalName));

            // Check line ABOVE for name
            if (i > 0) {
                const lineAbove = lines[i - 1].trim();
                if (lineAbove.startsWith('#')) {
                    const commentContent = lineAbove.substring(1).trim();
                    const commentParts = commentContent.split(/\s+/);
                    if (commentParts.length > 0) {
                        const renderedName = commentParts[0];
                        // Only add as constant if it looks like a valid identifier
                        if (renderedName.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
                            addSymbol(workspaceSymbols.constants, renderedName, CompletionItemKind.Constant, uri, i - 1, lines[i - 1].indexOf(renderedName));
                        }
                    }
                }
            }
            return;
        }
    });
}

function validateFile(uri: string) {
    const content = workspaceSymbols.files.get(uri);
    if (content === undefined) return;

    const lines = content.split(/\r?\n/);
    const diagnostics: Diagnostic[] = [];

    let currentMacro: string | null = null;
    let currentLabel: string | null = null;

    lines.forEach((line, i) => {
        const trimmedLine = line.trim();
        if (trimmedLine === '') return;

        const macroMatch = line.match(/^\s*macro\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (macroMatch) {
            currentMacro = macroMatch[1];
            currentLabel = null;
            return;
        }

        const endMacroMatch = line.match(/^\s*endmacro\b/);
        if (endMacroMatch) {
            currentMacro = null;
            currentLabel = null;
            return;
        }

        const labelMatch = line.match(/^\s*([%_a-zA-Z0-9\.$\-]+):(?!\S)/);
        if (labelMatch) {
            const labelName = labelMatch[1];
            if (!labelName.startsWith('%')) {
                currentLabel = labelName;
            }
            return;
        }

        const constMatch = line.match(/^\s*const\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (constMatch) {
            const constParts = trimmedLine.split(/\s+/);
            if (constParts.length < 3) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: Range.create(i, 0, i, line.length),
                    message: `Incomplete constant definition`,
                    source: 'fxscript'
                });
            } else {
                const exprPart = line.substring(line.indexOf(constParts[2]));
                validateExpression(exprPart, i, line.indexOf(constParts[2]), diagnostics, currentMacro, currentLabel);
            }
            return;
        }

        if (trimmedLine.startsWith('#')) return;

        if (line.match(/^\s*@include\b/)) return;
        if (line.match(/^\s*@const\b/)) return;
        if (line.match(/^\s*var\s+/)) return;

        const commandMatch = line.match(/^\s*([a-zA-Z0-9_.$]+)(?!\S)/);
        if (commandMatch) {
            const cmdName = commandMatch[1];
            if (['ret', 'endmacro', 'macro', 'var', 'const'].includes(cmdName)) return;
            if (cmdName.startsWith('@')) return;

            const isBuiltIn = builtInCommands.includes(cmdName);
            const isCustom = customCommands.some(c => c.name === cmdName);
            const isMacro = workspaceSymbols.macros.has(cmdName);
            
            if (!isBuiltIn && !isCustom && !isMacro) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: Range.create(i, line.indexOf(cmdName), i, line.indexOf(cmdName) + cmdName.length),
                    message: `Unknown command or macro: ${cmdName}`,
                    source: 'fxscript'
                });
            } else {
                const argsPart = line.substring(line.indexOf(cmdName) + cmdName.length).trim();
                if (argsPart) {
                    const args = argsPart.split(',').map(arg => arg.trim());
                    let currentPos = line.indexOf(cmdName) + cmdName.length;
                    args.forEach(arg => {
                        const argStart = line.indexOf(arg, currentPos);
                        validateExpression(arg, i, argStart, diagnostics, currentMacro, currentLabel);
                        currentPos = argStart + arg.length;
                    });
                    
                    if (argsPart.endsWith(',')) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Error,
                            range: Range.create(i, line.lastIndexOf(','), i, line.lastIndexOf(',') + 1),
                            message: `Trailing comma or incomplete expression`,
                            source: 'fxscript'
                        });
                    }
                }
            }
        } else if (trimmedLine !== '' && !trimmedLine.startsWith('#')) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: Range.create(i, 0, i, line.length),
                message: `Invalid line format`,
                source: 'fxscript'
            });
        }
    });

    connection.sendDiagnostics({ uri, diagnostics });
}

function validateExpression(expr: string, line: number, startChar: number, diagnostics: Diagnostic[], currentMacro: string | null = null, currentLabel: string | null = null) {
    if (!expr || expr.trim() === '') return;
    
    // Clean expression from comments if any
    const commentIdx = expr.indexOf('#');
    const cleanExprFull = commentIdx >= 0 ? expr.substring(0, commentIdx) : expr;
    const cleanExpr = cleanExprFull.trim();
    if (cleanExpr === '') return;

    // Check for trailing operators
    if (/[+\-*/&|^<>!=]$/.test(cleanExpr) && !cleanExpr.endsWith('++') && !cleanExpr.endsWith('--')) {
        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: Range.create(line, startChar, line, startChar + expr.length),
            message: `Incomplete expression: trailing operator`,
            source: 'fxscript'
        });
    }
    
    // Check for double operators (e.g. 1 + + 2)
    // Multi-character operators: <<, >>, ==, !=, <=, >=, ++, --, **
    
    // We check for double operators by looking for operator characters that aren't part of a valid multi-char operator
    // A simpler way: replace multi-char operators with a placeholder, then check for remaining adjacent operators
    let checkOpStr = cleanExpr;
    const multiOpPlaceholder = ' @ '; // use something that won't be confused with operators
    ['<<', '>>', '==', '!=', '<=', '>=', '++', '--', '**'].forEach(op => {
        checkOpStr = checkOpStr.split(op).join(multiOpPlaceholder);
    });
    
    if (/([+\-*/&|^<>!=])\s*([+\-*/&|^<>!=])/.test(checkOpStr)) {
        const match = checkOpStr.match(/([+\-*/&|^<>!=])\s*([+\-*/&|^<>!=])/);
        if (match && !['!', '~'].includes(match[2])) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: Range.create(line, startChar, line, startChar + expr.length),
                message: `Incomplete expression: double operator`,
                source: 'fxscript'
            });
        }
    }

    // Unknown identifier validation
    // Skip checking inside strings
    let idExpr = cleanExpr;
    idExpr = idExpr.replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, (match) => ' '.repeat(match.length));

    // FXScript symbols can contain a-z, A-Z, 0-9, _, %, $, .
    const idRegex = /[%_a-zA-Z0-9.$:]+/g;
    let idMatch;
    while ((idMatch = idRegex.exec(idExpr)) !== null) {
        let id = idMatch[0];
        
        // Skip purely numeric literals
        if (/^[0-9]+$|^0x[0-9a-fA-F]+$|^0b[01]+$/.test(id)) continue;
        
        // Skip macro arguments (starting with $)
        if (id.startsWith('$')) continue;
        
            // If it contains a colon and doesn't start with %, it's likely an @const value like move:dig.
            // We should treat it as a potential known constant.
            
            // Skip keywords
            if (['var', 'const', 'macro', 'endmacro', 'ret'].includes(id)) continue;
            // Skip built-in commands
            if (builtInCommands.includes(id)) continue;
            
            // If it starts with %, it's a local label. Resolve it.
            if (id.startsWith('%')) {
                const prefix = currentMacro || currentLabel;
                if (prefix) {
                    id = prefix + id;
                }
            }
            
            // Check if it's a known symbol
            const isVariable = workspaceSymbols.variables.has(id);
            const isConstant = workspaceSymbols.constants.has(id);
            const isMacro = workspaceSymbols.macros.has(id);
            const isLabel = workspaceSymbols.labels.has(id);
            const isCustomCmd = customCommands.some(c => c.name === id);
            const isCustomId = customIdentifiers.includes(id);

            if (!isVariable && !isConstant && !isMacro && !isLabel && !isCustomCmd && !isCustomId) {
                // If it contains a colon, it's likely an @const value. 
                // Since @const doesn't have a standardized name unless commented above,
                // we should allow it to avoid false positives if it's been indexed as 'move:dig'.
                if (id.includes(':')) continue;

                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: Range.create(line, startChar + idMatch.index, line, startChar + idMatch.index + idMatch[0].length),
                    message: `Unknown identifier: ${idMatch[0]}`,
                    source: 'fxscript'
                });
            }
    }

    // Check for unmatched parentheses
    let openParens = 0;
    for (let i = 0; i < cleanExprFull.length; i++) {
        if (cleanExprFull[i] === '(') openParens++;
        if (cleanExprFull[i] === ')') openParens--;
        if (openParens < 0) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: Range.create(line, startChar + i, line, startChar + i + 1),
                message: `Unmatched closing parenthesis`,
                source: 'fxscript'
            });
            openParens = 0;
        }
    }
    if (openParens > 0) {
        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: Range.create(line, startChar, line, startChar + expr.length),
            message: `Unmatched opening parenthesis`,
            source: 'fxscript'
        });
    }

    const invalidCharMatch = cleanExprFull.match(/[^%_a-zA-Z0-9.$\s+\-*/&|^<>!=()~,"\\/:#@]/);
    if (invalidCharMatch) {
        const charIdx = invalidCharMatch.index!;
        // Allow characters if they are part of a string or comment
        const before = cleanExprFull.substring(0, charIdx);
        const quoteCount = (before.match(/"/g) || []).length;
        const commentIdx = cleanExprFull.indexOf('#');
        if (quoteCount % 2 === 0 && (commentIdx === -1 || charIdx < commentIdx)) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: Range.create(line, startChar + charIdx, line, startChar + charIdx + 1),
                message: `Invalid character in expression: ${cleanExprFull[charIdx]}`,
                source: 'fxscript'
            });
        }
    }
}

function addSymbol(map: Map<string, SymbolInfo[]>, name: string, kind: CompletionItemKind, uri: string, line: number, character: number) {
    if (!map.has(name)) {
        map.set(name, []);
    }
    const infos = map.get(name)!;
    // Prevent duplicate symbols at the same location
    if (infos.some(info => info.location.uri === uri && info.location.range.start.line === line && info.location.range.start.character === character)) {
        return;
    }
    infos.push({
        name,
        kind,
        location: {
            uri,
            range: Range.create(line, character, line, character + name.length)
        }
    });
}

const validationDelays: Map<string, NodeJS.Timeout> = new Map();

documents.onDidChangeContent(change => {
    const uri = change.document.uri;
    if (validationDelays.has(uri)) {
        clearTimeout(validationDelays.get(uri)!);
    }
    validationDelays.set(uri, setTimeout(() => {
        indexFile(uri, change.document.getText());
        // Re-validate all open documents because a new symbol might resolve something elsewhere
        documents.all().forEach(doc => validateFile(doc.uri));
        validationDelays.delete(uri);
    }, 500));
});

documents.onDidOpen(e => {
    indexFile(e.document.uri, e.document.getText());
    validateFile(e.document.uri);
});

documents.onDidSave(_e => {
    // indexFile(e.document.uri, e.document.getText());
});

connection.onDidChangeWatchedFiles(_change => {
    indexWorkspace();
    // Re-validate all open documents after re-indexing
    documents.all().forEach(doc => validateFile(doc.uri));
});

connection.onHover((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const line = document.getText(Range.create(params.position.line, 0, params.position.line, 1000));
    const wordMatch = getWordAt(line, params.position.character);
    if (!wordMatch) return null;

    const word = wordMatch.word;

    // Check if it's a built-in command
    if (builtInCommands.includes(word)) {
        // Find command info
        // set <target:identifier>, <value:identifier>
        // goto <target:label>
        // call <target:label>
        // ret
        // jumpIf <condition:identifier>, <target:label>
        const help: { [key: string]: string } = {
            'set': 'set <target:identifier>, <value:identifier>',
            'goto': 'goto <target:label>',
            'call': 'call <target:label>',
            'ret': 'ret',
            'jumpIf': 'jumpIf <condition:identifier>, <target:label>',
            'nop': 'nop',
            'push': 'push <value:identifier>',
            'pop': 'pop <target:identifier>'
        };
        if (help[word]) {
            return {
                contents: {
                    kind: 'markdown',
                    value: `\`\`\`fxscript\n${help[word]}\n\`\`\``
                }
            };
        }
    }

    // Check if it's a custom command
    const customCmd = customCommands.find(c => c.name === word);
    if (customCmd) {
        const args = customCmd.arguments ? customCmd.arguments.map((a: any) => `${a.name}:${a.type}`).join(', ') : '';
        return {
            contents: {
                kind: 'markdown',
                value: `\`\`\`fxscript\n${word} ${args}\n\`\`\``
            }
        };
    }

    // Check if it's a macro call
    if (workspaceSymbols.macros.has(word)) {
        // Try to find the macro definition to get arguments
        const infos = workspaceSymbols.macros.get(word)!;
        const info = infos[0];
        const macroDoc = workspaceSymbols.files.get(info.location.uri);
        if (macroDoc) {
            const lines = macroDoc.split(/\r?\n/);
            const defLine = lines[info.location.range.start.line];
            const argsMatch = defLine.match(/\bmacro\s+[a-zA-Z_][a-zA-Z0-9_]*\s*(.*)/);
            const args = argsMatch ? argsMatch[1].trim() : '';
            return {
                contents: {
                    kind: 'markdown',
                    value: `\`\`\`fxscript\n${word} ${args}\n\`\`\``
                }
            };
        }
    }

    return null;
});

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

    // Search in labels, variables, constants, macros across workspace
    const sources = [
        { map: workspaceSymbols.variables, allowDefinition: true },
        { map: workspaceSymbols.constants, allowDefinition: false }, // Special handling for constants
        { map: workspaceSymbols.macros, allowDefinition: true },
        { map: workspaceSymbols.labels, allowDefinition: true }
    ];

    let results: Location[] = [];

    // 1. Try exact match (for global symbols)
    for (const source of sources) {
        if (source.map.has(word)) {
            const infos = source.map.get(word)!;
            
            // For constants, we need to check if they were defined via @const
            if (source.map === workspaceSymbols.constants) {
                const filteredInfos = infos.filter(info => {
                    const fileContent = workspaceSymbols.files.get(info.location.uri);
                    if (!fileContent) return true;
                    const lines = fileContent.split(/\r?\n/);
                    const line = lines[info.location.range.start.line];
                    // If it's defined via @const, we skip it for navigation (per requirement)
                    return !line.includes('@const');
                });
                if (filteredInfos.length > 0) {
                    results = filteredInfos.map(info => info.location);
                    break;
                }
            } else {
                results = infos.map(info => info.location);
                break;
            }
        }
    }

    // If it's a local label, try to resolve it with context.
    if (results.length === 0 && word.startsWith('%')) {
        const text = document.getText();
        const lines = text.split(/\r?\n/);
        let currentMacro: string | null = null;
        let currentLabel: string | null = null;

        for (let i = 0; i <= params.position.line; i++) {
            const lineText = lines[i];
            const macroMatch = lineText.match(/^\s*macro\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
            if (macroMatch) {
                currentMacro = macroMatch[1];
                currentLabel = null;
                continue;
            }
            const endMacroMatch = lineText.match(/^\s*endmacro\b/);
            if (endMacroMatch) {
                currentMacro = null;
                currentLabel = null;
                continue;
            }
            const labelMatch = lineText.match(/^\s*([%_a-zA-Z0-9\.$\-]+):(?!\S)/);
            if (labelMatch) {
                const labelName = labelMatch[1];
                if (!labelName.startsWith('%')) {
                    currentLabel = labelName;
                }
            }
        }

        const prefix = currentMacro || currentLabel;
        if (prefix) {
            const fullLabel = prefix + word;
            if (workspaceSymbols.labels.has(fullLabel)) {
                results = workspaceSymbols.labels.get(fullLabel)!.map(info => info.location);
            }
        }
    }

    // 3. If still not found, it might be a usage of a local label where the cursor is AT the definition
    // (e.g. clicking on AccuracyCheck%_miss definition).
    // Wait, if we click on AccuracyCheck%_miss (the full name), it should have been found in step 1.
    // If we click on %_miss in "AccuracyCheck%_miss:", the word is %_miss.
    // The current logic for indexing local labels:
    // addSymbol(workspaceSymbols.labels, labelName, ..., line.indexOf(labelMatch[1]));
    // where labelMatch[1] is %_miss. So it indexes it as AccuracyCheck%_miss at the position of %_miss.
    // This means step 1 (exact match) will FAIL because 'word' is '%_miss' but it's indexed as 'AccuracyCheck%_miss'.
    // Step 2 should catch it though, because it will prepend the prefix.

    if (results.length > 0) {
        return results;
    }

    // Handle @include
    const includeRegex = /@include\s+([a-zA-Z0-9\._-]+)/g;
    let includeMatch;
    const text = document.getText();
    const cursorOffset = document.offsetAt(params.position);
    
    while ((includeMatch = includeRegex.exec(text)) !== null) {
        const fileName = includeMatch[1];
        const fullMatch = includeMatch[0];
        const matchStart = includeMatch.index;
        const matchEnd = includeMatch.index + fullMatch.length;

        if (cursorOffset >= matchStart && cursorOffset < matchEnd) {
            const fileNameStart = matchStart + fullMatch.indexOf(fileName);
            const fileNameEnd = fileNameStart + fileName.length;

            if (cursorOffset >= fileNameStart && cursorOffset < fileNameEnd) {
                // Try to find the file
                const currentDir = path.dirname(URI.parse(params.textDocument.uri).fsPath);
                const targetPath = path.join(currentDir, fileName);
                if (fs.existsSync(targetPath)) {
                    return [{
                        uri: URI.file(targetPath).toString(),
                        range: Range.create(0, 0, 0, 0)
                    }];
                }
            }
        }
    }

    return null;
});

function getWordAt(line: string, character: number) {
    // We want to capture as much of the word as possible around the character.
    // FXScript symbols can contain a-z, A-Z, 0-9, _, %, $, ., :, -
    const wordRegex = /[%_a-zA-Z0-9\.$\-:]+/g;
    let match;
    while ((match = wordRegex.exec(line)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;
        if (character >= start && character < end) {
            return {
                word: match[0],
                start: start
            };
        }
    }
    return null;
}

connection.onReferences((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const line = document.getText(Range.create(params.position.line, 0, params.position.line, 1000));
    const wordMatch = getWordAt(line, params.position.character);
    if (!wordMatch) return null;

    const word = wordMatch.word;
    const references: Location[] = [];
    let wordToSearch = word;

    // If it's a local label, try to resolve it with context
    if (word.startsWith('%')) {
        const text = document.getText();
        const lines = text.split(/\r?\n/);
        let currentMacro: string | null = null;
        let currentLabel: string | null = null;

        for (let i = 0; i <= params.position.line; i++) {
            const lineText = lines[i];
            const macroMatch = lineText.match(/^\s*macro\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
            if (macroMatch) {
                currentMacro = macroMatch[1];
                currentLabel = null;
                continue;
            }
            const endMacroMatch = lineText.match(/^\s*endmacro\b/);
            if (endMacroMatch) {
                currentMacro = null;
                currentLabel = null;
                continue;
            }
            const labelMatch = lineText.match(/^\s*([%_a-zA-Z0-9.$]+):(?!\S)/);
            if (labelMatch) {
                const labelName = labelMatch[1];
                if (!labelName.startsWith('%')) {
                    currentLabel = labelName;
                }
            }
        }

        const prefix = currentMacro || currentLabel;
        if (prefix) {
            wordToSearch = prefix + word;
        }
    }

    // Special case: if we are at a definition of a label, word might ALREADY be the prefixed version
    // but the user might have clicked on it.
    // Wait, the user clicks on "%_miss" in "AccuracyCheck%_miss:". getWordAt returns "%_miss".
    // The loop above will find "AccuracyCheck" as currentMacro and wordToSearch will become "AccuracyCheck%_miss".
    // This seems correct.

        // If wordToSearch is NOT found in any symbol map, it might be that we are searching for
        // a global symbol that is not indexed (e.g. a macro call). But macros ARE indexed.

        // Ensure we also find the definition itself in references
        // The current loop below searches ALL files for 'wordToSearch' as a whole word or a prefixed local label.

        // Search all files in workspace for the word
        for (const [uri, content] of workspaceSymbols.files.entries()) {
            const lines = content.split(/\r?\n/);
            let currentFileMacro: string | null = null;
            let currentFileLabel: string | null = null;

            lines.forEach((lineText, lineIndex) => {
                const macroMatch = lineText.match(/^\s*macro\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
                if (macroMatch) {
                    currentFileMacro = macroMatch[1];
                    currentFileLabel = null;
                    return;
                }
                const endMacroMatch = lineText.match(/^\s*endmacro\b/);
                if (endMacroMatch) {
                    currentFileMacro = null;
                    currentFileLabel = null;
                    return;
                }
                const labelMatch = lineText.match(/^\s*([%_a-zA-Z0-9\.$\-]+):(?!\S)/);
                if (labelMatch) {
                    const labelName = labelMatch[1];
                    if (!labelName.startsWith('%')) {
                        currentFileLabel = labelName;
                    }
                }

                // Find all potential words in the line
                const wordRegex = /[%_a-zA-Z0-9\.$\-:]+/g;
                let m;
                while ((m = wordRegex.exec(lineText)) !== null) {
                    let foundWord = m[0];
                    let actualWord = foundWord;

                    if (foundWord.startsWith('%')) {
                        const prefix = currentFileMacro || currentFileLabel;
                        if (prefix) {
                            actualWord = prefix + foundWord;
                        }
                    }

                    if (actualWord === wordToSearch) {
                        references.push({
                            uri: uri,
                            range: Range.create(lineIndex, m.index, lineIndex, m.index + foundWord.length)
                        });
                    }
                }
            });
        }

    return references;
});

connection.onRequest(InlayHintRequest.type, (params: InlayHintParams) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const hints: InlayHint[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    lines.forEach((line, i) => {
        const atConstMatch = line.match(/@const\s+([^\s#]+)/);
        if (atConstMatch) {
            const externalName = atConstMatch[1];
            const startChar = line.indexOf(externalName);
            
            // Check line ABOVE for name
            if (i > 0) {
                const lineAbove = lines[i - 1].trim();
                if (lineAbove.startsWith('#')) {
                    const commentContent = lineAbove.substring(1).trim();
                    const commentParts = commentContent.split(/\s+/);
                    if (commentParts.length > 0) {
                        const renderedName = commentParts[0];
                        if (renderedName.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
                            hints.push({
                                position: { line: i, character: startChar + externalName.length },
                                label: ` as ${renderedName}`,
                                kind: InlayHintKind.Type,
                                paddingLeft: true
                            });
                        }
                    }
                }
            }
        }
    });

    return hints;
});

documents.listen(connection);
connection.listen();

// Removed redundant initial indexing at the end
