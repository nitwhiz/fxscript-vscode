export enum OperatorType {
    BINARY,
    UNARY
}

export interface Operator {
    symbol: string;
    precedence: number;
    type: OperatorType;
    associativity?: 'left' | 'right';
}

export const OPERATORS: Operator[] = [
    { symbol: '||', precedence: 1, type: OperatorType.BINARY, associativity: 'left' },
    { symbol: '&&', precedence: 2, type: OperatorType.BINARY, associativity: 'left' },
    { symbol: '|', precedence: 3, type: OperatorType.BINARY, associativity: 'left' },
    { symbol: '^', precedence: 4, type: OperatorType.BINARY, associativity: 'left' },
    { symbol: '&', precedence: 5, type: OperatorType.BINARY, associativity: 'left' },
    { symbol: '==', precedence: 6, type: OperatorType.BINARY, associativity: 'left' },
    { symbol: '!=', precedence: 6, type: OperatorType.BINARY, associativity: 'left' },
    { symbol: '<', precedence: 7, type: OperatorType.BINARY, associativity: 'left' },
    { symbol: '<=', precedence: 7, type: OperatorType.BINARY, associativity: 'left' },
    { symbol: '>', precedence: 7, type: OperatorType.BINARY, associativity: 'left' },
    { symbol: '>=', precedence: 7, type: OperatorType.BINARY, associativity: 'left' },
    { symbol: '+', precedence: 8, type: OperatorType.BINARY, associativity: 'left' },
    { symbol: '-', precedence: 8, type: OperatorType.BINARY, associativity: 'left' },
    { symbol: '*', precedence: 9, type: OperatorType.BINARY, associativity: 'left' },
    { symbol: '/', precedence: 9, type: OperatorType.BINARY, associativity: 'left' },
    { symbol: '%', precedence: 9, type: OperatorType.BINARY, associativity: 'left' },
    { symbol: '!', precedence: 10, type: OperatorType.UNARY },
    { symbol: '-', precedence: 10, type: OperatorType.UNARY },
    { symbol: '*', precedence: 10, type: OperatorType.UNARY }, // deref
    { symbol: '&', precedence: 10, type: OperatorType.UNARY }, // address
];

export function getBinaryOperator(symbol: string): Operator | undefined {
    return OPERATORS.find(op => op.symbol === symbol && op.type === OperatorType.BINARY);
}

export function getUnaryOperator(symbol: string): Operator | undefined {
    return OPERATORS.find(op => op.symbol === symbol && op.type === OperatorType.UNARY);
}
