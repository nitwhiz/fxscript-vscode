import * as vscode from 'vscode';
import { FXScriptConfig, CommandSpec } from './types';
import { SymbolCache } from './symbols';
import { tokenize, Token, readFXScript } from './util';

export function registerValidation(context: vscode.ExtensionContext, _config: FXScriptConfig, symbolCache: SymbolCache) {
  const diagnostics = vscode.languages.createDiagnosticCollection('fxscript');
  context.subscriptions.push(diagnostics);

  function validateDocument(document: vscode.TextDocument) {
    const config = readFXScript(context);
    const fixedSpecMap = new Map<string, CommandSpec>();
    const allCommandsSet = new Set<string>();
    for (const c of config.commands || []) {
      allCommandsSet.add(c.name);
      if (Object.prototype.hasOwnProperty.call(c, 'args')) {
        fixedSpecMap.set(c.name, c);
      }
    }

    const diags: vscode.Diagnostic[] = [];
    const workspaceLabels = symbolCache.workspaceLabels;

    for (let i = 0; i < document.lineCount; i++) {
      const lineText = document.lineAt(i).text;
      const allTokens = tokenize(lineText);
      if (allTokens.length === 0) continue;

      // Group tokens by commas and spaces to handle multiple commands per line
      const commandGroups: Token[][] = [];
      let currentGroup: Token[] = [];

      for (let j = 0; j < allTokens.length; j++) {
        const token = allTokens[j];
        if (token.text === ',') {
          // Check for unnecessary commas
          const prevToken = j > 0 ? allTokens[j - 1] : undefined;
          const nextToken = allTokens[j + 1];

          // 1. Consecutive commas
          if (prevToken && prevToken.text === ',') {
            const range = new vscode.Range(i, token.start, i, token.end);
            diags.push(new vscode.Diagnostic(range, `Unnecessary comma.`, vscode.DiagnosticSeverity.Warning));
          }

          // 2. Comma at start of line (before any command)
          if (currentGroup.length === 0 && commandGroups.length === 0) {
            const range = new vscode.Range(i, token.start, i, token.end);
            diags.push(new vscode.Diagnostic(range, `Unnecessary comma.`, vscode.DiagnosticSeverity.Warning));
          }

          // 3. Comma at end of line
          if (!nextToken) {
            const range = new vscode.Range(i, token.start, i, token.end);
            diags.push(new vscode.Diagnostic(range, `Unnecessary comma.`, vscode.DiagnosticSeverity.Warning));
          }

          if (nextToken && (fixedSpecMap.has(nextToken.text) || nextToken.text === '@include' || nextToken.text === 'macro' || nextToken.text === 'const' || nextToken.text === 'endmacro') && currentGroup.length > 0) {
            commandGroups.push(currentGroup);
            currentGroup = [];
          } else {
            // It's an argument separator or just a comma in an expression (though unlikely)
            // We should keep it to separate arguments if it's NOT a command separator.
            currentGroup.push(token);
          }
        } else {
          currentGroup.push(token);
        }
      }
      if (currentGroup.length > 0) {
        commandGroups.push(currentGroup);
      }

      for (const tokens of commandGroups) {
        if (tokens.length === 0) continue;

        const firstToken = tokens[0];
        const cmdName = firstToken.text;

        // Check for label definition (only if it's the first token of the line)
        if (cmdName.endsWith(':') && firstToken.start === allTokens[0].start) {
          // It's a label definition. Validate label name if needed.
          continue;
        }

        // Check for directives
        if (cmdName === '@include') {
          continue;
        }

        // Check for macro/const definitions
        if (cmdName === 'macro' || cmdName === 'const' || cmdName === 'endmacro') {
          continue;
        }

        const spec = fixedSpecMap.get(cmdName);
        if (!spec) {
          // If it's not a known command, and not a label/directive/macro, it's an invalid command
          const range = new vscode.Range(i, firstToken.start, i, firstToken.end);
          if (symbolCache.symbols.macros.includes(cmdName)) {
            // Macros are valid in command positions
            continue;
          } else {
            diags.push(new vscode.Diagnostic(range, `Unknown command '${cmdName}'.`, vscode.DiagnosticSeverity.Error));
          }
          continue;
        }

        if (spec.args) {
          // Validate argument count for fixed-arity commands
          // Commands with variable args (args undefined in config) are skipped.
          const expectedCount = spec.args.length;
          const optionalCount = spec.args.filter(a => a.optional).length;
          const minCount = expectedCount - optionalCount;

          const argsTokens = tokens.slice(1);
          const args: Token[][] = [];

          const hasComma = argsTokens.some(t => t.text === ',');

          if (hasComma) {
            let currentArg: Token[] = [];
            for (const t of argsTokens) {
              if (t.text === ',') {
                if (currentArg.length > 0) {
                  args.push(currentArg);
                  currentArg = [];
                }
              } else {
                currentArg.push(t);
              }
            }
            if (currentArg.length > 0) {
              args.push(currentArg);
            }
          } else {
            // No commas. Try to split by spaces, but group operators with adjacent tokens
            let i = 0;
            const isOperator = (t: Token) => '-+*/%^()'.includes(t.text);

            while (i < argsTokens.length) {
              if (args.length < expectedCount - 1) {
                let currentArg: Token[] = [argsTokens[i]];
                let j = i + 1;
                while (j < argsTokens.length && (isOperator(argsTokens[j]) || isOperator(argsTokens[j - 1]))) {
                  currentArg.push(argsTokens[j]);
                  j++;
                }
                args.push(currentArg);
                i = j;
              } else {
                // This is the last expected argument, or we've already exceeded expectedCount
                // (though the latter shouldn't happen with this logic, we take the rest anyway)
                args.push(argsTokens.slice(i));
                break;
              }
            }
          }

          if (args.length < minCount || args.length > expectedCount) {
            const range = new vscode.Range(i, firstToken.start, i, tokens[tokens.length - 1].end);
            const msg = args.length < minCount
              ? `Command '${cmdName}' expects at least ${minCount} arguments, but got ${args.length}.`
              : `Command '${cmdName}' expects at most ${expectedCount} arguments, but got ${args.length}.`;
            diags.push(new vscode.Diagnostic(range, msg, vscode.DiagnosticSeverity.Error));
          }

          // Check if labels/consts used in arguments exist
          args.forEach((argTokens, idx) => {
            if (idx < spec.args!.length) {
              const argSpec = spec.args![idx];
              const argText = argTokens.map(t => t.text).join('').trim();
              const range = new vscode.Range(i, argTokens[0].start, i, argTokens[argTokens.length - 1].end);

              const isOperator = (t: Token) => '-+*/%^()'.includes(t.text);

              if (argSpec.type === 'label') {
                if (argTokens.length === 1) {
                  const labelName = argTokens[0].text;
                  if (!workspaceLabels.has(labelName) && !symbolCache.symbols.labels.includes(labelName)) {
                    let found = false;
                    for (let k = 0; k < document.lineCount; k++) {
                      if (document.lineAt(k).text.trim().startsWith(labelName + ':')) {
                        found = true;
                        break;
                      }
                    }
                    if (!found && !symbolCache.symbols.macros.includes(labelName)) {
                      diags.push(new vscode.Diagnostic(range, `Label or Macro '${labelName}' not found.`, vscode.DiagnosticSeverity.Warning));
                    }
                  }
                }
              } else if (argSpec.type === 'number' || argSpec.type === 'identifier') {
                // For number and identifier types, we now allow expressions.
                // We should validate individual tokens that look like identifiers.
                for (const token of argTokens) {
                  const text = token.text;
                  if (isOperator(token)) continue;
                  if (/^[+-]?\d+(?:\.\d+)?$/.test(text)) continue; // number literal
                  if (text.startsWith('"')) continue; // shouldn't really happen here but for safety

                  const isIdent = config.identifiers.includes(text);
                  const isNumConst = symbolCache.symbols.consts.some(c => c.name === text && c.type === 'number');

                  if (!isIdent && !isNumConst) {
                    diags.push(new vscode.Diagnostic(
                      new vscode.Range(i, token.start, i, token.end),
                      `Identifier '${text}' not found.`,
                      vscode.DiagnosticSeverity.Error
                    ));
                  }
                }
              } else if (argSpec.type === 'string') {
                const isStringConst = symbolCache.symbols.consts.some(c => c.name === argText && c.type === 'string');
                if (!argText.startsWith('"') && !isStringConst) {
                  diags.push(new vscode.Diagnostic(range, `String literal or String constant expected, but got '${argText}'.`, vscode.DiagnosticSeverity.Error));
                }
              }
            }
          });
        }
      }
    }
    diagnostics.set(document.uri, diags);
  }

  const triggerValidation = () => {
    vscode.workspace.textDocuments.forEach(doc => {
      if (doc.languageId === 'fxscript') validateDocument(doc);
    });
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('fxscript.triggerValidation', triggerValidation)
  );

  symbolCache.onRefresh(triggerValidation);

  // Hook up validation events
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(doc => {
      if (doc.languageId === 'fxscript') validateDocument(doc);
    }),
    vscode.workspace.onDidChangeTextDocument(evt => {
      if (evt.document.languageId === 'fxscript') validateDocument(evt.document);
    }),
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.languageId === 'fxscript') validateDocument(doc);
    })
  );

  // Initial validation for all open FXScript files
  vscode.workspace.textDocuments.forEach(doc => {
    if (doc.languageId === 'fxscript') validateDocument(doc);
  });
}
