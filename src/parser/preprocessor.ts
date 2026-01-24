import { Token, TokenType, Lexer } from './lexer';
import * as fs from 'fs';
import * as path from 'path';

export interface Macro {
    name: string;
    params: string[];
    body: Token[];
}

export class Preprocessor {
    private constants: Map<string, string> = new Map();
    private macros: Map<string, Macro> = new Map();
    private includedFiles: Set<string> = new Set();
    private workspaceRoot: string | undefined;

    constructor(workspaceRoot?: string) {
        this.workspaceRoot = workspaceRoot;
    }

    process(tokens: Token[]): Token[] {
        let result: Token[] = [];
        let i = 0;

        while (i < tokens.length) {
            const token = tokens[i];

            if (token.type === TokenType.PREPROCESSOR) {
                if (token.value === 'const') {
                    const name = tokens[++i];
                    const value = tokens[++i];
                    if (name && value) {
                        this.constants.set(name.value, value.value);
                    }
                } else if (token.value === 'macro') {
                    const nameToken = tokens[++i];
                    const params: string[] = [];
                    i++;
                    while (i < tokens.length && tokens[i].type === TokenType.MACRO_PARAM) {
                        params.push(tokens[i].value);
                        i++;
                    }
                    const body: Token[] = [];
                    while (i < tokens.length && !(tokens[i].type === TokenType.PREPROCESSOR && tokens[i].value === 'endmacro')) {
                        body.push(tokens[i]);
                        i++;
                    }
                    if (nameToken) {
                        this.macros.set(nameToken.value, { name: nameToken.value, params, body });
                    }
                    i++; // skip endmacro
                } else if (token.value === '@include') {
                    const pathToken = tokens[++i];
                    if (pathToken && pathToken.type === TokenType.STRING && this.workspaceRoot) {
                        const fullPath = path.resolve(this.workspaceRoot, pathToken.value);
                        if (!this.includedFiles.has(fullPath) && fs.existsSync(fullPath)) {
                            this.includedFiles.add(fullPath);
                            const content = fs.readFileSync(fullPath, 'utf8');
                            const lexer = new Lexer(content);
                            const includedTokens = lexer.tokenize();
                            // Recursively process included tokens, but watch out for EOF
                            const processed = this.process(includedTokens.filter(t => t.type !== TokenType.EOF));
                            result.push(...processed);
                        }
                    }
                } else {
                    result.push(token);
                }
            } else if (token.type === TokenType.IDENTIFIER) {
                if (this.constants.has(token.value)) {
                    const value = this.constants.get(token.value)!;
                    // For now just replace with a token of same type but different value, 
                    // or maybe it should be re-lexed if it's a number?
                    // The guidelines say "literal text replacement".
                    // Let's just create a new token.
                    const isNum = /^-?[0-9]/.test(value);
                    result.push({
                        ...token,
                        type: isNum ? TokenType.NUMBER : TokenType.IDENTIFIER,
                        value: value
                    });
                } else if (this.macros.has(token.value)) {
                    const macro = this.macros.get(token.value)!;
                    const args: Token[][] = [];
                    i++;
                    // Basic macro expansion: collect arguments
                    // This is tricky because macro args are space separated expressions or tokens?
                    // Example says `take_damage 10`. So it takes one arg.
                    for (let j = 0; j < macro.params.length; j++) {
                        const argTokens: Token[] = [];
                        // Simple arg collection until comma or newline?
                        while (i < tokens.length && tokens[i].type !== TokenType.COMMA && tokens[i].type !== TokenType.NEWLINE) {
                            argTokens.push(tokens[i]);
                            i++;
                        }
                        args.push(argTokens);
                        if (i < tokens.length && tokens[i].type === TokenType.COMMA) {
                            i++;
                        }
                    }
                    
                    // Expand body
                    const expandedBody = macro.body.map(bodyToken => {
                        if (bodyToken.type === TokenType.MACRO_PARAM) {
                            const paramIndex = macro.params.indexOf(bodyToken.value);
                            if (paramIndex !== -1 && args[paramIndex]) {
                                // This only supports single token replacement for now, 
                                // real macro expansion is more complex.
                                return args[paramIndex][0] || bodyToken; 
                            }
                        }
                        return bodyToken;
                    });
                    result.push(...expandedBody);
                    continue; // i is already advanced
                } else {
                    result.push(token);
                }
            } else {
                result.push(token);
            }
            i++;
        }

        return result;
    }

    getConstants() { return this.constants; }
    getMacros() { return this.macros; }
}
