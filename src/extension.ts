
async function collectWorkspaceSymbols(): Promise<ReturnType<typeof extractSymbolsFromText>> {
  const macros = new Set<string>();
  const consts = new Map<string, ConstType>();
  const labels = new Set<string>();
  const uris = await vscode.workspace.findFiles('**/*.ms');
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

function makeItems(names: string[], kind: vscode.CompletionItemKind, detail?: string): vscode.CompletionItem[] {
  return names.map(n => {
    const item = new vscode.CompletionItem(n, kind);
    if (detail) item.detail = detail;
    return item;
  });
}

function createCompletionProvider(context: vscode.ExtensionContext) {
  const ms = readMovescript(context);
  const commands = ms.commands;
  const flagsFromConfig = ms.flags;
  const identifiersFromConfig = ms.identifiers;
  const variablesFromConfig = ms.variables || [];

  let cache: { macros: string[]; consts: { name: string; type: ConstType }[]; labels: string[] } = { macros: [], consts: [], labels: [] };

  const refresh = async () => {
    cache = await collectWorkspaceSymbols();
  };

  // Initial cache fill
  refresh();

  // Update cache on saves
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.languageId === 'movescript') refresh();
    })
  );

  const provider: vscode.CompletionItemProvider = {
    async provideCompletionItems(document, position, token, ctx) {
      // Basic context: text from line start to cursor
      const line = document.lineAt(position.line).text.substring(0, position.character);
      const trimmed = line.trimStart();
      const atLineStart = trimmed.length === line.length; // no leading spaces means we are at col 0
      const isIndented = !atLineStart; // at least one leading space

      // Ensure symbol cache is warm on first use (avoid race with initial async refresh)
      if (cache.macros.length === 0 && cache.consts.length === 0 && cache.labels.length === 0) {
        try { await refresh(); } catch {}
      }

      // Determine first token of the line
      const firstTokenMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
      const firstToken = firstTokenMatch?.[1];
      const afterFirstToken = firstToken ? trimmed.substring(firstToken.length).trimLeft() : '';

      const items: vscode.CompletionItem[] = [];

      // New rule: Only suggest when indented (at least 1 leading space)
      if (!isIndented) {
        return new vscode.CompletionList([], false);
      }

      // Determine if we are completing arguments for a known command on this line
      if (firstToken) {
        const cmdSpec = commands.find(c => c.name === firstToken);
        if (cmdSpec) {
          const after = trimmed.slice(firstToken.length);
          const endsWithSpace = /\s$/.test(after);
          const tokens = after.trim().length ? after.trim().split(/\s+/) : [];
          const argIndex = endsWithSpace ? tokens.length : Math.max(0, tokens.length - 1);
          const hasArgsProp = Object.prototype.hasOwnProperty.call(cmdSpec, 'args');
          const arg = cmdSpec.args && cmdSpec.args[argIndex];
          const expectedType = arg?.type;

          // If args are explicitly empty (args: []), do not suggest arguments at all
          if (hasArgsProp && Array.isArray(cmdSpec.args) && cmdSpec.args.length === 0) {
            return new vscode.CompletionList([], false);
          }

          if (expectedType) {
            // Provide type-based suggestions only
            if (expectedType === 'label') {
              if (cache.labels.length === 0) { try { await refresh(); } catch {} }
              for (const l of cache.labels) {
                const it = new vscode.CompletionItem(l, vscode.CompletionItemKind.Reference);
                it.detail = 'label';
                it.insertText = l;
                items.push(it);
              }
            } else if (expectedType === 'flag') {
              for (const f of flagsFromConfig) {
                const it = new vscode.CompletionItem(f, vscode.CompletionItemKind.EnumMember);
                it.detail = 'flag';
                it.insertText = f;
                items.push(it);
              }
            } else if (expectedType === 'identifier') {
              // Suggest identifiers only
              for (const id of identifiersFromConfig) {
                const it = new vscode.CompletionItem(id, vscode.CompletionItemKind.Variable);
                it.detail = 'identifier';
                it.insertText = id;
                items.push(it);
              }
            } else if (expectedType === 'variable') {
              for (const v of variablesFromConfig) {
                const it = new vscode.CompletionItem(v, vscode.CompletionItemKind.Variable);
                it.detail = 'variable';
                it.insertText = v;
                items.push(it);
              }
            } else if (expectedType === 'string') {
              // string-typed constants
              for (const c of cache.consts.filter(c => c.type === 'string')) {
                const it = new vscode.CompletionItem(c.name, vscode.CompletionItemKind.Constant);
                it.detail = 'const (string)';
                it.insertText = c.name;
                items.push(it);
              }
            } else if (expectedType === 'number') {
              for (const c of cache.consts.filter(c => c.type === 'number')) {
                const it = new vscode.CompletionItem(c.name, vscode.CompletionItemKind.Constant);
                it.detail = 'const (number)';
                it.insertText = c.name;
                items.push(it);
              }
            }

            return new vscode.CompletionList(items, true);
          }

          // If args property is omitted (undefined), suggest ALL known things in argument position
          if (!hasArgsProp) {
            // Ensure cache is up-to-date and also include labels from the current (possibly unsaved) document
            if (cache.labels.length === 0 || cache.consts.length === 0) { try { await refresh(); } catch {} }
            let labelsAll = new Set<string>(cache.labels);
            try {
              const local = extractSymbolsFromText(document.getText());
              for (const l of local.labels) labelsAll.add(l);
            } catch {}
            // labels
            for (const l of labelsAll) {
              const it = new vscode.CompletionItem(l, vscode.CompletionItemKind.Reference);
              it.detail = 'label';
              it.insertText = l;
              items.push(it);
            }
            // flags
            for (const f of flagsFromConfig) {
              const it = new vscode.CompletionItem(f, vscode.CompletionItemKind.EnumMember);
              it.detail = 'flag';
              it.insertText = f;
              items.push(it);
            }
            // identifiers and variables
            for (const id of identifiersFromConfig) {
              const it = new vscode.CompletionItem(id, vscode.CompletionItemKind.Variable);
              it.detail = 'identifier';
              it.insertText = id;
              items.push(it);
            }
            for (const v of variablesFromConfig) {
              const it = new vscode.CompletionItem(v, vscode.CompletionItemKind.Variable);
              it.detail = 'identifier';
              it.insertText = v;
              items.push(it);
            }
            // string consts
            for (const c of cache.consts.filter(c => c.type === 'string')) {
              const it = new vscode.CompletionItem(c.name, vscode.CompletionItemKind.Constant);
              it.detail = 'const (string)';
              it.insertText = c.name;
              items.push(it);
            }
            // number consts
            for (const c of cache.consts.filter(c => c.type === 'number')) {
              const it = new vscode.CompletionItem(c.name, vscode.CompletionItemKind.Constant);
              it.detail = 'const (number)';
              it.insertText = c.name;
              items.push(it);
            }

            return new vscode.CompletionList(items, true);
          }
        }
      }

      // Fallback: macros, keyword, commands
      for (const m of cache.macros) {
        const it = new vscode.CompletionItem(m, vscode.CompletionItemKind.Snippet);
        it.detail = 'macro';
        it.insertText = m + ' ';
        items.push(it);
      }

      const macroKw = new vscode.CompletionItem('macro', vscode.CompletionItemKind.Keyword);
      macroKw.detail = 'define a macro';
      macroKw.insertText = 'macro ';
      items.push(macroKw);

      for (const cmd of commands) {
        const it = new vscode.CompletionItem(cmd.name, vscode.CompletionItemKind.Function);
        const signature = cmd.name + (cmd.args && cmd.args.length ? ' ' + cmd.args.map(a => `<${a.name}>`).join(' ') : '');
        const md = new vscode.MarkdownString();
        md.appendText(signature);
        if (cmd.detail) md.appendText('\n\n' + cmd.detail);
        it.documentation = md;
        it.insertText = cmd.name + ' ';
        items.push(it);
      }

      return new vscode.CompletionList(items, true);
    }
  };

  return provider;
}

export function activate(context: vscode.ExtensionContext) {
  const provider = createCompletionProvider(context);
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider({ language: 'movescript', scheme: 'file' }, provider, ' ', '\"')
  );

  // Hover: show signature and optional detail for known commands from commands.json
  const hoverMs = readMovescript(context);
  const hoverCommands = hoverMs.commands;
  context.subscriptions.push(
    vscode.languages.registerHoverProvider('movescript', {
      provideHover(document, position) {
        const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
        if (!wordRange) return;
        const word = document.getText(wordRange);
        const spec = hoverCommands.find(c => c.name === word);
        if (!spec) return;
        const signature = spec.name + (spec.args && spec.args.length ? ' ' + spec.args.map(a => `<${a.name}>`).join(' ') : '');
        const md = new vscode.MarkdownString();
        md.appendCodeblock(signature);
        if (spec.detail) {
          md.appendMarkdown('\n');
          md.appendMarkdown(spec.detail);
        }
        return new vscode.Hover(md, wordRange);
      }
    })
  );

  // Signature Help: show current command signature and highlight current arg index
  const sigMs = readMovescript(context);
  const sigCommands = sigMs.commands;
  context.subscriptions.push(
    vscode.languages.registerSignatureHelpProvider(
      { language: 'movescript', scheme: 'file' },
      {
        provideSignatureHelp(document, position): vscode.ProviderResult<vscode.SignatureHelp> {
          // Get text of the current line up to the cursor
          const lineText = document.lineAt(position.line).text;
          // Mask strings and strip comments to avoid confusing argument parsing
          const masked = (() => {
            let inString = false;
            let out = '';
            for (let i = 0; i < lineText.length; i++) {
              const ch = lineText[i];
              const prev = i > 0 ? lineText[i - 1] : '';
              if (!inString && ch === '#') {
                out += ' '.repeat(lineText.length - i);
                break;
              }
              if (ch === '"' && prev !== '\\') {
                inString = !inString;
                out += ' ';
                continue;
              }
              out += inString ? ' ' : ch;
            }
            return out;
          })();

          // Work only on the part before the cursor
          const maskedBefore = masked.substring(0, position.character);
          const trimmed = maskedBefore.trimStart();
          if (!trimmed) return null;

          // First token is the command
          const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
          const cmdName = m?.[1];
          if (!cmdName) return null;

          const spec = sigCommands.find(c => c.name === cmdName);
          if (!spec) return null;

          // Compute current argument index
          const after = trimmed.slice(cmdName.length);
          const endsWithSpace = /\s$/.test(after);
          const tokens = after.trim().length ? after.trim().split(/\s+/) : [];
          const argIndex = endsWithSpace ? tokens.length : Math.max(0, tokens.length - 1);

          const help = new vscode.SignatureHelp();
          help.activeSignature = 0;
          help.activeParameter = Math.max(0, argIndex);

          // Build signature label and parameters
          const params = Array.isArray(spec.args) ? spec.args : [];
          const label = spec.name + (params.length ? ' ' + params.map(a => `<${a.name}>`).join(' ') : '');
          const si = new vscode.SignatureInformation(label);
          if (spec.detail) {
            si.documentation = new vscode.MarkdownString(spec.detail);
          }
          si.parameters = params.map(p => new vscode.ParameterInformation(`<${p.name}>`));
          help.signatures = [si];
          return help;
        }
      },
      ' ', '"' // trigger characters
    )
  );

  // Semantic tokens: colorize arguments (numbers, flags, identifiers, labels) differently
  const msForSem = readMovescript(context);
  const flagsSet = new Set(msForSem.flags || []);
  const identifiersSet = new Set(msForSem.identifiers || []);
  const variablesSet = new Set(msForSem.variables || []);

  // Workspace labels cache for semantic tokens
  let labelCache = new Set<string>();
  async function refreshLabels() {
    try {
      const ws = await collectWorkspaceSymbols();
      labelCache = new Set(ws.labels);
    } catch {
      labelCache = new Set();
    }
  }
  // Initial fill and refresh on saves
  refreshLabels();
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.languageId === 'movescript') refreshLabels();
    })
  );

  // Define legend using built-in token types for good theme support
  const legend = new vscode.SemanticTokensLegend(
    ['number', 'enumMember', 'variable', 'type'], // indices: 0 number, 1 flag, 2 identifier, 3 label
    []
  );

  function maskStringsAndStripComment(line: string): { masked: string } {
    let inString = false;
    let result = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const prev = i > 0 ? line[i - 1] : '';
      if (!inString && ch === '#') {
        // strip comment tail
        result += ' '.repeat(line.length - i);
        return { masked: result };
      }
      if (ch === '"' && prev !== '\\') {
        inString = !inString;
        result += ' ';
        continue;
      }
      if (inString) {
        // preserve length with spaces
        result += ' ';
      } else {
        result += ch;
      }
    }
    return { masked: result };
  }

  function findFirstToken(masked: string): { name: string; start: number; end: number } | null {
    // skip leading spaces
    let i = 0;
    while (i < masked.length && masked[i] === ' ') i++;
    const m = masked.slice(i).match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    if (!m) return null;
    const name = m[1];
    const start = i;
    const end = i + name.length;
    return { name, start, end };
  }

  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: 'movescript', scheme: 'file' },
      {
        async provideDocumentSemanticTokens(document) {
          const builder = new vscode.SemanticTokensBuilder(legend);

          for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
            const full = document.lineAt(lineNum).text;
            const { masked } = maskStringsAndStripComment(full);
            if (!masked.trim()) continue;

            // Ignore pure label definition lines
            if (LABEL_DEF_RE.test(masked)) continue;

            const first = findFirstToken(masked);
            if (!first) continue;

            // Only consider tokens after the first token (arguments region)
            const argsStart = first.end;
            let idx = argsStart;
            while (idx < masked.length) {
              // skip whitespace
              while (idx < masked.length && /\s/.test(masked[idx])) idx++;
              if (idx >= masked.length) break;

              // number literal
              const numMatch = masked.slice(idx).match(/^[+-]?\d+(?:\.\d+)?\b/);
              if (numMatch) {
                const text = numMatch[0];
                builder.push(lineNum, idx, text.length, 0, 0);
                idx += text.length;
                continue;
              }

              // identifier-like token
              const idMatch = masked.slice(idx).match(/^[A-Za-z_][A-Za-z0-9_]*/);
              if (idMatch) {
                const text = idMatch[0];
                // classify: flag, identifier, label
                if (flagsSet.has(text)) {
                  builder.push(lineNum, idx, text.length, 1, 0);
                } else if (identifiersSet.has(text) || variablesSet.has(text)) {
                  builder.push(lineNum, idx, text.length, 2, 0);
                } else if (labelCache.has(text)) {
                  builder.push(lineNum, idx, text.length, 3, 0);
                }
                idx += text.length;
                continue;
              }

              // otherwise advance one char to avoid infinite loop
              idx++;
            }
          }

          return builder.build();
        }
      },
      legend
    )
  );

  // Navigation: Go to Definition and Find References for labels and consts
  interface LabelDef {
    name: string;
    uri: vscode.Uri;
    range: vscode.Range; // full label token range (name only)
  }

  interface ConstDef {
    name: string;
    uri: vscode.Uri;
    range: vscode.Range; // const name token range
  }

  async function collectAllLabelDefinitions(): Promise<Map<string, LabelDef[]>> {
    const map = new Map<string, LabelDef[]>();
    const uris = await vscode.workspace.findFiles('**/*.ms');
    for (const uri of uris) {
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        for (let i = 0; i < doc.lineCount; i++) {
          const text = doc.lineAt(i).text;
          const trimmed = text.trimStart();
          if (trimmed.startsWith('#')) continue;
          const m = text.match(LABEL_DEF_RE);
          if (m) {
            const name = m[1];
            // Find the exact position of the name in the line
            const startIdx = text.indexOf(name);
            const start = new vscode.Position(i, startIdx);
            const end = new vscode.Position(i, startIdx + name.length);
            const entry: LabelDef = { name, uri, range: new vscode.Range(start, end) };
            const arr = map.get(name) || [];
            arr.push(entry);
            map.set(name, arr);
          }
        }
      } catch {
        // ignore file errors
      }
    }
    return map;
  }

  const CONST_DEF_RE = /^\s*const\s+([A-Za-z_][A-Za-z0-9_]*)\b/;

  async function collectAllConstDefinitions(): Promise<Map<string, ConstDef[]>> {
    const map = new Map<string, ConstDef[]>();
    const uris = await vscode.workspace.findFiles('**/*.ms');
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
            const entry: ConstDef = { name, uri, range: new vscode.Range(start, end) };
            const arr = map.get(name) || [];
            arr.push(entry);
            map.set(name, arr);
          }
        }
      } catch {
        // ignore file errors
      }
    }
    return map;
  }

  function isPositionOnLabelDefinition(document: vscode.TextDocument, position: vscode.Position): { name: string } | null {
    const lineText = document.lineAt(position.line).text;
    const m = lineText.match(LABEL_DEF_RE);
    if (!m) return null;
    const name = m[1];
    const startIdx = lineText.indexOf(name);
    if (position.character >= startIdx && position.character <= startIdx + name.length) {
      return { name };
    }
    return null;
  }

  function getWordAtPosition(document: vscode.TextDocument, position: vscode.Position): string | null {
    const range = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_-]*/);
    return range ? document.getText(range) : null;
  }

  // Definition provider: jump from a usage to the (last) definition for consts and labels
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider('movescript', {
      async provideDefinition(document, position) {
        const word = getWordAtPosition(document, position);
        if (!word) return;

        // Special case: when on `ret`, jump to callsites of the enclosing label
        if (word === 'ret') {
          // find enclosing label name by scanning upward
          const enclosing = (() => {
            for (let line = position.line; line >= 0; line--) {
              const text = document.lineAt(line).text;
              const m = LABEL_DEF_RE.exec(text);
              if (m) return m[1];
            }
            return null;
          })();

          if (enclosing) {
            const locations: vscode.Location[] = [];
            const uris = await vscode.workspace.findFiles('**/*.ms');
            const callRe = new RegExp(`^\\s*call\\s+${enclosing}(?![A-Za-z0-9_-])`);
            for (const uri of uris) {
              try {
                const doc = await vscode.workspace.openTextDocument(uri);
                for (let i = 0; i < doc.lineCount; i++) {
                  const full = doc.lineAt(i).text;
                  // strip trailing comments
                  const noComment = (() => {
                    const hash = full.indexOf('#');
                    return hash >= 0 ? full.slice(0, hash) : full;
                  })();
                  if (!callRe.test(noComment)) continue;
                  const idx = noComment.indexOf(enclosing);
                  const start = new vscode.Position(i, Math.max(0, idx));
                  const end = new vscode.Position(i, Math.max(0, idx) + enclosing.length);
                  locations.push(new vscode.Location(uri, new vscode.Range(start, end)));
                }
              } catch {
                // ignore file errors
              }
            }

            if (locations.length > 0) return locations;
          }
          // If no enclosing label or no callsites found, fall through to standard behavior
        }

        // Prefer const definitions if the name matches a const; else fall back to labels
        const constMap = await collectAllConstDefinitions();
        const constDefs = constMap.get(word);
        if (constDefs && constDefs.length > 0) {
          const last = constDefs[constDefs.length - 1];
          return new vscode.Location(last.uri, last.range);
        }

        const labelMap = await collectAllLabelDefinitions();
        const labelDefs = labelMap.get(word);
        if (labelDefs && labelDefs.length > 0) {
          const last = labelDefs[labelDefs.length - 1];
          return new vscode.Location(last.uri, last.range);
        }

        return;
      }
    })
  );

  // References provider: from a definition (label/const) or any matching word, list all usages across workspace
  context.subscriptions.push(
    vscode.languages.registerReferenceProvider('movescript', {
      async provideReferences(document, position, context) {
        const word = getWordAtPosition(document, position);
        if (!word) return [];

        const occurrences: vscode.Location[] = [];
        const uris = await vscode.workspace.findFiles('**/*.ms');
        const wordRe = new RegExp(`(?<![A-Za-z0-9_-])${word}(?![A-Za-z0-9_-])`, 'g');

        for (const uri of uris) {
          try {
            const doc = await vscode.workspace.openTextDocument(uri);
            for (let i = 0; i < doc.lineCount; i++) {
              const full = doc.lineAt(i).text;
              const noComment = (() => {
                const hash = full.indexOf('#');
                return hash >= 0 ? full.slice(0, hash) : full;
              })();

              // Skip pure definition lines (label or const) as usages unless includeDeclaration is true
              const isLabelDef = LABEL_DEF_RE.test(noComment);
              const isConstDef = CONST_DEF_RE.test(noComment);
              const isDefLine = isLabelDef || isConstDef;

              let match: RegExpExecArray | null;
              IDENT_RE.lastIndex = 0; // ensure clean state for shared regex
              wordRe.lastIndex = 0;
              while ((match = wordRe.exec(noComment)) !== null) {
                const range = new vscode.Range(new vscode.Position(i, match.index), new vscode.Position(i, match.index + word.length));
                if (isDefLine) {
                  // If user desires including definitions, respect context.includeDeclaration
                  if (context.includeDeclaration) {
                    occurrences.push(new vscode.Location(uri, range));
                  }
                } else {
                  occurrences.push(new vscode.Location(uri, range));
                }
              }
            }
          } catch {
            // ignore
          }
        }

        return occurrences;
      }
    })
  );
}

export function deactivate() {}

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Regex helpers and shared matchers
const IDENT_RE = /[A-Za-z_][A-Za-z0-9_-]*/g;
const LABEL_DEF_RE = /^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:/;

type ArgType = 'label' | 'string' | 'number' | 'flag' | 'identifier' | 'variable';

interface ArgSpec {
  name: string;
  type?: ArgType;
}

interface CommandSpec {
  name: string;
  args?: ArgSpec[]; // undefined means args property is omitted in config; [] means explicitly empty
  detail?: string;
}

interface MovescriptConfig {
  commands: CommandSpec[];
  flags: string[];
  identifiers: string[];
  variables: string[];
}

function readMovescript(context: vscode.ExtensionContext): MovescriptConfig {
  try {
    const file = context.asAbsolutePath(path.join('data', 'movescript.json'));
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    const cmds: any[] = Array.isArray(parsed?.commands) ? parsed.commands : [];
    const commands: CommandSpec[] = cmds
      .filter(c => c && typeof c.name === 'string')
      .map(c => {
        // Build result while preserving omission of the args key when it's not present in config
        const result: CommandSpec = { name: c.name };
        if (Object.prototype.hasOwnProperty.call(c, 'args')) {
          result.args = Array.isArray(c.args)
            ? c.args.map((a: any) => {
                if (a && typeof a === 'object') {
                  const name = typeof a.name === 'string' ? a.name : String(a.name ?? 'arg');
                  const type: ArgType | undefined = ['label', 'string', 'number', 'flag', 'identifier', 'variable'].includes(a.type) ? (a.type as ArgType) : undefined;
                  return { name, type } as ArgSpec;
                } else {
                  return { name: String(a) } as ArgSpec;
                }
              })
            : [];
        }
        if (typeof c.detail === 'string') {
          result.detail = c.detail;
        }
        return result;
      });
    const flags: string[] = Array.isArray(parsed?.flags) ? parsed.flags.filter((x: any) => typeof x === 'string') : [];
    const identifiers: string[] = Array.isArray(parsed?.identifiers) ? parsed.identifiers.filter((x: any) => typeof x === 'string') : [];
    const variables: string[] = Array.isArray(parsed?.variables) ? parsed.variables.filter((x: any) => typeof x === 'string') : [];
    return { commands, flags, identifiers, variables };
  } catch {
    return { commands: [], flags: [], identifiers: [], variables: [] };
  }
}

type ConstType = 'string' | 'number' | 'unknown';

function extractSymbolsFromText(text: string): { macros: string[]; consts: { name: string; type: ConstType }[]; labels: string[] } {
  const macros = new Set<string>();
  const consts = new Map<string, ConstType>();
  const labels = new Set<string>();

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const noComment = (() => {
      const i = line.indexOf('#');
      return i >= 0 ? line.slice(0, i) : line;
    })();
    const trimmed = noComment.trimStart();
    if (!trimmed) continue;

    const lm = LABEL_DEF_RE.exec(noComment);
    if (lm) {
      labels.add(lm[1]);
    }

    const mm = trimmed.match(/^macro\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (mm) {
      macros.add(mm[1]);
    }

    const cmm = trimmed.match(/^const\s+([A-Za-z_][A-Za-z0-9_]*)\s+(.+?)\s*$/);
    if (cmm) {
      const name = cmm[1];
      const value = cmm[2].trim();
      let type: ConstType = 'unknown';
      if (value.startsWith('"') && value.endsWith('"')) type = 'string';
      else if (/^[+-]?\d+(?:\.\d+)?$/.test(value)) type = 'number';
      consts.set(name, type);
    }
  }

  return {
    macros: [...macros],
    consts: [...consts.entries()].map(([name, type]) => ({ name, type })),
    labels: [...labels]
  };
}
