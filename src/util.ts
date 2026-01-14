import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CommandSpec, MovescriptConfig, ArgType, ArgSpec, ConstType } from './types';

export const IDENT_RE = /[A-Za-z_][A-Za-z0-9_-]*/g;
export const LABEL_DEF_RE = /^\s*([A-Za-z_][A-Za-z0-9_-]*:)/;
export const MACRO_DEF_RE = /^macro\s+([A-Za-z_][A-Za-z0-9_-]*)/;
export const CONST_DEF_RE = /^\s*const\s+([A-Za-z_][A-Za-z0-9_-]*)\b/;

export function parseMovescriptJson(raw: string): MovescriptConfig {
  try {
    const parsed = JSON.parse(raw);
    const cmds: any[] = Array.isArray(parsed?.commands) ? parsed.commands : [];
    const commands: CommandSpec[] = cmds
      .filter(c => c && typeof c.name === 'string')
      .map(c => {
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

export function readMovescript(context: vscode.ExtensionContext): MovescriptConfig {
  const baseFile = context.asAbsolutePath(path.join('data', 'movescript.json'));
  let config: MovescriptConfig = { commands: [], flags: [], identifiers: [], variables: [], string_tags: [] };

  try {
    const raw = fs.readFileSync(baseFile, 'utf8');
    config = parseMovescriptJson(raw);
  } catch (err) {
    console.error(`Failed to read base movescript.json: ${err}`);
  }

  // Merge with workspace commands.json
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const localFile = path.join(workspaceRoot, 'commands.json');
    if (fs.existsSync(localFile)) {
      try {
        const localRaw = fs.readFileSync(localFile, 'utf8');
        const localConfig = parseMovescriptJson(localRaw);

        // Merge commands
        const commandNames = new Set(config.commands.map(c => c.name));
        for (const cmd of localConfig.commands) {
          if (!commandNames.has(cmd.name)) {
            config.commands.push(cmd);
            commandNames.add(cmd.name);
          }
        }

        // Merge other lists
        config.flags = [...new Set([...config.flags, ...localConfig.flags])];
        config.identifiers = [...new Set([...config.identifiers, ...localConfig.identifiers])];
        config.variables = [...new Set([...config.variables, ...localConfig.variables])];
        config.string_tags = [...new Set([...(config.string_tags || []), ...(localConfig.string_tags || [])])];
      } catch (err) {
        console.error(`Failed to read local commands.json: ${err}`);
      }
    }
  }

  return config;
}

export function extractSymbolsFromText(text: string): { macros: string[]; consts: { name: string; type: ConstType }[]; labels: string[] } {
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
      labels.add(lm[1].slice(0, -1));
    }

    const mm = trimmed.match(MACRO_DEF_RE);
    if (mm) {
      macros.add(mm[1]);
    }

    const cmm = trimmed.match(/^\s*const\s+([A-Za-z_][A-Za-z0-9_-]*)\s+(.+?)\s*$/);
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

export function stripCommentAndMaskStrings(line: string, maskStrings: boolean = false): string {
    let inString = false;
    let result = '';
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const prev = i > 0 ? line[i - 1] : '';
        if (!inString && ch === '#') {
            if (maskStrings) {
                result += ' '.repeat(line.length - i);
            }
            break;
        }
        if (ch === '"' && prev !== '\\') {
            inString = !inString;
            if (maskStrings) {
                result += ' ';
                continue;
            }
        }
        result += (inString && maskStrings) ? ' ' : ch;
    }
    return result;
}

export function getWordAtPosition(document: vscode.TextDocument, position: vscode.Position): string | undefined {
    const wordRange = document.getWordRangeAtPosition(position, IDENT_RE);
    if (!wordRange) return undefined;
    return document.getText(wordRange);
}

export function knownTags(config: MovescriptConfig): Set<string> {
    return new Set((config.string_tags && config.string_tags.length > 0 ? config.string_tags : (config.tags || [])));
}

export type Token = { text: string; start: number; end: number };
export function tokenize(line: string): Token[] {
  const code = stripCommentAndMaskStrings(line, false);
  const tokens: Token[] = [];
  let i = 0;
  const n = code.length;
  while (i < n) {
    while (i < n && (code[i] === ' ' || code[i] === '\t')) i++;
    if (i >= n) break;
    const start = i;
    if (code[i] === '"') {
      i++;
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
    } else if (code[i] === '-' && (i + 1 < n) && /[0-9]/.test(code[i + 1])) {
      // Negative number: keep - with digits
      i++;
      while (i < n && /[0-9.]/.test(code[i])) i++;
      tokens.push({ text: code.slice(start, i), start, end: i });
    } else if ('+*/%()'.includes(code[i])) {
      i++;
      tokens.push({ text: code[i - 1], start, end: i });
    } else {
      while (i < n && !' \t,:+*/%()'.includes(code[i])) i++;
      let text = code.slice(start, i);
      // If we stopped at a colon, include it in the token if it looks like a label
      if (i < n && code[i] === ':') {
        i++;
        text += ':';
      }
      tokens.push({ text, start, end: i });
    }
  }
  return tokens;
}
