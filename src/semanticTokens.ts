import * as vscode from 'vscode';
import { SymbolCache } from './symbols';
import { stripCommentAndMaskStrings, readFXScript, tokenize, Token } from './util';

const tokenTypes = ['variable', 'keyword', 'parameter', 'type', 'macro', 'function', 'number', 'regexp', 'label'];
const tokenModifiers = ['declaration', 'documentation'];
export const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);

export function registerSemanticTokenProvider(context: vscode.ExtensionContext, symbolCache: SymbolCache) {
  const onDidChangeSemanticTokensEmitter = new vscode.EventEmitter<void>();

  const provider: vscode.DocumentSemanticTokensProvider = {
    onDidChangeSemanticTokens: onDidChangeSemanticTokensEmitter.event,
    provideDocumentSemanticTokens(document: vscode.TextDocument) {
      const config = readFXScript(context);
      const identifiersSet = new Set(config.identifiers || []);

      const builder = new vscode.SemanticTokensBuilder(legend);

      const workspaceLabels = symbolCache.workspaceLabels;
      const workspaceSymbols = symbolCache.symbols;

      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i).text;
        const masked = stripCommentAndMaskStrings(line, true);
        if (!masked.trim()) continue;

        const allTokens = tokenize(line);
        if (allTokens.length === 0) continue;

        // Group tokens by commas and spaces to handle multiple commands per line
        const commandGroups: { tokens: Token[], groupIdx: number }[] = [];
        let currentGroup: Token[] = [];

        const isCommandStartToken = (t: Token) => {
          if (!t) return false;
          const text = t.text.toLowerCase();
          if (config.commands.some(c => c.name.toLowerCase() === text)) return true;
          if (['call', 'goto', 'ret', '@include', 'macro', 'const', 'endmacro'].includes(text)) return true;
          if (workspaceSymbols.macros.some(m => m.toLowerCase() === text)) return true;
          return false;
        };

        for (let j = 0; j < allTokens.length; j++) {
          const token = allTokens[j];
          const text = token.text.toLowerCase();
          if (token.text === ',') {
            const nextToken = allTokens[j + 1];

            if (isCommandStartToken(nextToken) && currentGroup.length > 0) {
              commandGroups.push({ tokens: currentGroup, groupIdx: commandGroups.length });
              currentGroup = [];
            } else {
              currentGroup.push(token);
            }
          } else if (token.text.endsWith(':') && currentGroup.length > 0) {
            commandGroups.push({ tokens: currentGroup, groupIdx: commandGroups.length });
            currentGroup = [token];
          } else {
            currentGroup.push(token);
          }
        }
        if (currentGroup.length > 0) {
          commandGroups.push({ tokens: currentGroup, groupIdx: commandGroups.length });
        }

        const lineTokens: { start: number, length: number, type: number }[] = [];

        for (const group of commandGroups) {
          const tokens = group.tokens;
          if (tokens.length === 0) continue;

          const firstToken = tokens[0];
          const cmdNameRaw = firstToken.text;
          const cmdName = cmdNameRaw.toLowerCase();

          let idx = 0;
          // Check for label definition
          if (cmdNameRaw.endsWith(':') && group.groupIdx === 0) {
            const labelName = cmdNameRaw.slice(0, -1);
            lineTokens.push({ start: firstToken.start, length: labelName.length, type: tokenTypes.indexOf('label') });
            idx = 1;
          } else if (config.commands.some(c => c.name.toLowerCase() === cmdName) || ['call', 'goto', 'ret', '@include', 'macro', 'const', 'endmacro'].includes(cmdName) || workspaceSymbols.macros.some(m => m.toLowerCase() === cmdName)) {
            let cmdType = tokenTypes.indexOf('function');
            if (['call', 'goto', 'ret', '@include', 'macro', 'const', 'endmacro'].includes(cmdName)) {
              cmdType = tokenTypes.indexOf('keyword');
            } else if (workspaceSymbols.macros.some(m => m.toLowerCase() === cmdName)) {
              cmdType = tokenTypes.indexOf('macro');
            } else {
              // Standard commands should be 'function' (which we'll map to support.function in package.json if needed, or leave as function)
              cmdType = tokenTypes.indexOf('function');
            }
            lineTokens.push({ start: firstToken.start, length: cmdNameRaw.length, type: cmdType });
            idx = 1;

            // If the command was '@include' or 'const', we don't color the next token
            if (['@include', 'const'].includes(cmdName) && tokens.length > 1) {
              idx = 2;
            }

            // If the command was 'macro', the NEXT token is the macro name (declaration)
            if (cmdName === 'macro' && tokens.length > 1) {
                const nextToken = tokens[1];
                if (/^[A-Za-z_][A-Za-z0-9_-]*/.test(nextToken.text)) {
                    lineTokens.push({ start: nextToken.start, length: nextToken.text.length, type: tokenTypes.indexOf('macro') });
                    idx = 2;
                }
            }
            // If the command was 'call' or 'goto', the NEXT token is a label (if it looks like one)
            if (['call', 'goto'].includes(cmdName) && tokens.length > 1) {
                const nextToken = tokens[1];
                if (/^[A-Za-z_][A-Za-z0-9_-]*/.test(nextToken.text)) {
                    lineTokens.push({ start: nextToken.start, length: nextToken.text.length, type: tokenTypes.indexOf('label') });
                    idx = 2;
                }
            }
            // If the command was 'jumpIf', etc. they might also have labels
            if (cmdName.startsWith('jump') && tokens.length > 1) {
                const lastToken = tokens[tokens.length - 1];
                const lastText = lastToken.text.toLowerCase();
                if (/^[A-Za-z_][A-Za-z0-9_-]*/.test(lastToken.text)) {
                    // If it's not a known identifier, it's likely a label
                    const isIdent = identifiersSet.has(lastToken.text) || Array.from(identifiersSet).some(i => i.toLowerCase() === lastText);

                    if (!isIdent) {
                         lineTokens.push({ start: lastToken.start, length: lastToken.text.length, type: tokenTypes.indexOf('label') });
                    }
                }
            }
          }

          for (; idx < tokens.length; idx++) {
            const token = tokens[idx];
            const textRaw = token.text;
            const text = textRaw.toLowerCase();

            if (textRaw === ',') continue;

            // number literal
            if (/^[+-]?\d+(?:\.\d+)?$/.test(textRaw)) {
              lineTokens.push({ start: token.start, length: textRaw.length, type: tokenTypes.indexOf('number') });
              continue;
            }

            // identifier-like token
            if (/^[A-Za-z_][A-Za-z0-9_-]*/.test(textRaw)) {
              let type = -1;

              if (workspaceSymbols.macros.some(m => m.toLowerCase() === text)) {
                type = tokenTypes.indexOf('macro');
              } else if (workspaceSymbols.consts.some(c => c.name.toLowerCase() === text)) {
                // colorless
                continue;
              } else if (workspaceLabels.has(textRaw) || Array.from(workspaceLabels.keys()).some(k => k.toLowerCase() === text) || workspaceSymbols.labels.some(l => l.toLowerCase() === text)) {
                type = tokenTypes.indexOf('label');
              } else if (identifiersSet.has(textRaw) || Array.from(identifiersSet).some(i => i.toLowerCase() === text)) {
                type = tokenTypes.indexOf('variable');
              }

              if (type !== -1) {
                // Avoid pushing if already pushed (e.g. by jump detection)
                if (!lineTokens.some(lt => lt.start === token.start)) {
                    lineTokens.push({ start: token.start, length: textRaw.length, type: type });
                }
              }
            }
          }
        }

        lineTokens.sort((a, b) => a.start - b.start);
        for (const t of lineTokens) {
          builder.push(i, t.start, t.length, t.type, 0);
        }
      }

      return builder.build();
    }
  };

  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: 'fxscript' },
      provider,
      legend
    )
  );

  return {
    refresh: () => onDidChangeSemanticTokensEmitter.fire()
  };
}
