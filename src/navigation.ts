import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FXScriptConfig } from './types';
import { SymbolCache, collectAllConstDefinitions, collectAllMacroDefinitions } from './symbols';
import { LABEL_DEF_RE, CONST_DEF_RE, MACRO_DEF_RE, getWordAtPosition, stripCommentAndMaskStrings, tokenize, Token, readFXScript } from './util';

export function registerNavigationProviders(context: vscode.ExtensionContext, _config: FXScriptConfig, symbolCache: SymbolCache) {
  // Hover Provider
  context.subscriptions.push(
    vscode.languages.registerHoverProvider('fxscript', {
      provideHover(document, position) {
        const config = readFXScript(context);
        const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_-]*/);
        if (!wordRange) return;
        const word = document.getText(wordRange);

        // Check for commands
        const spec = config.commands.find(c => c.name === word);
        if (spec) {
          const signature = spec.name + (spec.args && spec.args.length ? ' ' + spec.args.map(a => `<${a.name}>`).join(' ') : '');
          const md = new vscode.MarkdownString();
          md.appendCodeblock(signature, 'fxscript');
          if (spec.detail) {
            md.appendMarkdown('\n---\n');
            md.appendMarkdown(spec.detail);
          }
          return new vscode.Hover(md, wordRange);
        }

        // Check for labels
        const labelDefs = symbolCache.workspaceLabels.get(word);
        if (labelDefs && labelDefs.length > 0) {
          const def = labelDefs[labelDefs.length - 1]; // Use last definition
          const md = new vscode.MarkdownString();
          md.appendCodeblock(`(label) ${word}`, 'text');
          if (def.documentation) {
            md.appendMarkdown('\n---\n');
            md.appendMarkdown(def.documentation);
          }
          return new vscode.Hover(md, wordRange);
        }

        // Check for macros
        const macroDefs = symbolCache.workspaceMacros.get(word);
        if (macroDefs && macroDefs.length > 0) {
          const def = macroDefs[macroDefs.length - 1];
          const md = new vscode.MarkdownString();
          md.appendCodeblock(`(macro) ${word}`, 'text');
          if (def.documentation) {
            md.appendMarkdown('\n---\n');
            md.appendMarkdown(def.documentation);
          }
          return new vscode.Hover(md, wordRange);
        }

        // Check for constants
        const constDefs = symbolCache.workspaceConsts.get(word);
        if (constDefs && constDefs.length > 0) {
          const md = new vscode.MarkdownString();
          md.appendCodeblock(`(constant) ${word}`, 'text');
          return new vscode.Hover(md, wordRange);
        }

        // Check for string tags in curly braces
        const line = document.lineAt(position.line).text;
        const tagRegex = /\{([^}]+)\}/g;
        let match;
        while ((match = tagRegex.exec(line)) !== null) {
          const start = match.index + 1;
          const end = start + match[1].length;
          if (position.character >= start && position.character <= end) {
            const tag = match[1];
            // Only look up in stringTags
            if (config.stringTags?.includes(tag)) {
              // Ensure we are inside a string
              let inString = false;
              let escaped = false;
              for (let i = 0; i < match.index; i++) {
                const ch = line[i];
                if (ch === '"' && !escaped) inString = !inString;
                escaped = ch === '\\' && !escaped;
              }
              if (inString) {
                const md = new vscode.MarkdownString();
                md.appendCodeblock(`(tag) ${tag}`, 'text');
                return new vscode.Hover(md, new vscode.Range(position.line, start, position.line, end));
              }
            }
          }
        }

        // Check for identifiers
        if (config.identifiers.includes(word)) {
          const md = new vscode.MarkdownString();
          md.appendCodeblock(`(identifier) ${word}`, 'text');
          return new vscode.Hover(md, wordRange);
        }

        return;
      }
    })
  );

  // Signature Help Provider
  context.subscriptions.push(
    vscode.languages.registerSignatureHelpProvider(
      { language: 'fxscript', scheme: 'file' },
      {
        provideSignatureHelp(document, position): vscode.ProviderResult<vscode.SignatureHelp> {
          const config = readFXScript(context);
          const lineText = document.lineAt(position.line).text;
          const masked = stripCommentAndMaskStrings(lineText, true);

          const maskedBefore = masked.substring(0, position.character);

          // Split by commas, but we need to know if a comma is a command separator or an argument separator.
          // This is tricky. For signature help, we usually look backwards for the command name.

          const lastCommandMatch = Array.from(maskedBefore.matchAll(/(?:^|,)\s*([A-Za-z_][A-Za-z0-9_-]*)/g)).pop();
          if (!lastCommandMatch) return null;

          const cmdName = lastCommandMatch[1];
          const spec = config.commands.find(c => c.name === cmdName);
          if (!spec) return null;

          const cmdStartIdx = lastCommandMatch.index! + lastCommandMatch[0].indexOf(cmdName);
          const afterCmd = maskedBefore.slice(cmdStartIdx + cmdName.length);

          // Count commas in afterCmd to see how many arguments we've passed.
          // If no commas, we use spaces but respect operators.
          const afterTokens = tokenize(afterCmd);
          const hasComma = afterCmd.includes(',');

          let argIndex = 0;
          if (hasComma) {
            const segments = afterCmd.split(',');
            argIndex = segments.length - 1;
          } else {
            const params = Array.isArray(spec.args) ? spec.args : [];
            const expectedCount = params.length;

            let i = 0;
            const args: Token[][] = [];
            const isOperator = (t: Token) => '-+*/%'.includes(t.text);

            while (i < afterTokens.length) {
              if (args.length < expectedCount - 1) {
                let j = i + 1;
                while (j < afterTokens.length && (isOperator(afterTokens[j]) || isOperator(afterTokens[j - 1]))) {
                  j++;
                }
                args.push(afterTokens.slice(i, j));
                i = j;
              } else {
                args.push(afterTokens.slice(i));
                break;
              }
            }

            const endsWithSpace = afterCmd.length > 0 && (afterCmd[afterCmd.length - 1] === ' ' || afterCmd[afterCmd.length - 1] === '\t');

            if (afterTokens.length === 0) {
              argIndex = 0;
            } else {
              argIndex = args.length - (endsWithSpace ? 0 : 1);
            }
          }

          const help = new vscode.SignatureHelp();
          help.activeSignature = 0;
          help.activeParameter = Math.max(0, argIndex);

          const params = Array.isArray(spec.args) ? spec.args : [];
          const label = spec.name + (params.length ? ' ' + params.map(a => `<${a.name}>`).join(' ') : '');
          const si = new vscode.SignatureInformation(label);
          si.parameters = params.map(p => new vscode.ParameterInformation(`<${p.name}>`));
          help.signatures = [si];
          return help;
        }
      },
      ' ',
      ','
    )
  );

  // Definition Provider
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider('fxscript', {
      async provideDefinition(document, position) {
        // Handle @include
        {
          const lineText = document.lineAt(position.line).text;
          const hashIdx = lineText.indexOf('#');
          const codePart = hashIdx >= 0 ? lineText.slice(0, hashIdx) : lineText;
          const includeIdx = codePart.indexOf('@include');
          if (includeIdx >= 0) {
            const after = codePart.slice(includeIdx + '@include'.length);
            const wsMatch = after.match(/^[ \t]+/);
            if (wsMatch) {
              const pathStartIdx = includeIdx + '@include'.length + wsMatch[0].length;
              let pathEndIdx = pathStartIdx;
              while (pathEndIdx < codePart.length) {
                const ch = codePart[pathEndIdx];
                if (ch === ' ' || ch === '\t') break;
                pathEndIdx++;
              }
              if (position.character >= pathStartIdx && position.character <= pathEndIdx) {
                const rel = codePart.slice(pathStartIdx, pathEndIdx);
                try {
                  const baseDir = path.dirname(document.uri.fsPath);
                  const abs = path.resolve(baseDir, rel);
                  if (fs.existsSync(abs)) {
                    const stat = fs.statSync(abs);
                    if (stat.isFile()) {
                      return new vscode.Location(vscode.Uri.file(abs), new vscode.Position(0, 0));
                    }
                  }
                } catch {}
              }
            }
          }
        }

        const word = getWordAtPosition(document, position);
        if (!word) return;

        // Special case: ret
        if (word === 'ret') {
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
        const uris = await vscode.workspace.findFiles('**/*.fx');
            const callRe = new RegExp(`^\\s*call\\s+${enclosing}(?![A-Za-z0-9_-])`);
            for (const uri of uris) {
              try {
                const doc = await vscode.workspace.openTextDocument(uri);
                for (let i = 0; i < doc.lineCount; i++) {
                  const full = doc.lineAt(i).text;
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
              } catch {}
            }
            if (locations.length > 0) return locations;
          }
        }

        const constMap = await collectAllConstDefinitions();
        const constDefs = constMap.get(word);
        if (constDefs && constDefs.length > 0) {
          const last = constDefs[constDefs.length - 1];
          return new vscode.Location(last.uri, last.range);
        }

        const labelDefs = symbolCache.workspaceLabels.get(word);
        if (labelDefs && labelDefs.length > 0) {
          const isOnDefIdx = labelDefs.findIndex(ld => ld.uri.toString() === document.uri.toString() && ld.range.contains(position));
          if (isOnDefIdx !== -1 && labelDefs.length > 1) {
            const otherIdx = (isOnDefIdx === 0) ? 1 : 0;
            const other = labelDefs[otherIdx];
            return new vscode.Location(other.uri, other.range);
          }
          const last = labelDefs[labelDefs.length - 1];
          return new vscode.Location(last.uri, last.range);
        }

        const macroMap = await collectAllMacroDefinitions();
        const macroDefs = macroMap.get(word);
        if (macroDefs && macroDefs.length > 0) {
          const last = macroDefs[macroDefs.length - 1];
          return new vscode.Location(last.uri, last.range);
        }

        return null;
      }
    })
  );

  // Reference Provider
  context.subscriptions.push(
    vscode.languages.registerReferenceProvider('fxscript', {
      async provideReferences(document, position, context) {
        const word = getWordAtPosition(document, position);
        if (!word) return [];

        const occurrences: vscode.Location[] = [];
        const uris = await vscode.workspace.findFiles('**/*.fx');
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

              const isLabelDef = LABEL_DEF_RE.test(noComment);
              const isConstDef = CONST_DEF_RE.test(noComment);
              const isDefLine = isLabelDef || isConstDef;

              let match: RegExpExecArray | null;
              wordRe.lastIndex = 0;
              while ((match = wordRe.exec(noComment)) !== null) {
                const range = new vscode.Range(new vscode.Position(i, match.index), new vscode.Position(i, match.index + word.length));
                if (isDefLine) {
                  if (context.includeDeclaration) {
                    occurrences.push(new vscode.Location(uri, range));
                  }
                } else {
                  occurrences.push(new vscode.Location(uri, range));
                }
              }
            }
          } catch {}
        }
        return occurrences;
      }
    })
  );

  // Document Symbols Provider
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      { language: 'fxscript' },
      new FXScriptDocumentSymbolProvider()
    )
  );

  // Document Links Provider
  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider('fxscript', {
      provideDocumentLinks(document) {
        const links: vscode.DocumentLink[] = [];
        for (let i = 0; i < document.lineCount; i++) {
          const lineText = document.lineAt(i).text;
          const hashIdx = lineText.indexOf('#');
          const codePart = hashIdx >= 0 ? lineText.slice(0, hashIdx) : lineText;
          const includeIdx = codePart.indexOf('@include');
          if (includeIdx >= 0) {
            const after = codePart.slice(includeIdx + '@include'.length);
            const wsMatch = after.match(/^[ \t]+/);
            if (wsMatch) {
              const pathStartIdx = includeIdx + '@include'.length + wsMatch[0].length;
              let pathEndIdx = pathStartIdx;
              while (pathEndIdx < codePart.length) {
                const ch = codePart[pathEndIdx];
                if (ch === ' ' || ch === '\t') break;
                pathEndIdx++;
              }
              const rel = codePart.slice(pathStartIdx, pathEndIdx);
              try {
                const baseDir = path.dirname(document.uri.fsPath);
                const abs = path.resolve(baseDir, rel);
                const uri = vscode.Uri.file(abs);
                const range = new vscode.Range(i, pathStartIdx, i, pathEndIdx);
                links.push(new vscode.DocumentLink(range, uri));
              } catch {}
            }
          }
        }
        return links;
      }
    })
  );
}

export class FXScriptDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.DocumentSymbol[]> {
    const symbols: vscode.DocumentSymbol[] = [];
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const text = line.text;
      const labelMatch = text.match(LABEL_DEF_RE);
      if (labelMatch) {
        const name = labelMatch[1];
        const range = line.range;
        const selectionRange = new vscode.Range(i, text.indexOf(name), i, text.indexOf(name) + name.length);
        symbols.push(new vscode.DocumentSymbol(name, '', vscode.SymbolKind.Function, range, selectionRange));
      }
      const macroMatch = text.match(MACRO_DEF_RE);
      if (macroMatch) {
        const name = macroMatch[1];
        const range = line.range;
        const selectionRange = new vscode.Range(i, text.indexOf(name), i, text.indexOf(name) + name.length);
        symbols.push(new vscode.DocumentSymbol(name, 'macro', vscode.SymbolKind.Module, range, selectionRange));
      }
      const constMatch = text.match(CONST_DEF_RE);
      if (constMatch) {
        const name = constMatch[1];
        const range = line.range;
        const selectionRange = new vscode.Range(i, text.indexOf(name), i, text.indexOf(name) + name.length);
        symbols.push(new vscode.DocumentSymbol(name, 'const', vscode.SymbolKind.Constant, range, selectionRange));
      }
    }
    return symbols;
  }
}
