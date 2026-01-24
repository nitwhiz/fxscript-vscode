import { Token } from './lexer';

export interface ASTNode {
    start: number;
    end: number;
    line: number;
}

export interface Expression extends ASTNode {
    type: string;
}

export interface Identifier extends Expression {
    type: 'Identifier';
    name: string;
}

export interface NumberLiteral extends Expression {
    type: 'NumberLiteral';
    value: number;
    raw: string;
}

export interface BinaryExpression extends Expression {
    type: 'BinaryExpression';
    left: Expression;
    operator: string;
    right: Expression;
}

export interface UnaryExpression extends Expression {
    type: 'UnaryExpression';
    operator: string;
    argument: Expression;
}

export interface Statement extends ASTNode {
    type: string;
}

export interface CommandStatement extends Statement {
    type: 'CommandStatement';
    command: string;
    args: Expression[];
}

export interface LabelStatement extends Statement {
    type: 'LabelStatement';
    name: string;
}

export interface ConstStatement extends Statement {
    type: 'ConstStatement';
    name: string;
    value: string; // Preprocessor level
}

export interface MacroStatement extends Statement {
    type: 'MacroStatement';
    name: string;
    params: string[];
    body: Token[];
}

export interface IncludeStatement extends Statement {
    type: 'IncludeStatement';
    path: string;
}

export interface Program extends ASTNode {
    type: 'Program';
    body: Statement[];
}
