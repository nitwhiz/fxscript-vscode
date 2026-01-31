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
      return this.readLocalLabel();
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
    
    if (value === "@const" || value === "@include") {
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
    while (this.pos < this.input.length && this.isAlphaNumeric(this.peek())) {
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
    while (this.pos < this.input.length && (this.isAlphaNumeric(this.peek()))) {
      // If we encounter a '-', it could be an operator OR part of a label.
      // In FXScript, '-' is allowed in labels but also used as an operator.
      // We need to disambiguate.
      if (this.peek() === '-') {
        // Look ahead to see if it's a label definition or followed by characters that make it likely a label usage.
        let isLabelPart = false;
        
        // 1. Check if it's a label definition (colon later on same line)
        for (let i = 1; this.pos + i < this.input.length; i++) {
          const c = this.input[this.pos + i];
          if (c === '\n') break;
          if (c === ':') {
            isLabelPart = true;
            break;
          }
          if (this.isWhitespace(c) || this.isOperator(c) || c === ',' || c === '(' || c === ')') break;
        }

        // 2. If not a definition, check if it's a usage.
        // If it's followed by alpha-numeric characters AND NOT by a space or another operator,
        // we might consider it part of an identifier.
        // However, 'x-1' should be 'x', '-', '1'.
        // 'My-Label' followed by a comma or newline or space could be a label.
        
        if (!isLabelPart) {
          // If the next character is not a digit, and we have alpha chars after, it might be a label.
          // BUT, to be safe and match the user's "definition navigation still splits at '-'" complaint,
          // we should probably be more inclusive if it looks like a word.
          
          const nextChar = this.peek(1);
          if (nextChar && (this.isAlpha(nextChar) && nextChar !== '-')) {
             // It's like 'My-Label'. 
             // We'll treat it as part of the identifier.
             isLabelPart = true;
          }
        }
        
        if (!isLabelPart) {
          // It's likely an operator (e.g., 'x-1' or 'x - 1'), stop here.
          break;
        }
      }
      value += this.advance();
    }
    
    if (this.peek() === ':' && (this.pos === 0 || !this.isWhitespace(this.input[this.pos - 1]))) {
      value += this.advance();
      return this.createToken(TokenType.LABEL, value);
    }

    const keywords = ["var", "const", "macro", "endmacro", "set", "goto", "call", "ret", "jumpIf"];
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
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_' || char === '$' || char === '-';
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || (char >= '0' && char <= '9');
  }

  private isOperator(char: string): boolean {
    return "+-*/&|^~<>!=!".includes(char);
  }
}
