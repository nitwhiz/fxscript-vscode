import { Token, TokenType } from './Lexer';

export class ExpressionEvaluator {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public evaluate(): number {
    return this.parseLogicalOr();
  }

  private parseLogicalOr(): number {
    let left = this.parseBitwiseOr();
    while (this.peek().value === '||') {
      this.advance();
      const right = this.parseBitwiseOr();
      left = (left || right) ? 1 : 0;
    }
    return left;
  }

  private parseBitwiseOr(): number {
    let left = this.parseBitwiseXor();
    while (this.peek().value === '|') {
      this.advance();
      const right = this.parseBitwiseXor();
      left = left | right;
    }
    return left;
  }

  private parseBitwiseXor(): number {
    let left = this.parseBitwiseAnd();
    while (this.peek().value === '^') {
      this.advance();
      const right = this.parseBitwiseAnd();
      left = left ^ right;
    }
    return left;
  }

  private parseBitwiseAnd(): number {
    let left = this.parseEquality();
    while (this.peek().value === '&') {
      this.advance();
      const right = this.parseEquality();
      left = left & right;
    }
    return left;
  }

  private parseEquality(): number {
    let left = this.parseComparison();
    while (this.peek().value === '==' || this.peek().value === '!=') {
      const op = this.advance().value;
      const right = this.parseComparison();
      if (op === '==') left = (left === right) ? 1 : 0;
      else left = (left !== right) ? 1 : 0;
    }
    return left;
  }

  private parseComparison(): number {
    let left = this.parseShift();
    const ops = ['<', '>', '<=', '>='];
    while (ops.includes(this.peek().value)) {
      const op = this.advance().value;
      const right = this.parseShift();
      if (op === '<') left = (left < right) ? 1 : 0;
      else if (op === '>') left = (left > right) ? 1 : 0;
      else if (op === '<=') left = (left <= right) ? 1 : 0;
      else if (op === '>=') left = (left >= right) ? 1 : 0;
    }
    return left;
  }

  private parseShift(): number {
    let left = this.parseAdditive();
    while (this.peek().value === '<<' || this.peek().value === '>>') {
      const op = this.advance().value;
      const right = this.parseAdditive();
      if (op === '<<') left = left << right;
      else left = left >> right;
    }
    return left;
  }

  private parseAdditive(): number {
    let left = this.parseMultiplicative();
    while (this.peek().value === '+' || this.peek().value === '-') {
      const op = this.advance().value;
      const right = this.parseMultiplicative();
      if (op === '+') left = left + right;
      else left = left - right;
    }
    return left;
  }

  private parseMultiplicative(): number {
    let left = this.parseUnary();
    while (this.peek().value === '*' || this.peek().value === '/' || this.peek().value === '%') {
      const op = this.advance().value;
      const right = this.parseUnary();
      if (op === '*') left = left * right;
      else if (op === '/') left = left / right;
      else if (op === '%') left = left % right;
    }
    return left;
  }

  private parseUnary(): number {
    const op = this.peek().value;
    if (op === '!' || op === '~' || op === '-') {
      this.advance();
      const val = this.parseUnary();
      if (op === '!') return val ? 0 : 1;
      if (op === '~') return ~val;
      if (op === '-') return -val;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const t = this.advance();
    if (t.type === TokenType.NUMBER) {
      if (t.value.startsWith('0x')) return parseInt(t.value.substring(2), 16);
      return parseInt(t.value, 10);
    }
    if (t.type === TokenType.LPAREN) {
      const val = this.evaluate();
      this.consume(TokenType.RPAREN);
      return val;
    }
    return 0; // Default or error
  }

  private peek(): Token {
    return this.tokens[this.pos] || { type: TokenType.EOF, value: "", line: 0, character: 0, length: 0 };
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private consume(type: TokenType) {
    if (this.peek().type === type) return this.advance();
    return undefined;
  }
}
