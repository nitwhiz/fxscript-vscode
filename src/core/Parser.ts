import * as vscode from 'vscode';
import { Token, TokenType } from './Lexer';
import { SymbolTable, SymbolType } from './SymbolTable';

export class Parser {
  private tokens: Token[] = [];
  private pos: number = 0;
  private uri: vscode.Uri;
  private symbolTable: SymbolTable;
  private commandRegistry?: any;
  private currentMacroName: string | undefined;
  private currentMacroArgs: Set<string> = new Set();
  private diagnostics: vscode.Diagnostic[] = [];
  private lastComment: string | undefined;

  private lastGlobalLabel: string = "";

  constructor(uri: vscode.Uri, tokens: Token[], symbolTable: SymbolTable, commandRegistry?: any) {
    this.uri = uri;
    this.tokens = tokens;
    this.symbolTable = symbolTable;
    this.commandRegistry = commandRegistry;
  }

  public getDiagnostics(): vscode.Diagnostic[] {
    return this.diagnostics;
  }

  private isBuiltInCommand(name: string): boolean {
    const builtIn = ["set", "goto", "call", "ret", "jumpIf"];
    return builtIn.includes(name);
  }

  public parseSymbols() {
    while (this.pos < this.tokens.length) {
      const token = this.peek();

      if (token.type === TokenType.KEYWORD) {
          if (token.value === 'var') {
            this.parseVar();
          } else if (token.value === 'const') {
            this.parseConst();
          } else if (token.value === 'macro') {
            this.parseMacro();
            this.lastComment = undefined;
          } else if (token.value === 'endmacro') {
            this.advance();
            this.lastComment = undefined;
          } else {
            // It's a command like set, goto, etc.
            const commandToken = this.advance();
            this.parseCommandArguments(commandToken.value);
            this.lastComment = undefined;
          }
        } else if (token.type === TokenType.LABEL) {
        this.parseLabel();
        this.lastComment = undefined;
      } else if (token.type === TokenType.LOCAL_LABEL) {
        this.parseLocalLabel();
        this.lastComment = undefined;
      } else if (token.type === TokenType.COMMENT) {
        const commentValue = token.value.substring(1).trim();
        this.lastComment = this.lastComment ? `${this.lastComment}\n${commentValue}` : commentValue;
        this.parseSpecialConst();
      } else if (token.type === TokenType.DIRECTIVE && token.value.startsWith('@const')) {
        this.parseSpecialConstDirectly();
        this.lastComment = undefined;
      } else if (token.type === TokenType.DIRECTIVE && token.value.startsWith('@include')) {
          this.advance(); // Just consume it for now
          this.lastComment = undefined;
        } else if (token.type as any === TokenType.IDENTIFIER || token.type as any === TokenType.LABEL || token.type as any === TokenType.KEYWORD) {
          // Potential macro call or command
          let name = token.value;
          if (name.endsWith(':')) {
              name = name.slice(0, -1);
          }

          const currentToken = this.advance();
          // Determine if it's a macro or a command
          const isCommand = this.commandRegistry?.getCommand(name) || this.isBuiltInCommand(name);

          this.symbolTable.addReference({
            name: name,
            uri: this.uri,
            range: this.tokenToRange(currentToken),
            expectedType: isCommand ? undefined : SymbolType.MACRO
          });

          this.parseCommandArguments(name);
          this.lastComment = undefined;
        } else if (token.type === TokenType.NEWLINE) {
        this.advance();
      } else if (token.type === TokenType.EOF) {
        break;
      } else {
        this.diagnostics.push(new vscode.Diagnostic(
          this.tokenToRange(token),
          `Unexpected token ${TokenType[token.type]} at start of line`,
          vscode.DiagnosticSeverity.Error
        ));
        this.advance();
      }
    }
  }

  private parseCommandArguments(commandName?: string) {
    const command = commandName ? this.commandRegistry?.getCommand(commandName) : undefined;
    let argIndex = 0;
    let hasArgs = false;

    // Use a default range in case we can't find a better one
    let range = new vscode.Range(0, 0, 0, 0);

    // Look back for the command token to get its range for diagnostics
    // We assume the caller just advanced past the command name
    if (this.pos > 0) {
      const commandToken = this.tokens[this.pos - 1];
      range = this.tokenToRange(commandToken);
    }

    while (this.pos < this.tokens.length) {
      const token = this.peek();
      if (token.type === TokenType.NEWLINE || token.type === TokenType.EOF) {
        break;
      }

      hasArgs = true;

      if (token.type === TokenType.COMMA) {
        this.advance();
        argIndex++;
        continue;
      }

      this.parseExpression(command, argIndex);
    }

    const actualArgCount = hasArgs ? argIndex + 1 : 0;
    let expectedArgCount = 0;

    if (commandName) {
      if (command) {
        expectedArgCount = command.args?.length || 0;
      } else if (this.isBuiltInCommand(commandName)) {
        switch (commandName) {
          case 'set':
            expectedArgCount = 2;
            break;
          case 'goto':
          case 'call':
            expectedArgCount = 1;
            break;
          case 'jumpIf':
            expectedArgCount = 2;
            break;
          case 'ret':
            expectedArgCount = 0;
            break;
        }
      } else {
        // Check if it's a macro
        const symbols = this.symbolTable.getSymbols(commandName);
        const macroDef = symbols.find(s => s.type === SymbolType.MACRO);
        if (macroDef && macroDef.argCount !== undefined) {
          expectedArgCount = macroDef.argCount;
        }
      }
    }

    if (actualArgCount < expectedArgCount) {
      const isMacro = !command && !this.isBuiltInCommand(commandName || "");
      const typeStr = isMacro ? 'Macro' : 'Command';
      this.diagnostics.push(new vscode.Diagnostic(
        range,
        `${typeStr} '${commandName}' expects ${expectedArgCount} arguments, but got ${actualArgCount}.`,
        vscode.DiagnosticSeverity.Error
      ));
    }
  }

  private isOperator(type: TokenType, value?: string): boolean {
    if (type === TokenType.OPERATOR) {
        return true;
    }
    if (type === TokenType.IDENTIFIER || type === TokenType.LABEL || type === TokenType.LOCAL_LABEL) {
        const ops = ["+", "-", "*", "/", "&", "|", "^", "~", "<<", ">>", "==", "!=", "<", ">", "<=", ">=", "!", "&&", "||"];
        if (value && ops.includes(value)) {
            return true;
        }
    }
    return false;
  }

  private parseExpression(command?: any, argIndex?: number) {
    // Basic expression parser that consumes tokens until a comma or newline/EOF
    // and records references
    let parenCount = 0;
    let lastTokenWasOperator = false;

    // Expected type based on command definition
    let expectedSymbolType: SymbolType | undefined;
    if (command && command.args && argIndex !== undefined && argIndex < command.args.length) {
      const argDef = command.args[argIndex] as any;
      const argType = Object.values(argDef)[0] ? (Object.values(argDef)[0] as any).type : undefined;
      if (argType === 'label') {
        expectedSymbolType = SymbolType.LABEL;
      } else if (argType === 'identifier') {
        expectedSymbolType = SymbolType.VARIABLE; // Or CONSTANT, usually interchangeable in expressions
      }
    }

    while (this.pos < this.tokens.length) {
      const token = this.peek();
      if (token.type === TokenType.NEWLINE || token.type === TokenType.EOF) {
        break;
      }
      if (token.type === TokenType.COMMA && parenCount === 0) {
        break;
      }

      const currentTokenPos = this.pos;

      if (token.type === TokenType.LPAREN) {
        parenCount++;
        this.advance();
        lastTokenWasOperator = false;
      } else if (token.type === TokenType.RPAREN) {
        parenCount--;
        if (parenCount < 0) {
          this.diagnostics.push(new vscode.Diagnostic(
            this.tokenToRange(token),
            `Unexpected closing parenthesis`,
            vscode.DiagnosticSeverity.Error
          ));
          parenCount = 0;
        }
        this.advance();
        lastTokenWasOperator = false;
      } else if (token.type === TokenType.IDENTIFIER || token.type === TokenType.LABEL || token.type === TokenType.NUMBER || token.type === TokenType.LOCAL_LABEL) {
        if (token.type === TokenType.IDENTIFIER || token.type === TokenType.LABEL) {
            let name = token.value;
            if (name.endsWith(':')) {
                name = name.slice(0, -1);
            }
            
            // Check if it is an operator masquerading as an identifier
            if (this.isOperator(token.type, name)) {
                this.advance();
                lastTokenWasOperator = true;
                if (name === "!" || name === "~") {
                    lastTokenWasOperator = true;
                }
                continue;
            }

            if (!this.currentMacroArgs.has(name)) {
                const isCommand = this.commandRegistry?.getCommand(name) || this.isBuiltInCommand(name);
                const isIdentifier = this.commandRegistry?.hasIdentifier(name);
                const isMacro = this.symbolTable.getSymbols(name).some(s => s.type === SymbolType.MACRO);

                if (!isIdentifier && !isMacro) {
                    this.symbolTable.addReference({
                        name: name,
                        uri: this.uri,
                        range: this.tokenToRange(token),
                        expectedType: isCommand ? undefined : expectedSymbolType
                    });
                } else if (isMacro) {
                    // It's a macro being used in an expression/argument
                    this.diagnostics.push(new vscode.Diagnostic(
                        this.tokenToRange(token),
                        `Macro '${name}' cannot be used as an argument`,
                        vscode.DiagnosticSeverity.Error
                    ));
                }
            }
        } else if (token.type === TokenType.LOCAL_LABEL) {
            const name = token.value.endsWith(':') ? token.value.slice(0, -1) : token.value;
            const prefix = this.currentMacroName || this.lastGlobalLabel;
            const fullName = prefix ? `${prefix}${name}` : name;
            this.symbolTable.addReference({
                name: fullName,
                uri: this.uri,
                range: this.tokenToRange(token),
                expectedType: SymbolType.LABEL
            });
        }
        this.advance();
        lastTokenWasOperator = false;
      } else if (this.isOperator(token.type, token.value)) {
        const opToken = this.advance();
        lastTokenWasOperator = true;

        // Unary operators don't need a preceding operand
        if (opToken.value === "!" || opToken.value === "~") {
            lastTokenWasOperator = true; // Still expecting something after it
        }
      } else {
        this.advance();
      }

      if (currentTokenPos === this.pos) {
          this.advance(); // Safety break
      }
    }

    if (parenCount > 0) {
      this.diagnostics.push(new vscode.Diagnostic(
        this.tokenToRange(this.tokens[this.pos - 1]),
        `Missing ${parenCount} closing parenthesis`,
        vscode.DiagnosticSeverity.Error
      ));
    }

    if (lastTokenWasOperator) {
        this.diagnostics.push(new vscode.Diagnostic(
            this.tokenToRange(this.tokens[this.pos - 1]),
            `Incomplete expression: expected operand at end of expression`,
            vscode.DiagnosticSeverity.Error
        ));
    }
  }

  private parseVar() {
    this.advance(); // var
    const nameToken = this.consume(TokenType.IDENTIFIER);
    if (nameToken) {
      const existing = this.symbolTable.getSymbols(nameToken.value);
      if (existing.some(s => s.uri.toString() === this.uri.toString())) {
          this.diagnostics.push(new vscode.Diagnostic(
              this.tokenToRange(nameToken),
              `Variable '${nameToken.value}' is already declared in this file`,
              vscode.DiagnosticSeverity.Error
          ));
      }

      this.symbolTable.addSymbol({
        name: nameToken.value,
        type: SymbolType.VARIABLE,
        uri: this.uri,
        range: this.tokenToRange(nameToken),
        documentation: this.lastComment
      });
    }
    this.lastComment = undefined;
  }

  private parseConst() {
    this.advance(); // const
    const nameToken = this.consume(TokenType.IDENTIFIER);
    if (nameToken) {
      this.symbolTable.addSymbol({
        name: nameToken.value,
        type: SymbolType.CONSTANT,
        uri: this.uri,
        range: this.tokenToRange(nameToken),
        documentation: this.lastComment
      });
      // Parse the expression to find references
      this.parseExpression();
    }
    this.lastComment = undefined;
  }

  private parseMacro() {
    this.advance(); // macro
    const nameToken = this.consume(TokenType.IDENTIFIER);
    if (nameToken) {
      const macroName = nameToken.value;
      const startLine = nameToken.line;
      this.currentMacroName = macroName;
      this.currentMacroArgs.clear();

      let argCount = 0;
      // Macros can have arguments on the same line
      let tempPos = this.pos;
      while (tempPos < this.tokens.length) {
        const token = this.tokens[tempPos];
        if (token.type === TokenType.NEWLINE || token.type === TokenType.EOF) {
          break;
        }
        if (token.type === TokenType.IDENTIFIER && token.value.startsWith('$')) {
          argCount++;
        }
        tempPos++;
      }

      this.symbolTable.addSymbol({
        name: macroName,
        type: SymbolType.MACRO,
        uri: this.uri,
        range: this.tokenToRange(nameToken),
        argCount: argCount,
        documentation: this.lastComment
      });

      // Macros can have arguments on the same line
      while (this.pos < this.tokens.length) {
        const token = this.peek();
        if (token.type === TokenType.NEWLINE || token.type === TokenType.EOF) {
          break;
        }
        if (token.type === TokenType.IDENTIFIER && token.value.startsWith('$')) {
          this.currentMacroArgs.add(token.value);
          this.advance();
        } else if (token.type === TokenType.COMMA) {
          this.advance();
        } else {
          // Fallback or other tokens
          this.advance();
        }
      }

      // Parse until endmacro, handle local labels within
      while (this.pos < this.tokens.length) {
        const t = this.peek();
        if (t.type === TokenType.KEYWORD) {
          if (t.value === 'endmacro') {
            // Update the macro symbol with its full scope
            const endMacroToken = this.advance();
            const macroSymbols = this.symbolTable.getSymbols(macroName);
            const macroDef = macroSymbols.find(s => s.uri.toString() === this.uri.toString() && s.range.start.line === startLine);
            if (macroDef) {
              macroDef.scopeRange = new vscode.Range(
                new vscode.Position(startLine, nameToken.character),
                new vscode.Position(endMacroToken.line, endMacroToken.character + endMacroToken.length)
              );
            }
            break;
          } else if (t.value === 'var') {
            this.parseVar();
          } else if (t.value === 'const') {
            this.parseConst();
          } else {
            const currentToken = this.advance();
            const isCommand = this.commandRegistry?.getCommand(t.value) || this.isBuiltInCommand(t.value);
            
            if (!this.currentMacroArgs.has(t.value)) {
              this.symbolTable.addReference({
                name: t.value,
                uri: this.uri,
                range: this.tokenToRange(currentToken),
                expectedType: isCommand ? undefined : SymbolType.MACRO
              });
            }
            this.parseCommandArguments(t.value);
          }
        } else if (t.type === TokenType.LOCAL_LABEL) {
          const name = t.value.endsWith(':') ? t.value.slice(0, -1) : t.value;
          const fullName = `${macroName}${name}`;
          if (t.value.endsWith(':')) {
            this.symbolTable.addSymbol({
              name: fullName,
              type: SymbolType.LABEL,
              uri: this.uri,
              range: this.tokenToRange(t),
              localName: name,
              documentation: this.lastComment
            });
            this.lastComment = undefined;
          } else {
            this.symbolTable.addReference({
              name: fullName,
              uri: this.uri,
              range: this.tokenToRange(t),
              expectedType: SymbolType.LABEL
            });
            this.lastComment = undefined;
          }
          this.advance();
          // Resetting lastGlobalLabel to avoid carrying it over into the macro if not needed
          // though inside macro it shouldn't matter as currentMacroName takes precedence.
        } else if (t.type === TokenType.IDENTIFIER || t.type === TokenType.LABEL) {
          let name = t.value;
          if (name.endsWith(':')) {
            name = name.slice(0, -1);
            this.symbolTable.addSymbol({
              name: name,
              type: SymbolType.LABEL,
              uri: this.uri,
              range: this.tokenToRange(t),
              documentation: this.lastComment
            });
            this.lastGlobalLabel = name;
            this.lastComment = undefined;
            this.advance();
            this.parseCommandArguments();
          } else {
            const currentToken = this.advance();
            const isCommand = this.commandRegistry?.getCommand(name) || this.isBuiltInCommand(name);
            
            if (!this.currentMacroArgs.has(name)) {
                this.symbolTable.addReference({
                  name: name,
                  uri: this.uri,
                  range: this.tokenToRange(currentToken),
                  expectedType: isCommand ? undefined : SymbolType.MACRO
                });
            }
            this.parseCommandArguments(name);
            this.lastComment = undefined;
          }
        } else if (t.type === TokenType.DIRECTIVE && t.value.startsWith('@include')) {
          this.advance();
          this.lastComment = undefined;
        } else if (t.type === TokenType.NEWLINE) {
          this.advance();
        } else if (t.type === TokenType.COMMENT) {
          const commentValue = t.value.substring(1).trim();
          this.lastComment = this.lastComment ? `${this.lastComment}\n${commentValue}` : commentValue;
          this.advance();
        } else {
          this.diagnostics.push(new vscode.Diagnostic(
            this.tokenToRange(t),
            `Unexpected token ${TokenType[t.type]} at start of line`,
            vscode.DiagnosticSeverity.Error
          ));
          this.advance();
          this.lastComment = undefined;
        }
      }
      this.currentMacroName = undefined;
      this.currentMacroArgs.clear();
    }
  }

  private parseLabel() {
    const token = this.advance();
    let name = token.value.endsWith(':') ? token.value.slice(0, -1) : token.value;

    const existing = this.symbolTable.getSymbols(name);
    if (existing.some(s => s.uri.toString() === this.uri.toString() && s.type === SymbolType.LABEL)) {
        this.diagnostics.push(new vscode.Diagnostic(
            this.tokenToRange(token),
            `Label '${name}' is already defined in this file`,
            vscode.DiagnosticSeverity.Error
        ));
    }

    this.lastGlobalLabel = name;

    this.symbolTable.addSymbol({
      name: name,
      type: SymbolType.LABEL,
      uri: this.uri,
      range: this.tokenToRange(token),
      documentation: this.lastComment
    });

    // Check for references on the same line (unlikely for a label definition, but keep it consistent)
    this.parseCommandArguments();
  }

  private parseLocalLabel() {
    const token = this.advance();
    const name = token.value.endsWith(':') ? token.value.slice(0, -1) : token.value;
    const prefix = this.currentMacroName || this.lastGlobalLabel;
    const fullName = prefix ? `${prefix}${name}` : name;
    if (token.value.endsWith(':')) {
        this.symbolTable.addSymbol({
            name: fullName,
            type: SymbolType.LABEL,
            uri: this.uri,
            range: this.tokenToRange(token),
            localName: name,
            documentation: this.lastComment
        });
    } else {
        this.symbolTable.addReference({
            name: fullName,
            uri: this.uri,
            range: this.tokenToRange(token),
            expectedType: SymbolType.LABEL
        });
    }

    // Check for references on the same line
    this.parseCommandArguments();
  }

  private parseSpecialConst() {
    const commentToken = this.advance();

    // Skip newlines between comment and directive
    while (this.pos < this.tokens.length && this.peek().type === TokenType.NEWLINE) {
      this.advance();
    }

    const nextToken = this.peek();
    if (nextToken && nextToken.type === TokenType.DIRECTIVE && nextToken.value.startsWith('@const')) {
        const commentParts = commentToken.value.substring(1).trim().split(/\s+/);
        if (commentParts.length > 0) {
            const runtimeName = commentParts[0];
            const directiveValue = nextToken.value.substring(6).trim(); // Skip "@const"

            // Add the directive value as a symbol (so we can find it)
            this.symbolTable.addSymbol({
                name: directiveValue,
                type: SymbolType.CONSTANT,
                uri: this.uri,
                range: this.tokenToRange(nextToken),
                documentation: `const ${runtimeName}`
            });

            // Add the runtime name as a symbol as well
            this.symbolTable.addSymbol({
                name: runtimeName,
                type: SymbolType.CONSTANT,
                uri: this.uri,
                range: this.tokenToRange(nextToken),
                documentation: `Lookup for ${directiveValue}`
            });

            this.advance(); // consume @const
        }
    }
  }

  private parseSpecialConstDirectly() {
    const token = this.advance();
    const name = token.value.substring(6).trim();
    this.symbolTable.addSymbol({
        name: name,
        type: SymbolType.CONSTANT,
        uri: this.uri,
        range: this.tokenToRange(token)
    });
  }


  private tokenToRange(token: Token): vscode.Range {
    return new vscode.Range(token.line, token.character, token.line, token.character + token.length);
  }

  private peek(): Token {
    return this.tokens[this.pos] || { type: TokenType.EOF, value: "", line: 0, character: 0, length: 0 };
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private consume(type: TokenType): Token | undefined {
    const t = this.peek();
    if (t.type === type) {
      return this.advance();
    }

    // Add diagnostic for unexpected token
    if (t.type !== TokenType.EOF) {
        this.diagnostics.push(new vscode.Diagnostic(
            this.tokenToRange(t),
            `Expected ${TokenType[type]} but found ${TokenType[t.type]}`,
            vscode.DiagnosticSeverity.Error
        ));
    }

    return undefined;
  }
}
