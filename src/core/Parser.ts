import * as vscode from 'vscode';
import { Token, TokenType } from './Lexer';
import { SymbolTable, SymbolType } from './SymbolTable';

export class Parser {
  private tokens: Token[] = [];
  private pos: number = 0;
  private uri: vscode.Uri;
  private symbolTable: SymbolTable;
  private lastGlobalLabel: string = "";
  private diagnostics: vscode.Diagnostic[] = [];

  constructor(uri: vscode.Uri, tokens: Token[], symbolTable: SymbolTable) {
    this.uri = uri;
    this.tokens = tokens;
    this.symbolTable = symbolTable;
  }

  public getDiagnostics(): vscode.Diagnostic[] {
    return this.diagnostics;
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
        } else {
          // It's a command like set, goto, etc.
          this.advance();
          this.parseCommandArguments();
        }
      } else if (token.type === TokenType.LABEL) {
        this.parseLabel();
      } else if (token.type === TokenType.LOCAL_LABEL) {
        this.parseLocalLabel();
      } else if (token.type === TokenType.COMMENT) {
        this.parseSpecialConst();
      } else if (token.type === TokenType.DIRECTIVE && token.value.startsWith('@const')) {
        this.parseSpecialConstDirectly();
      } else if (token.type === (TokenType.IDENTIFIER as any) || token.type === (TokenType.LABEL as any)) {
        // Potential macro call or command
        let name = token.value;
        if (name.endsWith(':')) {
            name = name.slice(0, -1);
        }
        
        // Check if it's a known command or if it's followed by arguments on the same line
        const currentToken = this.advance();
        this.symbolTable.addReference({
          name: name,
          uri: this.uri,
          range: this.tokenToRange(currentToken)
        });
        this.parseCommandArguments();
      } else {
        this.advance();
      }
    }
  }

  private parseCommandArguments() {
    // Arguments are separated by commas and can be expressions.
    // We mainly care about identifiers and local labels used as arguments.
    while (this.pos < this.tokens.length) {
      const token = this.peek();
      if (token.type === TokenType.NEWLINE || token.type === TokenType.EOF) {
        // Only advance the position if it's a newline, so parseSymbols can see it too
        // Wait, if we advance it here, parseSymbols will see the next token.
        // Actually, parseSymbols also handles unknown tokens by advancing.
        // It's better to NOT advance NEWLINE here so it acts as a delimiter for the command line.
        break;
      }

      if (token.type === (TokenType.IDENTIFIER as any) || token.type === (TokenType.LABEL as any)) {
        let name = token.value;
        if (name.endsWith(':')) {
            name = name.slice(0, -1);
        }
        this.symbolTable.addReference({
          name: name,
          uri: this.uri,
          range: this.tokenToRange(token)
        });
        this.advance();
      } else if (token.type === TokenType.LOCAL_LABEL) {
        const name = token.value.endsWith(':') ? token.value.slice(0, -1) : token.value;
        const fullName = this.lastGlobalLabel ? `${this.lastGlobalLabel}${name}` : name;
        this.symbolTable.addReference({
          name: fullName,
          uri: this.uri,
          range: this.tokenToRange(token)
        });
        this.advance();
      } else {
        this.advance();
      }
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
        range: this.tokenToRange(nameToken)
      });
    }
  }

  private parseConst() {
    this.advance(); // const
    const nameToken = this.consume(TokenType.IDENTIFIER);
    if (nameToken) {
      this.symbolTable.addSymbol({
        name: nameToken.value,
        type: SymbolType.CONSTANT,
        uri: this.uri,
        range: this.tokenToRange(nameToken)
      });
      // Parse the expression to find references
      this.parseCommandArguments();
    }
  }

  private parseMacro() {
    this.advance(); // macro
    const nameToken = this.consume(TokenType.IDENTIFIER);
    if (nameToken) {
      const macroName = nameToken.value;
      const startLine = nameToken.line;
      
      this.symbolTable.addSymbol({
        name: macroName,
        type: SymbolType.MACRO,
        uri: this.uri,
        range: this.tokenToRange(nameToken)
      });
      
      // Macros can have arguments on the same line
      this.parseCommandArguments();

      // Parse until endmacro, handle local labels within
      while (this.pos < this.tokens.length) {
        const t = this.peek();
        if (t.type === TokenType.KEYWORD && t.value === 'endmacro') {
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
        }
        if (t.type === TokenType.LOCAL_LABEL) {
          const name = t.value.endsWith(':') ? t.value.slice(0, -1) : t.value;
          const fullName = `${macroName}${name}`;
          if (t.value.endsWith(':')) {
            this.symbolTable.addSymbol({
              name: fullName,
              type: SymbolType.LABEL,
              uri: this.uri,
              range: this.tokenToRange(t),
              localName: name
            });
          } else {
            this.symbolTable.addReference({
              name: fullName,
              uri: this.uri,
              range: this.tokenToRange(t)
            });
          }
          this.advance();
        } else if (t.type === (TokenType.IDENTIFIER as any) || t.type === (TokenType.LABEL as any)) {
          let name = t.value;
          if (name.endsWith(':')) {
            name = name.slice(0, -1);
          }
          const currentToken = this.advance();
          this.symbolTable.addReference({
            name: name,
            uri: this.uri,
            range: this.tokenToRange(currentToken)
          });
          this.parseCommandArguments();
        } else {
          this.advance();
        }
      }
    }
  }

  private parseLabel() {
    const token = this.advance();
    const name = token.value.endsWith(':') ? token.value.slice(0, -1) : token.value;
    this.lastGlobalLabel = name;
    this.symbolTable.addSymbol({
      name: name,
      type: SymbolType.LABEL,
      uri: this.uri,
      range: this.tokenToRange(token)
    });
    
    // Check for references on the same line (unlikely for a label definition, but keep it consistent)
    this.parseCommandArguments();
  }

  private parseLocalLabel() {
    const token = this.advance();
    const name = token.value.endsWith(':') ? token.value.slice(0, -1) : token.value;
    const fullName = this.lastGlobalLabel ? `${this.lastGlobalLabel}${name}` : name;
    if (token.value.endsWith(':')) {
        this.symbolTable.addSymbol({
            name: fullName,
            type: SymbolType.LABEL,
            uri: this.uri,
            range: this.tokenToRange(token),
            localName: name
        });
    } else {
        this.symbolTable.addReference({
            name: fullName,
            uri: this.uri,
            range: this.tokenToRange(token)
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
