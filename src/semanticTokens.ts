import * as vscode from 'vscode';
import { SymbolCache } from './symbols';
import { stripCommentAndMaskStrings, readFXScript, tokenize, Token } from './util';

const tokenTypes = ['class', 'variable', 'keyword', 'parameter', 'type', 'macro', 'function', 'constant', 'number', 'regexp'];
const tokenModifiers = ['declaration', 'documentation'];
export const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);

export function registerSemanticTokenProvider(context: vscode.ExtensionContext, symbolCache: SymbolCache) {
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: 'fxscript' },
      {
        provideDocumentSemanticTokens(document: vscode.TextDocument) {
          const config = readFXScript(context);
          const flagsSet = new Set(config.flags || []);
          const identifiersSet = new Set(config.identifiers || []);
          const variablesSet = new Set(config.variables || []);

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
            const commandGroups: { tokens: Token[], cmdName?: string }[] = [];
            let currentGroup: Token[] = [];

            for (let j = 0; j < allTokens.length; j++) {
              const token = allTokens[j];
              if (token.text === ',') {
                const nextToken = allTokens[j + 1];

                if (nextToken && (config.commands.some(c => c.name === nextToken.text) || nextToken.text === '@include' || nextToken.text === 'macro' || nextToken.text === 'const' || nextToken.text === 'endmacro' || workspaceSymbols.macros.includes(nextToken.text)) && currentGroup.length > 0) {
                  commandGroups.push({ tokens: currentGroup, cmdName: currentGroup[0].text });
                  currentGroup = [];
                } else {
                  currentGroup.push(token);
                }
              } else {
                currentGroup.push(token);
              }
            }
            if (currentGroup.length > 0) {
              commandGroups.push({ tokens: currentGroup, cmdName: currentGroup[0].text });
            }

            for (const group of commandGroups) {
              const tokens = group.tokens;
              if (tokens.length === 0) continue;

              const firstToken = tokens[0];
              const cmdName = firstToken.text;

              let idx = 0;
              // Check for label definition
              if (cmdName.endsWith(':') && firstToken.start === allTokens[0].start) {
                const labelName = cmdName.slice(0, -1);
                builder.push(i, firstToken.start, labelName.length, tokenTypes.indexOf('class'), 0);
                idx = 1;
              } else if (config.commands.some(c => c.name === cmdName) || ['call', 'goto', 'ret', '@include', 'macro', 'const', 'endmacro'].includes(cmdName) || workspaceSymbols.macros.includes(cmdName)) {
                let cmdType = tokenTypes.indexOf('function');
                if (['call', 'goto', 'ret', '@include', 'macro', 'const', 'endmacro'].includes(cmdName)) {
                  cmdType = tokenTypes.indexOf('keyword');
                } else if (workspaceSymbols.macros.includes(cmdName)) {
                  cmdType = tokenTypes.indexOf('macro');
                }
                builder.push(i, firstToken.start, cmdName.length, cmdType, 0);
                idx = 1;
              }

              for (; idx < tokens.length; idx++) {
                const token = tokens[idx];
                const text = token.text;

                if (text === ',') continue;

                // number literal
                if (/^[+-]?\d+(?:\.\d+)?$/.test(text)) {
                  builder.push(i, token.start, text.length, tokenTypes.indexOf('number'), 0);
                  continue;
                }

                // identifier-like token
                if (/^[A-Za-z_][A-Za-z0-9_-]*/.test(text)) {
                  let type = -1;

                  if (flagsSet.has(text)) {
                    type = tokenTypes.indexOf('regexp');
                  } else if (identifiersSet.has(text) || variablesSet.has(text)) {
                    type = tokenTypes.indexOf('variable');
                  } else if (workspaceSymbols.macros.includes(text)) {
                    type = tokenTypes.indexOf('macro');
                  } else if (workspaceLabels.has(text) || workspaceSymbols.labels.includes(text)) {
                    type = tokenTypes.indexOf('class');
                  } else if (workspaceSymbols.consts.some(c => c.name === text)) {
                    type = tokenTypes.indexOf('constant');
                  }

                  if (type !== -1) {
                    builder.push(i, token.start, text.length, type, 0);
                  }
                }
              }
            }
          }

          return builder.build();
        }
      },
      legend
    )
  );
}
