export enum TokenType {
    IDENTIFIER,
    NUMBER,
    STRING,
    OPERATOR,
    LABEL, // name:
    MACRO_PARAM, // $name
    PREPROCESSOR, // @include, const, macro, endmacro
    COMMA,
    COLON,
    LPAREN,
    RPAREN,
    NEWLINE,
    EOF,
    COMMENT
}

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
    start: number;
    end: number;
}

export class Lexer {
    private input: string;
    private pos: number = 0;
    private line: number = 0;
    private column: number = 0;

    constructor(input: string) {
        this.input = input;
    }

    private peek(): string {
        return this.input[this.pos] || '';
    }

    private advance(): string {
        const char = this.peek();
        this.pos++;
        if (char === '\n') {
            this.line++;
            this.column = 0;
        } else {
            this.column++;
        }
        return char;
    }

    private isWhitespace(char: string): boolean {
        return char === ' ' || char === '\t' || char === '\r';
    }

    private isAlpha(char: string): boolean {
        return /[a-zA-Z_]/.test(char);
    }

    private isAlnum(char: string): boolean {
        return /[a-zA-Z0-9_]/.test(char);
    }

    private isDigit(char: string): boolean {
        return /[0-9]/.test(char);
    }

    tokenize(): Token[] {
        const tokens: Token[] = [];
        while (this.pos < this.input.length) {
            const char = this.peek();

            if (this.isWhitespace(char)) {
                this.advance();
                continue;
            }

            const start = this.pos;
            const startLine = this.line;
            const startColumn = this.column;

            if (char === '\n') {
                this.advance();
                tokens.push({ type: TokenType.NEWLINE, value: '\n', line: startLine, column: startColumn, start, end: this.pos });
                continue;
            }

            if (char === '#') {
                while (this.peek() !== '\n' && this.pos < this.input.length) {
                    this.advance();
                }
                // Don't push comment tokens for now, or maybe we should? The guidelines say preprocessor runs before parsing.
                continue;
            }

            if (char === '@' || (char === 'c' && this.input.startsWith('const', this.pos)) || (char === 'm' && this.input.startsWith('macro', this.pos)) || (char === 'e' && this.input.startsWith('endmacro', this.pos))) {
                // Simplified preprocessor detection
                if (char === '@') {
                    this.advance();
                    let value = '';
                    while (this.isAlpha(this.peek())) {
                        value += this.advance();
                    }
                    tokens.push({ type: TokenType.PREPROCESSOR, value: '@' + value, line: startLine, column: startColumn, start, end: this.pos });
                    continue;
                }
                // Fallthrough to identifier check for const/macro/endmacro
            }

            if (char === '$') {
                this.advance();
                let value = '$';
                while (this.isAlnum(this.peek())) {
                    value += this.advance();
                }
                tokens.push({ type: TokenType.MACRO_PARAM, value, line: startLine, column: startColumn, start, end: this.pos });
                continue;
            }

            if (this.isAlpha(char)) {
                let value = '';
                while (this.isAlnum(this.peek())) {
                    value += this.advance();
                }

                if (this.peek() === ':') {
                    this.advance();
                    tokens.push({ type: TokenType.LABEL, value: value + ':', line: startLine, column: startColumn, start, end: this.pos });
                } else if (value === 'const' || value === 'macro' || value === 'endmacro') {
                    tokens.push({ type: TokenType.PREPROCESSOR, value, line: startLine, column: startColumn, start, end: this.pos });
                } else {
                    tokens.push({ type: TokenType.IDENTIFIER, value, line: startLine, column: startColumn, start, end: this.pos });
                }
                continue;
            }

            if (this.isDigit(char) || (char === '-' && this.isDigit(this.input[this.pos + 1]))) {
                let value = this.advance();
                while (this.isDigit(this.peek()) || this.peek() === 'x' || (value.endsWith('0x') && /[0-9a-fA-F]/.test(this.peek())) || (/[0-9a-fA-F]/.test(this.peek()) && value.includes('0x'))) {
                    value += this.advance();
                }
                tokens.push({ type: TokenType.NUMBER, value, line: startLine, column: startColumn, start, end: this.pos });
                continue;
            }

            if (char === '"') {
                this.advance();
                let value = '';
                while (this.peek() !== '"' && this.pos < this.input.length) {
                    value += this.advance();
                }
                this.advance();
                tokens.push({ type: TokenType.STRING, value, line: startLine, column: startColumn, start, end: this.pos });
                continue;
            }

            if (['+', '-', '*', '/', '%', '&', '|', '^', '!', '=', '<', '>'].includes(char)) {
                let value = this.advance();
                const next = this.peek();
                if ((value === '=' && next === '=') || (value === '!' && next === '=') || (value === '<' && next === '=') || (value === '>' && next === '=')) {
                    value += this.advance();
                }
                tokens.push({ type: TokenType.OPERATOR, value, line: startLine, column: startColumn, start, end: this.pos });
                continue;
            }

            if (char === ',') {
                this.advance();
                tokens.push({ type: TokenType.COMMA, value: ',', line: startLine, column: startColumn, start, end: this.pos });
                continue;
            }

            if (char === '(') {
                this.advance();
                tokens.push({ type: TokenType.LPAREN, value: '(', line: startLine, column: startColumn, start, end: this.pos });
                continue;
            }

            if (char === ')') {
                this.advance();
                tokens.push({ type: TokenType.RPAREN, value: ')', line: startLine, column: startColumn, start, end: this.pos });
                continue;
            }

            // Unknown character
            this.advance();
        }
        tokens.push({ type: TokenType.EOF, value: '', line: this.line, column: this.column, start: this.pos, end: this.pos });
        return tokens;
    }
}
