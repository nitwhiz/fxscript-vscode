import { Token, TokenType } from './lexer';
import { ASTNode, Expression, Statement, Program, Identifier, NumberLiteral, BinaryExpression, UnaryExpression, CommandStatement, LabelStatement } from './ast';
import { getBinaryOperator, getUnaryOperator } from './operators';
import { CommandRegistry } from '../util/commandRegistry';

export class Parser {
    private tokens: Token[];
    private pos: number = 0;

    constructor(tokens: Token[], private registry: CommandRegistry) {
        this.tokens = tokens;
    }

    private peek(): Token {
        return this.tokens[this.pos] || { type: TokenType.EOF, value: '', line: 0, column: 0, start: 0, end: 0 };
    }

    private advance(): Token {
        return this.tokens[this.pos++];
    }

    private match(type: TokenType): boolean {
        if (this.peek().type === type) {
            this.advance();
            return true;
        }
        return false;
    }

    parse(): Program {
        const body: Statement[] = [];
        const start = this.peek().start;
        const line = this.peek().line;

        while (this.peek().type !== TokenType.EOF) {
            if (this.match(TokenType.NEWLINE)) continue;
            const stmt = this.parseStatement();
            if (stmt) body.push(stmt);
        }

        return {
            type: 'Program',
            body,
            start,
            end: this.peek().end,
            line
        };
    }

    private parseStatement(): Statement | null {
        const token = this.peek();

        if (token.type === TokenType.LABEL) {
            this.advance();
            return {
                type: 'LabelStatement',
                name: token.value.slice(0, -1),
                start: token.start,
                end: token.end,
                line: token.line
            } as LabelStatement;
        }

        if (token.type === TokenType.IDENTIFIER) {
            // Check if it's a command
            const command = this.registry.getCommand(token.value);
            if (command) {
                this.advance();
                const args: Expression[] = [];
                while (this.peek().type !== TokenType.NEWLINE && this.peek().type !== TokenType.EOF) {
                    args.push(this.parseExpression());
                    if (this.peek().type === TokenType.COMMA) {
                        this.advance();
                    } else if (this.peek().type !== TokenType.NEWLINE && this.peek().type !== TokenType.EOF) {
                        // Support space separated args too? The example shows space separated.
                    }
                }
                return {
                    type: 'CommandStatement',
                    command: command.name,
                    args,
                    start: token.start,
                    end: args.length > 0 ? args[args.length - 1].end : token.end,
                    line: token.line
                } as CommandStatement;
            }
        }

        // Default: try to parse as expression if it doesn't match anything else?
        // Actually, in FXScript, everything is either a label or a command (with expressions as args).
        // Let's just skip unknown tokens for now.
        this.advance();
        return null;
    }

    private parseExpression(minPrecedence: number = 0): Expression {
        let left = this.parsePrimary();

        while (true) {
            const token = this.peek();
            if (token.type !== TokenType.OPERATOR) break;

            const op = getBinaryOperator(token.value);
            if (!op || op.precedence < minPrecedence) break;

            this.advance();
            const nextMinPrecedence = op.associativity === 'left' ? op.precedence + 1 : op.precedence;
            const right = this.parseExpression(nextMinPrecedence);

            left = {
                type: 'BinaryExpression',
                left,
                operator: op.symbol,
                right,
                start: left.start,
                end: right.end,
                line: left.line
            } as BinaryExpression;
        }

        return left;
    }

    private parsePrimary(): Expression {
        const token = this.advance();

        if (token.type === TokenType.NUMBER) {
            return {
                type: 'NumberLiteral',
                value: parseInt(token.value, 0), // Basic int parsing
                raw: token.value,
                start: token.start,
                end: token.end,
                line: token.line
            } as NumberLiteral;
        }

        if (token.type === TokenType.IDENTIFIER) {
            return {
                type: 'Identifier',
                name: token.value,
                start: token.start,
                end: token.end,
                line: token.line
            } as Identifier;
        }

        if (token.type === TokenType.OPERATOR) {
            const op = getUnaryOperator(token.value);
            if (op) {
                const arg = this.parseExpression(op.precedence);
                return {
                    type: 'UnaryExpression',
                    operator: op.symbol,
                    argument: arg,
                    start: token.start,
                    end: arg.end,
                    line: token.line
                } as UnaryExpression;
            }
        }

        if (token.type === TokenType.LPAREN) {
            const expr = this.parseExpression();
            this.match(TokenType.RPAREN);
            return expr;
        }

        // Fallback
        return {
            type: 'Identifier',
            name: token.value,
            start: token.start,
            end: token.end,
            line: token.line
        } as Identifier;
    }
}
