
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Regex helpers and shared matchers
const IDENT_RE = /[A-Za-z_][A-Za-z0-9_-]*/g;
const LABEL_DEF_RE = /^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:/;
const MACRO_DEF_RE = /^macro\s+([A-Za-z_][A-Za-z0-9_]*)/;
const CONST_DEF_RE = /^\s*const\s+([A-Za-z_][A-Za-z0-9_]*)\b/;

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
  const tagsFromConfig = (ms.string_tags && ms.string_tags.length > 0 ? ms.string_tags : (ms.tags || []));

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

      // If inside a string and currently within a {tag} expression, suggest tags
      const isInsideStringTagContext = (function suggestTagsInsideBraces() {
        const textToCursor = line;
        // Determine if inside a string by scanning quotes with escape support
        let inString = false;
        let escaped = false;
        for (let i = 0; i < textToCursor.length; i++) {
          const ch = textToCursor[i];
          if (ch === '"' && !escaped) inString = !inString;
          escaped = ch === '\\' && !escaped;
          if (ch !== '\\') escaped = false;
        }
        if (!inString) return false;
        // Find the position of the last opening quote
        let lastQuote = -1;
        for (let i = textToCursor.length - 1, esc = false; i >= 0; i--) {
          const ch = textToCursor[i];
          if (ch === '"' && !esc) { lastQuote = i; break; }
          esc = ch === '\\' && !esc;
          if (ch !== '\\') esc = false;
        }
        const afterQuote = lastQuote >= 0 ? textToCursor.slice(lastQuote + 1) : textToCursor;
        const openBraceIdx = afterQuote.lastIndexOf('{');
        if (openBraceIdx < 0) return false;
        const afterOpen = afterQuote.slice(openBraceIdx + 1);
        // If there's a closing brace before cursor, we're not inside an open tag
        if (afterOpen.includes('}')) return false;
        const partial = afterOpen; // partial tag name
        for (const t of tagsFromConfig) {
          if (typeof t !== 'string') continue;
          if (partial.length === 0 || t.startsWith(partial)) {
            const it = new vscode.CompletionItem(t, vscode.CompletionItemKind.EnumMember);
            it.detail = 'tag';
            // Replace partial inside braces
            const replaceStartCol = position.character - partial.length;
            it.range = new vscode.Range(new vscode.Position(position.line, replaceStartCol), position);
            items.push(it);
          }
        }
        return items.length > 0;
      })();
      // If inside a string tag context, only suggest string tags (and nothing else)
      if (isInsideStringTagContext) {
        return new vscode.CompletionList(items, false);
      }

      // Previously we only suggested on indented lines. This was too strict.
      // Now we allow completions at any indentation level. Certain keywords
      // (macro/const/@include) will still only be suggested at line start.

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

      // Fallback: macros, keywords, commands
      for (const m of cache.macros) {
        const it = new vscode.CompletionItem(m, vscode.CompletionItemKind.Snippet);
        it.detail = 'macro';
        it.insertText = m + ' ';
        items.push(it);
      }

      // Suggest macro/const/@include keywords only at line start (unindented)
      if (atLineStart) {
        // Compute current token (non-whitespace run at the end of the trimmed line)
        const tokenMatch = trimmed.match(/(\S+)$/);
        const currentToken = tokenMatch?.[1] ?? '';
        const leadingWs = line.length - trimmed.length;
        const tokenStartInTrimmed = (() => {
          if (!tokenMatch) return trimmed.length; // cursor at whitespace
          return trimmed.length - currentToken.length;
        })();
        const tokenStartCol = leadingWs + tokenStartInTrimmed;

        const macroKw = new vscode.CompletionItem('macro', vscode.CompletionItemKind.Keyword);
        macroKw.detail = 'define a macro';
        macroKw.insertText = 'macro ';
        items.push(macroKw);

        const constKw = new vscode.CompletionItem('const', vscode.CompletionItemKind.Keyword);
        constKw.detail = 'define a constant';
        constKw.insertText = 'const ';
        items.push(constKw);

        const includeKw = new vscode.CompletionItem('@include', vscode.CompletionItemKind.Keyword);
        includeKw.detail = 'include another file';
        includeKw.insertText = '@include ';
        // Keep only @include at the top when user starts typing '@inc…'
        includeKw.sortText = '\u0000';
        // Allow typing with or without '@' to keep the suggestion
        includeKw.filterText = currentToken.startsWith('@') ? currentToken : 'include';
        // Replace the currently typed token (e.g., '@in' or '@incl') with '@include '
        includeKw.range = new vscode.Range(new vscode.Position(position.line, tokenStartCol), position);
        includeKw.preselect = true;
        // Also trigger completion after typing '@'
        includeKw.commitCharacters = [' '];
        items.push(includeKw);

        // If typing an @-directive, keep the list focused on directives only
        if (currentToken.startsWith('@')) {
          return new vscode.CompletionList(items, true);
        }

        // Contextual suggestion for endmacro: offer only if a macro block is open
        // (i.e., there is a preceding 'macro' without a matching 'endmacro' up to current line)
        const textUpToHere = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
        const openMacros = (() => {
          let count = 0;
          const lines = textUpToHere.split(/\r?\n/);
          for (const ln of lines) {
            const code = (() => { const idx = ln.indexOf('#'); return idx >= 0 ? ln.slice(0, idx) : ln; })();
            if (/^\s*macro\b/.test(code)) count++;
            if (/^\s*endmacro\b/.test(code)) count = Math.max(0, count - 1);
          }
          return count;
        })();
        // Only suggest endmacro if a macro is currently open and the current
        // line is not already an endmacro line
        if (openMacros > 0 && !/^\s*endmacro\b/.test(trimmed)) {
          const endmacroKw = new vscode.CompletionItem('endmacro', vscode.CompletionItemKind.Keyword);
          endmacroKw.detail = 'end macro block';
          endmacroKw.insertText = 'endmacro';
          items.push(endmacroKw);
        }
      }

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
  const unimplementedProvider = new UnimplementedTreeDataProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('movescript-todo', unimplementedProvider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('movescript.openUnimplemented', (uri: vscode.Uri, range: vscode.Range) => {
      vscode.window.showTextDocument(uri, { selection: range });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('movescript.refreshUnimplemented', () => {
      unimplementedProvider.refresh();
    })
  );

  const provider = createCompletionProvider(context);
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider({ language: 'movescript', scheme: 'file' }, provider, ' ', '\"', '@', '{')
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      { language: 'movescript' },
      new MoveScriptDocumentSymbolProvider()
    )
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

  // Workspace symbols cache for diagnostics and navigation
  let workspaceLabels = new Map<string, LabelDef[]>();
  let workspaceMacros = new Map<string, MacroDef[]>();
  async function refreshSymbols() {
    try {
      workspaceLabels = await collectAllLabelDefinitions();
      workspaceMacros = await collectAllMacroDefinitions();
    } catch {
      workspaceLabels = new Map();
      workspaceMacros = new Map();
    }
    // Re-validate all open movescript documents when the workspace-wide symbols change
    for (const doc of vscode.workspace.textDocuments) {
      if (doc.languageId === 'movescript') {
        validateDocument(doc);
      }
    }
  }
  // Initial fill and refresh on saves
  refreshSymbols();

  let refreshTimer: NodeJS.Timeout | undefined;
  function debounceRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshSymbols();
    }, 500);
  }

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
                } else if (workspaceLabels.has(text)) {
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
    documentation?: string;
  }

  interface ConstDef {
    name: string;
    uri: vscode.Uri;
    range: vscode.Range; // const name token range
  }

  interface MacroDef {
    name: string;
    uri: vscode.Uri;
    range: vscode.Range; // macro name token range
    documentation?: string;
  }

  async function collectAllMacroDefinitions(): Promise<Map<string, MacroDef[]>> {
    const map = new Map<string, MacroDef[]>();
    const uris = await vscode.workspace.findFiles('**/*.ms');
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

            // Collect documentation: immediate comment lines above
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
              documentation: strictDocs.length > 0 ? strictDocs.join('\n') : undefined
            };
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

            // Collect documentation: immediate comment lines above
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
              documentation: docs.length > 0 ? docs.join('\n') : undefined
            };
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
        // First, handle @include navigation when the cursor is on the included path
        {
          const lineText = document.lineAt(position.line).text;
          // Find the @include keyword on this line (ignore lines that are comments entirely)
          const hashIdx = lineText.indexOf('#');
          const codePart = hashIdx >= 0 ? lineText.slice(0, hashIdx) : lineText;
          const includeIdx = codePart.indexOf('@include');
          if (includeIdx >= 0) {
            // Compute the start of the path token: after "@include" and at least one space
            const after = codePart.slice(includeIdx + '@include'.length);
            const wsMatch = after.match(/^[ \t]+/);
            if (wsMatch) {
              const pathStartIdx = includeIdx + '@include'.length + wsMatch[0].length;
              // The path token runs until whitespace or end of codePart
              let pathEndIdx = pathStartIdx;
              while (pathEndIdx < codePart.length) {
                const ch = codePart[pathEndIdx];
                if (ch === ' ' || ch === '\t') break;
                pathEndIdx++;
              }
              // If cursor is inside the path token, try resolving it
              if (position.character >= pathStartIdx && position.character <= pathEndIdx) {
                const rel = codePart.slice(pathStartIdx, pathEndIdx);
                try {
                  const baseDir = path.dirname(document.uri.fsPath);
                  const abs = path.resolve(baseDir, rel);
                  // Case-sensitive check: use fs.statSync and ensure path casing as given exists
                  if (fs.existsSync(abs)) {
                    const stat = fs.statSync(abs);
                    if (stat.isFile()) {
                      return new vscode.Location(vscode.Uri.file(abs), new vscode.Position(0, 0));
                    }
                  }
                } catch {
                  // ignore resolution errors
                }
              }
            }
          }
        }

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

        const labelDefs = workspaceLabels.get(word);
        if (labelDefs && labelDefs.length > 0) {
          // If we are currently on a definition, navigate to the first *other* definition
          const isOnDefIdx = labelDefs.findIndex(ld => ld.uri.toString() === document.uri.toString() && ld.range.contains(position));
          if (isOnDefIdx !== -1 && labelDefs.length > 1) {
            const otherIdx = (isOnDefIdx === 0) ? 1 : 0;
            const other = labelDefs[otherIdx];
            return new vscode.Location(other.uri, other.range);
          }
          // Default: jump to the last definition
          const last = labelDefs[labelDefs.length - 1];
          return new vscode.Location(last.uri, last.range);
        }

        const macroMap = await collectAllMacroDefinitions();
        const macroDefs = macroMap.get(word);
        if (macroDefs && macroDefs.length > 0) {
          const last = macroDefs[macroDefs.length - 1];
          return new vscode.Location(last.uri, last.range);
        }

        return;
      }
    })
  );

  // Document links for @include paths: make the whole path token clickable as one piece
  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider({ language: 'movescript', scheme: 'file' }, {
      provideDocumentLinks(document) {
        const links: vscode.DocumentLink[] = [];
        for (let i = 0; i < document.lineCount; i++) {
          try {
            const full = document.lineAt(i).text;
            // Strip trailing comments
            const hashIdx = full.indexOf('#');
            const codePart = hashIdx >= 0 ? full.slice(0, hashIdx) : full;
            const includeIdx = codePart.indexOf('@include');
            if (includeIdx < 0) continue;

            const after = codePart.slice(includeIdx + '@include'.length);
            const wsMatch = after.match(/^[ \t]+/);
            if (!wsMatch) continue;
            const pathStartCol = includeIdx + '@include'.length + wsMatch[0].length;

            // The path token runs until whitespace or end of codePart
            let pathEndCol = pathStartCol;
            while (pathEndCol < codePart.length) {
              const ch = codePart[pathEndCol];
              if (ch === ' ' || ch === '\t') break;
              pathEndCol++;
            }

            if (pathEndCol <= pathStartCol) continue;
            const rel = codePart.slice(pathStartCol, pathEndCol);

            // Resolve target strictly relative to the including file
            const baseDir = path.dirname(document.uri.fsPath);
            const abs = path.resolve(baseDir, rel);
            if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
              continue; // only link existing files
            }

            const range = new vscode.Range(new vscode.Position(i, pathStartCol), new vscode.Position(i, pathEndCol));
            const link = new vscode.DocumentLink(range, vscode.Uri.file(abs));
            links.push(link);
          } catch {
            // ignore errors per line
          }
        }
        return links;
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

  // Diagnostics: syntax checking for missing/extra arguments on commands with fixed args
  const diagMs = readMovescript(context);
  // Map of command name -> CommandSpec (only those with fixed args defined)
  const fixedSpecMap = new Map<string, CommandSpec>();
  const allCommandsSet = new Set<string>();
  for (const c of diagMs.commands || []) {
    allCommandsSet.add(c.name);
    // Only include commands where args is defined (fixed-arity). If args is undefined, skip diagnostics.
    if (Object.prototype.hasOwnProperty.call(c, 'args')) {
      fixedSpecMap.set(c.name, c);
    }
  }
  const knownTags = new Set<string>((diagMs.string_tags && diagMs.string_tags.length > 0 ? diagMs.string_tags : (diagMs.tags || [])).filter(t => typeof t === 'string'));

  const diagnostics = vscode.languages.createDiagnosticCollection('movescript');
  context.subscriptions.push(diagnostics);

  function stripCommentRespectingStrings(line: string): string {
    let inString = false;
    let result = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const prev = i > 0 ? line[i - 1] : '';
      if (!inString && ch === '#') {
        break; // drop the rest
      }
      if (ch === '"' && prev !== '\\') {
        inString = !inString;
      }
      result += ch;
    }
    return result;
  }

  type Token = { text: string; start: number; end: number };
  function tokenize(line: string): Token[] {
    const code = stripCommentRespectingStrings(line);
    const tokens: Token[] = [];
    let i = 0;
    const n = code.length;
    while (i < n) {
      // skip whitespace
      while (i < n && (code[i] === ' ' || code[i] === '\t')) i++;
      if (i >= n) break;
      const start = i;
      if (code[i] === '"') {
        // quoted string token
        i++; // consume opening quote
        let escaped = false;
        while (i < n) {
          const ch = code[i];
          if (!escaped && ch === '"') { i++; break; }
          escaped = !escaped && ch === '\\';
          i++;
        }
        tokens.push({ text: code.slice(start, i), start, end: i });
      } else if (code[i] === ',') {
        i++;
        tokens.push({ text: ',', start, end: i });
      } else if ('+-*/%()'.includes(code[i])) {
        // Handle operators and parentheses as separate tokens to correctly parse expressions
        i++;
        tokens.push({ text: code[i - 1], start, end: i });
      } else {
        // regular token until whitespace, comma, operator or parenthesis
        while (i < n && code[i] !== ' ' && code[i] !== '\t' && code[i] !== ',' && !'+-*/%()'.includes(code[i])) i++;
        tokens.push({ text: code.slice(start, i), start, end: i });
      }
    }
    return tokens;
  }

  function isLabelDefinition(line: string): boolean {
    return LABEL_DEF_RE.test(line);
  }

  function validateDocument(document: vscode.TextDocument) {
    if (document.languageId !== 'movescript') return;
    const diags: vscode.Diagnostic[] = [];

    for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
      const full = document.lineAt(lineNum).text;
      // ignore pure comment lines
      const trimmedStart = full.trimStart();
      if (!trimmedStart) continue;
      if (trimmedStart.startsWith('#')) continue;

      const labelMatch = full.match(LABEL_DEF_RE);
      if (labelMatch) {
        continue;
      }

      const tokens = tokenize(full);
      const args: Token[][] = [];
      if (tokens.length > 1) {
        let currentArg: Token[] = [];
        const isOp = (t: string) => '+-*/%'.includes(t) && t.length === 1;
        for (let i = 1; i < tokens.length; i++) {
          const tok = tokens[i];

          if (tok.text === ',') {
            if (currentArg.length > 0) {
              args.push(currentArg);
            }
            currentArg = [];
          } else {
            if (currentArg.length > 0) {
              const lastInCurrent = currentArg[currentArg.length - 1].text;
              const nextIsOp = isOp(tok.text);
              const lastWasOp = isOp(lastInCurrent);

              const isParen = (t: string) => (t === '(' || t === ')') && t.length === 1;

              if (!nextIsOp && !lastWasOp && !isParen(tok.text) && !isParen(lastInCurrent)) {
                // Space-separated argument
                args.push(currentArg);
                currentArg = [tok];
              } else {
                // Continues expression
                currentArg.push(tok);
              }
            } else {
              currentArg.push(tok);
            }
          }
        }
        if (currentArg.length > 0) {
          args.push(currentArg);
        }
      }
      const filteredArgs = args;

      // Check for unnecessary commas
      if (tokens.length > 1) {
        let currentArgTokens: Token[] = [];
        for (let i = 1; i < tokens.length; i++) {
          const tok = tokens[i];
          if (tok.text === ',') {
            // Check if this comma was necessary.
            // A comma is necessary if the argument before it and the argument after it
            // would otherwise be parsed as a single expression.
            // Simplified heuristic: if the token before and after are part of expressions
            // that don't explicitly require a comma but are separated by one.
            // Realistically, the user said: "commas mainly exist to seperate if there is an expression followed by another expression (think of `cmd 1, -1` - 2 args instead of one being `1-1`.)"
            
            // If we have an argument before and a potential argument after.
            if (currentArgTokens.length > 0) {
              // Look ahead for the next argument's first token
              let nextArgFirstTok: Token | undefined;
              for (let j = i + 1; j < tokens.length; j++) {
                if (tokens[j].text !== ',') {
                  nextArgFirstTok = tokens[j];
                  break;
                }
              }

              if (nextArgFirstTok) {
                const lastTokBefore = currentArgTokens[currentArgTokens.length - 1];
                // If it's something like "set a, 1", the comma is NOT necessary if "a 1" wouldn't be a single expression.
                // But "a-1" WOULD be a single expression.
                // If the next token starts with '-' or '+', it might be ambiguous.
                if (!nextArgFirstTok.text.startsWith('-') && !nextArgFirstTok.text.startsWith('+')) {
                  const range = new vscode.Range(
                    new vscode.Position(lineNum, tok.start),
                    new vscode.Position(lineNum, tok.end)
                  );
                  const d = new vscode.Diagnostic(range, `Unnecessary comma`, vscode.DiagnosticSeverity.Information);
                  diags.push(d);
                }
              }
            }
            currentArgTokens = [];
          } else {
            currentArgTokens.push(tok);
          }
        }
      }

      // Validate tags inside string tokens: {tag}
      for (const tok of tokens) {
        if (tok.text.startsWith('"')) {
          const inner = tok.text.slice(1, tok.text.endsWith('"') ? -1 : undefined);
          const re = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(inner)) !== null) {
            const tag = m[1];
            if (!knownTags.has(tag)) {
              const start = tok.start + 1 + (m.index || 0) + 1; // position of tag name start within line
              const end = start + tag.length;
              const range = new vscode.Range(new vscode.Position(lineNum, start - 1), new vscode.Position(lineNum, end + 1)); // include braces
              const d = new vscode.Diagnostic(range, `Unknown tag {${tag}}`, vscode.DiagnosticSeverity.Error);
              diags.push(d);
            }
          }
        }
      }
      if (tokens.length === 0) continue;

      // First token is candidate command name (allow keywords like call/goto/ret as they exist in config)
      const cmdToken = tokens[0];
      // Extract bare word for command (strip quotes if someone wrote a string at start; then it won't match)
      const cmdName = cmdToken.text.startsWith('"') ? '' : cmdToken.text;
      if (!cmdName) continue;

      const spec = fixedSpecMap.get(cmdName);
      if (!spec) {
        // If not a fixed-arity command, check if it's a known command at all, a macro, or a language keyword
        const isKnownCommand = allCommandsSet.has(cmdName);
        const isMacro = workspaceMacros.has(cmdName);
        const isKeyword = ['macro', 'endmacro', 'const', '@include'].includes(cmdName);

        if (!isKnownCommand && !isMacro && !isKeyword) {
          const range = new vscode.Range(
            new vscode.Position(lineNum, cmdToken.start),
            new vscode.Position(lineNum, cmdToken.end)
          );
          const d = new vscode.Diagnostic(range, `Unknown command or macro: ${cmdName}`, vscode.DiagnosticSeverity.Error);
          diags.push(d);
        }
        continue;
      }

      const argsArray: ArgSpec[] = Array.isArray(spec.args) ? spec.args : [];
      const expectedMax = argsArray.length;
      const expectedMin = argsArray.reduce((acc, a) => acc + (a && a.optional === true ? 0 : 1), 0);
      const provided = filteredArgs.length;

      if (expectedMax === 0) {
        // No args expected; any provided are extras
        if (provided > 0) {
          const extraStartTok = filteredArgs[0][0];
          const lastArg = filteredArgs[filteredArgs.length - 1];
          const extraEndTok = lastArg[lastArg.length - 1];
          const range = new vscode.Range(
            new vscode.Position(lineNum, extraStartTok.start),
            new vscode.Position(lineNum, extraEndTok.end)
          );
          const d = new vscode.Diagnostic(range, `${cmdName} takes no arguments (${provided} provided)`, vscode.DiagnosticSeverity.Error);
          diags.push(d);
        }
        continue;
      }

      if (provided < expectedMin) {
        // Missing arguments: underline the command token
        const range = new vscode.Range(
          new vscode.Position(lineNum, cmdToken.start),
          new vscode.Position(lineNum, cmdToken.end)
        );
        const missing = expectedMin - provided;
        const d = new vscode.Diagnostic(range, `Missing ${missing} argument${missing === 1 ? '' : 's'} for ${cmdName} (expected at least ${expectedMin}, got ${provided})`, vscode.DiagnosticSeverity.Error);
        diags.push(d);
      } else if (provided > expectedMax) {
        // Extra arguments: underline the extra part
        const extraStartTok = filteredArgs[expectedMax][0];
        const lastArg = filteredArgs[filteredArgs.length - 1];
        const extraEndTok = lastArg[lastArg.length - 1];
        if (extraStartTok && extraEndTok) {
          const range = new vscode.Range(
            new vscode.Position(lineNum, extraStartTok.start),
            new vscode.Position(lineNum, extraEndTok.end)
          );
          const extra = provided - expectedMax;
          const d = new vscode.Diagnostic(range, `Too many arguments for ${cmdName} (expected at most ${expectedMax}, got ${provided}; ${extra} extra)`, vscode.DiagnosticSeverity.Error);
          diags.push(d);
        }
      }

      // Check argument types (specifically 'label' type)
      for (let i = 0; i < Math.min(provided, expectedMax); i++) {
        const argSpec = argsArray[i];
        const argTokens = filteredArgs[i];
        if (argSpec.type === 'label') {
          // A label should typically be a single token (identifier)
          // For labels, we check if they exist in the workspaceLabels map.
          // Since expressions can now be complex, we only validate simple labels.
          if (argTokens.length === 1) {
            const token = argTokens[0];
            const labelName = token.text;
            // Ignore numeric labels and expressions
            if (isNaN(Number(labelName)) && !['+', '-', '*', '/', '%'].some(op => labelName.includes(op))) {
              if (!workspaceLabels.has(labelName)) {
                const range = new vscode.Range(
                  new vscode.Position(lineNum, token.start),
                  new vscode.Position(lineNum, token.end)
                );
                const d = new vscode.Diagnostic(range, `Label not found: ${labelName}`, vscode.DiagnosticSeverity.Error);
                diags.push(d);
              }
            }
          }
        }
      }
    }

    // Check for duplicate labels using workspace-wide cache
    const docLabels = new Set<string>();
    for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
      const full = document.lineAt(lineNum).text;
      const labelMatch = full.match(LABEL_DEF_RE);
      if (labelMatch) {
        const name = labelMatch[1];
        const startIdx = full.indexOf(name);
        const range = new vscode.Range(lineNum, startIdx, lineNum, startIdx + name.length);

        const allDefs = workspaceLabels.get(name) || [];
        if (allDefs.length > 1) {
          // Find the first *other* definition
          const otherDef = allDefs.find(d =>
            d.uri.toString() !== document.uri.toString() ||
            d.range.start.line !== lineNum
          );

          if (otherDef) {
            const diag = new vscode.Diagnostic(
              range,
              `Duplicate label definition: ${name}`,
              vscode.DiagnosticSeverity.Error
            );
            diag.relatedInformation = [
              new vscode.DiagnosticRelatedInformation(
                new vscode.Location(otherDef.uri, otherDef.range),
                `Other definition of ${name} in ${path.basename(otherDef.uri.fsPath)}`
              )
            ];
            diags.push(diag);
          }
        }
      }
    }

    diagnostics.set(document.uri, diags);
  }

  // Hover provider: show documentation for labels and macros
  context.subscriptions.push(
    vscode.languages.registerHoverProvider('movescript', {
      async provideHover(document, position) {
        const word = getWordAtPosition(document, position);
        if (!word) return;

        const parts: string[] = [];

        // Check macros
        const macroDefs = workspaceMacros.get(word);
        if (macroDefs && macroDefs.length > 0) {
          parts.push('**macro**');
          const doc = macroDefs[0].documentation;
          if (doc) {
            parts.push(doc);
          }
        } else {
          // Check commands (only if not a macro, or should we show both? user said "if it's one of the two")
          const spec = diagMs.commands?.find(c => c.name === word);
          if (spec) {
            parts.push('**command**');
            if (spec.detail) {
              parts.push(spec.detail);
            }
          }
        }

        // Check labels (keep them but maybe add label prefix?)
        if (parts.length === 0) {
          const labelDefs = workspaceLabels.get(word);
          if (labelDefs && labelDefs.length > 0) {
            parts.push('**label**');
            const doc = labelDefs[0].documentation;
            if (doc) {
              parts.push(doc);
            }
          }
        }

        if (parts.length > 0) {
          return new vscode.Hover(new vscode.MarkdownString(parts.join('\n\n')));
        }

        return;
      }
    })
  );

  // Validate currently open documents
  for (const doc of vscode.workspace.textDocuments) {
    if (doc.languageId === 'movescript') validateDocument(doc);
  }

  // Re-validate on open/save/change
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => {
      if (doc.languageId === 'movescript') {
        refreshSymbols();
        validateDocument(doc);
      }
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.languageId === 'movescript') {
        refreshSymbols();
        validateDocument(doc);
        unimplementedProvider.refresh();
      }
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(evt => {
      const doc = evt.document;
      if (doc.languageId === 'movescript') {
        validateDocument(doc);
        debounceRefresh();
      }
    })
  );
}

class MoveScriptDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  public provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
    const symbols: vscode.DocumentSymbol[] = [];
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const text = line.text;

      // Label definitions
      const labelMatch = text.match(LABEL_DEF_RE);
      if (labelMatch) {
        const name = labelMatch[1];
        const range = line.range;
        const selectionRange = new vscode.Range(i, text.indexOf(name), i, text.indexOf(name) + name.length);
        symbols.push(new vscode.DocumentSymbol(
          name,
          '',
          vscode.SymbolKind.Function,
          range,
          selectionRange
        ));
      }

      // Macro definitions
      const macroMatch = text.match(MACRO_DEF_RE);
      if (macroMatch) {
        const name = macroMatch[1];
        const range = line.range;
        const selectionRange = new vscode.Range(i, text.indexOf(name), i, text.indexOf(name) + name.length);
        symbols.push(new vscode.DocumentSymbol(
          name,
          'macro',
          vscode.SymbolKind.Module,
          range,
          selectionRange
        ));
      }

      // Const definitions
      const constMatch = text.match(CONST_DEF_RE);
      if (constMatch) {
        const name = constMatch[1];
        const range = line.range;
        const selectionRange = new vscode.Range(i, text.indexOf(name), i, text.indexOf(name) + name.length);
        symbols.push(new vscode.DocumentSymbol(
          name,
          'const',
          vscode.SymbolKind.Constant,
          range,
          selectionRange
        ));
      }
    }
    return symbols;
  }
}

class UnimplementedTreeItem extends vscode.TreeItem {
  constructor(
    public readonly labelName: string,
    public readonly fileName: string,
    public readonly uri: vscode.Uri,
    public readonly range: vscode.Range,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(labelName, collapsibleState);
    this.tooltip = `${this.uri.fsPath}:${this.range.start.line + 1}`;
    this.description = `${fileName}:${this.range.start.line + 1}`;
    this.command = {
      command: 'movescript.openUnimplemented',
      title: 'Open Unimplemented Location',
      arguments: [this.uri, this.range]
    };
  }
}

class UnimplementedTreeDataProvider implements vscode.TreeDataProvider<UnimplementedTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<UnimplementedTreeItem | undefined | null | void> = new vscode.EventEmitter<UnimplementedTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<UnimplementedTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: UnimplementedTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: UnimplementedTreeItem): Promise<UnimplementedTreeItem[]> {
    if (element) {
      return [];
    }

    const items: UnimplementedTreeItem[] = [];
    const uris = await vscode.workspace.findFiles('**/*.ms');
    const gotoRE = /^\s*goto\s+_notImplemented\b/;

    for (const uri of uris) {
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        let lastLabel = '';
        for (let i = 0; i < doc.lineCount; i++) {
          const text = doc.lineAt(i).text;

          const labelMatch = text.match(LABEL_DEF_RE);
          if (labelMatch) {
            lastLabel = labelMatch[1];
          }

          const match = text.match(gotoRE);
          if (match) {
            const startIdx = text.indexOf('goto');
            const range = new vscode.Range(i, startIdx, i, text.length);
            const fileName = path.basename(uri.fsPath);
            const labelToShow = lastLabel ? lastLabel : 'unknown';
            items.push(new UnimplementedTreeItem(labelToShow, fileName, uri, range, vscode.TreeItemCollapsibleState.None));
          }
        }
      } catch {
        // ignore
      }
    }

    return items.sort((a, b) => a.range.start.line - b.range.start.line || a.fileName.localeCompare(b.fileName));
  }
}

export function deactivate() {}

type ArgType = 'label' | 'string' | 'number' | 'flag' | 'identifier' | 'variable';

interface ArgSpec {
  name: string;
  type?: ArgType;
  optional?: boolean; // if omitted, treated as false
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
  string_tags?: string[]; // new preferred name
  tags?: string[]; // backward compatibility
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
                  const optional: boolean | undefined = typeof a.optional === 'boolean' ? a.optional : undefined;
                  return { name, type, optional } as ArgSpec;
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
    const string_tags: string[] = Array.isArray(parsed?.string_tags)
      ? parsed.string_tags.filter((x: any) => typeof x === 'string')
      : [];
    const legacyTags: string[] = Array.isArray(parsed?.tags) ? parsed.tags.filter((x: any) => typeof x === 'string') : [];
    const mergedTags = (string_tags.length > 0 ? string_tags : legacyTags);
    return { commands, flags, identifiers, variables, string_tags: mergedTags, tags: legacyTags } as MovescriptConfig;
  } catch {
    return { commands: [], flags: [], identifiers: [], variables: [], string_tags: [] } as MovescriptConfig;
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
