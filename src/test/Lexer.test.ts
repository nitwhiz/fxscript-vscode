import { describe, it, expect } from 'vitest';
import { Lexer, TokenType } from '../core/Lexer';

describe('FXScript Lexer', () => {
  it('should tokenize basic tokens', () => {
    const content = 'var myVar 123 "string" , : ( ) + - * /';
    const lexer = new Lexer(content);
    const tokens = lexer.tokenize();

    const types = tokens.filter(t => t.type !== TokenType.EOF).map(t => t.type);
    expect(types).toEqual([
      TokenType.KEYWORD,    // var
      TokenType.IDENTIFIER, // myVar
      TokenType.NUMBER,     // 123
      TokenType.STRING,     // "string"
      TokenType.COMMA,      // ,
      TokenType.COLON,      // :
      TokenType.LPAREN,     // (
      TokenType.RPAREN,     // )
      TokenType.OPERATOR,   // +
      TokenType.OPERATOR,   // -
      TokenType.OPERATOR,   // *
      TokenType.OPERATOR,   // /
    ]);
  });

  it('should tokenize labels and local labels', () => {
    const content = 'Main: %_local %local: label-with-hyphen: %local-with-hyphen:';
    const lexer = new Lexer(content);
    const tokens = lexer.tokenize();

    expect(tokens[0].type).toBe(TokenType.LABEL);
    expect(tokens[0].value).toBe('Main:');

    expect(tokens[1].type).toBe(TokenType.LOCAL_LABEL);
    expect(tokens[1].value).toBe('%_local');

    expect(tokens[2].type).toBe(TokenType.LOCAL_LABEL);
    expect(tokens[2].value).toBe('%local:');

    expect(tokens[3].type).toBe(TokenType.LABEL);
    expect(tokens[3].value).toBe('label-with-hyphen:');

    expect(tokens[4].type).toBe(TokenType.LOCAL_LABEL);
    expect(tokens[4].value).toBe('%local-with-hyphen:');
  });

  it('should tokenize hex numbers', () => {
    const content = '0x123 0xABC 0xabc';
    const lexer = new Lexer(content);
    const tokens = lexer.tokenize();

    const types = tokens.filter(t => t.type !== TokenType.EOF).map(t => t.type);
    expect(types).toEqual([TokenType.NUMBER, TokenType.NUMBER, TokenType.NUMBER]);
    expect(tokens[0].value).toBe('0x123');
    expect(tokens[1].value).toBe('0xABC');
    expect(tokens[2].value).toBe('0xabc');
  });

  it('should handle hyphen in expressions vs labels/references', () => {
    const content = 'a-b a - b label-def: %local-def: %local-ref';
    const lexer = new Lexer(content);
    const tokens = lexer.tokenize();

    expect(tokens[0].type).toBe(TokenType.IDENTIFIER); 
    expect(tokens[0].value).toBe('a-b'); // Now allowed in references
    
    expect(tokens[1].type).toBe(TokenType.IDENTIFIER); // a
    expect(tokens[2].type).toBe(TokenType.OPERATOR);   // -
    expect(tokens[3].type).toBe(TokenType.IDENTIFIER); // b
    
    expect(tokens[4].type).toBe(TokenType.LABEL);      // label-def:
    expect(tokens[4].value).toBe('label-def:');

    expect(tokens[5].type).toBe(TokenType.LOCAL_LABEL); // %local-def:
    expect(tokens[5].value).toBe('%local-def:');

    expect(tokens[6].type).toBe(TokenType.LOCAL_LABEL); // %local-ref
    expect(tokens[6].value).toBe('%local-ref');
  });

  it('should handle hyphen at end of word as operator', () => {
    const content = 'myVar- var -';
    const lexer = new Lexer(content);
    const tokens = lexer.tokenize();

    expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
    expect(tokens[0].value).toBe('myVar');
    expect(tokens[1].type).toBe(TokenType.OPERATOR);
    expect(tokens[1].value).toBe('-');

    expect(tokens[2].type).toBe(TokenType.KEYWORD);
    expect(tokens[2].value).toBe('var');
    expect(tokens[3].type).toBe(TokenType.OPERATOR);
    expect(tokens[3].value).toBe('-');
  });

  it('should tokenize comments', () => {
    const content = '# this is a comment';
    const lexer = new Lexer(content);
    const tokens = lexer.tokenize();

    expect(tokens[0].type).toBe(TokenType.COMMENT);
    expect(tokens[0].value).toBe('# this is a comment');
  });

  it('should tokenize directives', () => {
    const content = `
@def myConst
@include "file"
`;
    const lexer = new Lexer(content);
    const tokens = lexer.tokenize();

    const directives = tokens.filter(t => t.type === TokenType.DIRECTIVE);
    expect(directives[0].value).toBe('@defmyConst');
    expect(directives[1].value).toBe('@include"file"');
  });
});
