import * as vscode from 'vscode';
import * as fs from 'fs';

type CommandSpec = { name: string; detail?: string; args?: string[] };
type CommandsFile = { commands: CommandSpec[] };

function readCommands(context: vscode.ExtensionContext): CommandSpec[] {
  try {
    const p = vscode.Uri.joinPath(context.extensionUri, 'data', 'commands.json').fsPath;
    const raw = fs.readFileSync(p, 'utf8');
    const json = JSON.parse(raw) as CommandsFile;
    return json.commands || [];
  } catch {
    return [];
  }
}

const MACRO_DEF_RE = /^\s*macro\s+([A-Za-z_][A-Za-z0-9_]*)/;
const END_MACRO_RE = /^\s*endmacro\b/;
const CONST_DEF_RE = /^\s*const\s+([A-Za-z_][A-Za-z0-9_]*)/;
const LABEL_DEF_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/;

function extractSymbolsFromText(text: string) {
  const macros = new Set<string>();
  const consts = new Set<string>();
  const labels = new Set<string>();
  let inMacro = false;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    if (!inMacro) {
      const m = line.match(MACRO_DEF_RE);
      if (m) {
        macros.add(m[1]);
        inMacro = true;
        continue;
      }
    } else if (END_MACRO_RE.test(line)) {
      inMacro = false;
      continue;
    }

    const c = line.match(CONST_DEF_RE);
    if (c) consts.add(c[1]);

    const l = line.match(LABEL_DEF_RE);
    if (l) labels.add(l[1]);
  }
  return { macros: [...macros], consts: [...consts], labels: [...labels] };
}

async function collectWorkspaceSymbols(): Promise<ReturnType<typeof extractSymbolsFromText>> {
  const macros = new Set<string>();
  const consts = new Set<string>();
  const labels = new Set<string>();
  const uris = await vscode.workspace.findFiles('**/*.ms');
  for (const uri of uris) {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const { macros: m, consts: c, labels: l } = extractSymbolsFromText(doc.getText());
      m.forEach(x => macros.add(x));
      c.forEach(x => consts.add(x));
      l.forEach(x => labels.add(x));
    } catch {
      // ignore
    }
  }
  return { macros: [...macros], consts: [...consts], labels: [...labels] };
}

function makeItems(names: string[], kind: vscode.CompletionItemKind, detail?: string): vscode.CompletionItem[] {
  return names.map(n => {
    const item = new vscode.CompletionItem(n, kind);
    if (detail) item.detail = detail;
    return item;
  });
}

function createCompletionProvider(context: vscode.ExtensionContext) {
  const commands = readCommands(context);

  let cache: { macros: string[]; consts: string[]; labels: string[] } = { macros: [], consts: [], labels: [] };

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

      // Determine first token of the line
      const firstTokenMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
      const firstToken = firstTokenMatch?.[1];
      const afterFirstToken = firstToken ? trimmed.substring(firstToken.length).trimLeft() : '';

      const items: vscode.CompletionItem[] = [];

      // Always propose constants and labels/macros where appropriate
      items.push(
        ...makeItems(cache.consts, vscode.CompletionItemKind.Constant, 'const'),
        ...makeItems(cache.labels, vscode.CompletionItemKind.Reference, 'label'),
        ...makeItems(cache.macros, vscode.CompletionItemKind.Snippet, 'macro')
      );

      // Commands suggestions primarily at line start or when no first token yet
      if (!firstToken || atLineStart) {
        for (const cmd of commands) {
          const it = new vscode.CompletionItem(cmd.name, vscode.CompletionItemKind.Function);
          if (cmd.detail) it.detail = cmd.detail;
          // Simple insert text with tabstops for args
          if (cmd.args && cmd.args.length) {
            const placeholders = cmd.args.map((a, i) => `
${i + 1}:${a}`); // just names, not actual snippet placeholders to avoid over-eager snippets
            // prefer a simple insertion: name and a space
            it.insertText = cmd.name + ' ';
          }
          items.push(it);
        }
      } else {
        // If first token is a known command, try to suggest its next argument name
        const spec = commands.find(c => c.name === firstToken);
        if (spec) {
          const providedArgs = afterFirstToken.length ? afterFirstToken.split(/\s+/).filter(Boolean) : [];
          const nextIndex = Math.min(providedArgs.length, (spec.args?.length || 0) - 1);
          if (spec.args && spec.args[nextIndex]) {
            const name = spec.args[nextIndex];
            const argItem = new vscode.CompletionItem(`<${name}>`, vscode.CompletionItemKind.Value);
            argItem.detail = `argument for ${spec.name}`;
            items.push(argItem);
          }
        }
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
}

export function deactivate() {}
