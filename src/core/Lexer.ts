import { getBuiltInCommandNames } from './BuiltInCommands';

export enum TokenType {
  COMMENT,
  DIRECTIVE,
  KEYWORD,
  IDENTIFIER,
  LABEL,
  LOCAL_LABEL,
  STRING,
  NUMBER,
  OPERATOR,
  COMMA,
  COLON,
  LPAREN,
  RPAREN,
  WHITESPACE,
  NEWLINE,
  EOF,
  UNKNOWN
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  character: number;
  length: number;
}

export class Lexer {
  private input: string;
  private pos: number = 0;
  private line: number = 0;
  private character: number = 0;

  constructor(input: string) {
    this.input = input;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    let token: Token;
    do {
      token = this.nextToken();
      if (token.type !== TokenType.WHITESPACE) {
        tokens.push(token);
      }
    } while (token.type !== TokenType.EOF);
    return tokens;
  }

  private nextToken(): Token {
    this.skipWhitespace();

    if (this.pos >= this.input.length) {
      return this.createToken(TokenType.EOF, "");
    }

    const char = this.peek();

    if (char === '\n') {
      this.advance();
      return this.createToken(TokenType.NEWLINE, "\n");
    }

    if (char === '#') {
      return this.readComment();
    }

    if (char === '@') {
      return this.readDirective();
    }

    if (char === '"') {
      return this.readString();
    }

    if (char === '%') {
      // Modulo operator or local label?
      // Local label is followed by '_' or alpha
      const next = this.peek(1);
      if (next === '_' || this.isAlpha(next)) {
        return this.readLocalLabel();
      }
      return this.consumeToken(TokenType.OPERATOR, "%");
    }

    if (char === '-') {
      // Hyphen can be part of a label or local label if it looks like one
      // If we are at the start of a word that contains hyphens and ends with a colon, it's a label.
      // But Lexer handles identifiers/labels/local labels in their own methods.
      // A standalone '-' is an operator.
      return this.readOperator();
    }

    if (char === ',') {
      return this.consumeToken(TokenType.COMMA, ",");
    }

    if (char === ':') {
      return this.consumeToken(TokenType.COLON, ":");
    }

    if (char === '(') {
      return this.consumeToken(TokenType.LPAREN, "(");
    }

    if (char === ')') {
      return this.consumeToken(TokenType.RPAREN, ")");
    }

    if (this.isDigit(char)) {
      return this.readNumber();
    }

    if (this.isOperator(char)) {
      return this.readOperator();
    }

    if (this.isAlpha(char)) {
      return this.readIdentifierOrKeyword();
    }

    const unknown = this.advance();
    return this.createToken(TokenType.UNKNOWN, unknown);
  }

  private skipWhitespace() {
    while (this.pos < this.input.length && (this.peek() === ' ' || this.peek() === '\t' || this.peek() === '\r')) {
      this.advance();
    }
  }

  private readComment(): Token {
    let value = "";
    while (this.pos < this.input.length && this.peek() !== '\n') {
      value += this.advance();
    }
    return this.createToken(TokenType.COMMENT, value);
  }

  private readDirective(): Token {
    let value = this.advance(); // @
    while (this.pos < this.input.length && this.isAlpha(this.peek())) {
      value += this.advance();
    }

    if (value === "@def" || value === "@include") {
      this.skipWhitespace();
      while (this.pos < this.input.length && this.peek() !== '\n' && this.peek() !== '#') {
        value += this.advance();
      }
    }

    return this.createToken(TokenType.DIRECTIVE, value);
  }

  private readString(): Token {
    this.advance(); // "
    let value = "";
    while (this.pos < this.input.length && this.peek() !== '"') {
      if (this.peek() === '\\') {
        this.advance();
      }
      value += this.advance();
    }
    this.advance(); // "
    return this.createToken(TokenType.STRING, value);
  }

  private readLocalLabel(): Token {
    let value = this.advance(); // %
    if (this.peek() === '_') {
      value += this.advance();
    }
    while (this.pos < this.input.length && (this.isAlphaNumeric(this.peek()) || this.peek() === '-')) {
      const char = this.peek();
      if (char === '-') {
        // Allow hyphen in local labels if it's followed by alphanumeric (could be reference or definition)
        const next = this.peek(1);
        if (!this.isAlphaNumeric(next)) {
            break;
        }
      }
      value += this.advance();
    }

    if (this.peek() === ':') {
      value += this.advance();
      return this.createToken(TokenType.LOCAL_LABEL, value);
    }

    return this.createToken(TokenType.LOCAL_LABEL, value);
  }

  private readNumber(): Token {
    let value = "";
    if (this.peek() === '0' && this.peek(1) === 'x') {
      value += this.advance();
      value += this.advance();
      while (this.pos < this.input.length && this.isHexDigit(this.peek())) {
        value += this.advance();
      }
    } else {
      while (this.pos < this.input.length && this.isDigit(this.peek())) {
        value += this.advance();
      }
    }
    return this.createToken(TokenType.NUMBER, value);
  }

  private readIdentifierOrKeyword(): Token {
    let value = "";
    while (this.pos < this.input.length && (this.isAlphaNumeric(this.peek()) || this.peek() === '-')) {
      const char = this.peek();
      if (char === '-') {
        // Allow hyphen in identifiers/labels if it's followed by alphanumeric
        const next = this.peek(1);
        if (!this.isAlphaNumeric(next)) {
            break;
        }
      }
      value += this.advance();
    }

    if (this.peek() === ':' && (this.pos === 0 || !this.isWhitespace(this.input[this.pos - 1]))) {
      value += this.advance();
      return this.createToken(TokenType.LABEL, value);
    }

    const keywords = ["var", "def", "macro", "endmacro", ...getBuiltInCommandNames()];
    if (keywords.includes(value)) {
      return this.createToken(TokenType.KEYWORD, value);
    }

    return this.createToken(TokenType.IDENTIFIER, value);
  }

  private readOperator(): Token {
    let value = this.advance();
    const nextChar = this.peek();
    const combined = value + nextChar;
    const operators2 = ["<<", ">>", "==", "!=", "<=", ">="];
    if (operators2.includes(combined)) {
      value += this.advance();
    }
    return this.createToken(TokenType.OPERATOR, value);
  }

  private consumeToken(type: TokenType, value: string): Token {
    const startChar = this.character;
    const startLine = this.line;
    this.advance();
    return { type, value, line: startLine, character: startChar, length: value.length };
  }

  private createToken(type: TokenType, value: string): Token {
    let tokenLine = this.line;
    let tokenChar = this.character - value.length;

    if (type === TokenType.EOF) {
        tokenChar = this.character;
    } else if (type === TokenType.NEWLINE) {
        tokenLine--; // Newline was already advanced
    }

    return { type, value, line: tokenLine, character: tokenChar, length: value.length };
  }

  private peek(offset: number = 0): string {
    if (this.pos + offset >= this.input.length) return "";
    return this.input[this.pos + offset];
  }

  private advance(): string {
    const char = this.input[this.pos++];
    if (char === '\n') {
      this.line++;
      this.character = 0;
    } else {
      this.character++;
    }
    return char;
  }

  private isWhitespace(char: string): boolean {
    return char === ' ' || char === '\t' || char === '\r' || char === '\n';
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isHexDigit(char: string): boolean {
    return this.isDigit(char) || (char >= 'a' && char <= 'f') || (char >= 'A' && char <= 'F');
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_' || char === '$';
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || (char >= '0' && char <= '9');
  }

  private isOperator(char: string): boolean {
    return "+-*/&|^~<>!=!()".includes(char);
  }
}
