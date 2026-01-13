package fx

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/nitwhiz/ring-buffer"
)

const (
	tokenPrefetch = 16
)

type SyntaxError struct {
	Message string
}

func (e *SyntaxError) Error() string {
	return fmt.Sprintf("syntax error: %s", e.Message)
}

type ParserConfig struct {
	CommandTypes CommandTypeTable
	Identifiers  IdentifierTable
	Variables    VariableTable
	Flags        FlagTable
}

type Parser struct {
	l   *Lexer
	buf *ring.Buffer[*Token]

	commandTypes CommandTypeTable
	identifiers  IdentifierTable
	variables    VariableTable
	flags        FlagTable

	done bool
}

func NewParser(l *Lexer, c *ParserConfig) *Parser {
	p := Parser{
		l:   l,
		buf: ring.NewBuffer[*Token](1024),

		commandTypes: mergeTables(CommandTypeTable{}, baseCommandTypes, c.CommandTypes),
		identifiers:  mergeTables(IdentifierTable{}, c.Identifiers),
		variables:    mergeTables(VariableTable{}, c.Variables),
		flags:        mergeTables(FlagTable{}, c.Flags),
	}

	return &p
}

func (p *Parser) fillBuffer() (err error) {
	if p.done {
		return
	}

	prefetch := tokenPrefetch - p.buf.Len()

	if prefetch <= 0 {
		return
	}

	for range prefetch {
		tok := p.l.NextToken()

		if err = p.buf.WriteOne(tok); err != nil {
			return err
		}

		if tok.Type == EOF {
			p.done = true
			break
		}
	}

	return nil
}

func (p *Parser) peekAhead(n int) (tok *Token, err error) {
	if err = p.fillBuffer(); err != nil {
		return
	}

	tok, err = p.buf.Peek(n)

	return
}

func (p *Parser) peek() (*Token, error) {
	return p.peekAhead(0)
}

func (p *Parser) advance() (tok *Token, err error) {
	if err = p.fillBuffer(); err != nil {
		return
	}

	tok, err = p.buf.ReadOne()

	return
}

func (p *Parser) parseMacro(script *Script) (err error) {
	if _, err = p.advance(); err != nil {
		return
	}

	ident, err := p.advance()

	if err != nil {
		return
	}

	subscript := newScript(script)

	ok := true

	for ok {
		ok, err = p.parseNextNode(subscript, EndMacroToken)

		if err != nil {
			return
		}
	}

	script.macros[ident.Value] = subscript

	return
}

func (p *Parser) getDefinedIdent(script *Script, tok *Token) ExpressionNode {
	if expr, ok := script.constants[tok.Value]; ok {
		return expr
	}

	if identifier, ok := p.getIdentifier(tok.Value); ok {
		return &IdentifierNode{identifier}
	}

	if variable, ok := p.getVariable(tok.Value); ok {
		return &VariableNode{variable}
	}

	if flag, ok := p.getFlag(tok.Value); ok {
		return &FlagNode{flag}
	}

	return &LabelNode{tok.Value}
}

func (p *Parser) parsePrimary(script *Script) (expr ExpressionNode, err error) {
	tok, err := p.advance()

	if err != nil {
		return
	}

	switch tok.Type {
	case NewlineToken:
		return
	case OperatorToken:
		op := opRuneFromToken(tok)

		if op == OpAdd || op == OpSub {
			var operand ExpressionNode

			operand, err = p.parsePrimary(script)

			if err != nil {
				return
			}

			expr = &UnaryOpNode{op, operand}
			return
		}

		err = &SyntaxError{"unexpected operator '" + tok.Value + "'"}
		return
	case LParenToken:
		expr, err = p.parseExpression(script)

		if err != nil {
			return
		}

		tok, err = p.advance()

		if err != nil {
			return
		}

		if tok.Type != RParenToken {
			err = &SyntaxError{"expected ')'"}
			return
		}

		return
	case NumberToken:
		if strings.Contains(tok.Value, ".") {
			var val float64

			val, err = strconv.ParseFloat(tok.Value, 64)

			if err != nil {
				return
			}

			expr = &FloatNode{val}
			return
		}

		var val int64

		val, err = strconv.ParseInt(tok.Value, 10, 32)

		if err != nil {
			return
		}

		expr = &IntegerNode{int(val)}
		return
	case StringToken:
		expr = &StringNode{tok.Value}
		return
	case IdentToken:
		expr = p.getDefinedIdent(script, tok)
		return
	default:
		err = &SyntaxError{"unexpected token '" + tok.Value + "'"}
		return
	}
}

func opRuneFromToken(tok *Token) (opRune rune) {
	if len(tok.Value) > 0 {
		opRune = rune(tok.Value[0])
	}

	return
}

func (p *Parser) parseMultiplicative(script *Script) (expr ExpressionNode, err error) {
	expr, err = p.parsePrimary(script)

	if err != nil {
		return
	}

	tok, err := p.peek()

	if err != nil {
		return
	}

	for {
		opRune := opRuneFromToken(tok)

		if tok.Type != OperatorToken || (opRune != OpMul && opRune != OpDiv && opRune != OpMod) {
			break
		}

		if _, err = p.advance(); err != nil {
			return
		}

		var right ExpressionNode

		right, err = p.parsePrimary(script)

		if err != nil {
			return
		}

		expr = &BinaryOpNode{
			Left:     expr,
			Operator: opRune,
			Right:    right,
		}

		tok, err = p.peek()

		if err != nil {
			return
		}
	}

	return
}

func (p *Parser) parseAdditive(script *Script) (expr ExpressionNode, err error) {
	expr, err = p.parseMultiplicative(script)

	if err != nil {
		return
	}

	tok, err := p.peek()

	if err != nil {
		return
	}

	for {
		opRune := opRuneFromToken(tok)

		if tok.Type != OperatorToken || (opRune != OpAdd && opRune != OpSub) {
			break
		}

		if _, err = p.advance(); err != nil {
			return
		}

		var right ExpressionNode

		right, err = p.parseMultiplicative(script)

		if err != nil {
			return
		}

		expr = &BinaryOpNode{
			Left:     expr,
			Operator: opRune,
			Right:    right,
		}

		tok, err = p.peek()

		if err != nil {
			return
		}
	}

	return
}

func (p *Parser) parseExpression(script *Script) (ExpressionNode, error) {
	return p.parseAdditive(script)
}

func (p *Parser) parseConst(script *Script) (err error) {
	if _, err = p.advance(); err != nil {
		return
	}

	nameIdent, err := p.advance()

	if err != nil {
		return
	}

	script.constants[nameIdent.Value], err = p.parseExpression(script)

	return
}

func (p *Parser) parseCommand(script *Script) (err error) {
	cmd := CommandNode{
		Type: CmdNone,
	}

	var tok *Token

	for {
		tok, err = p.peek()

		if err != nil {
			return
		}

		if tok.Type == NewlineToken || tok.Type == EOF {
			if cmd.Type != CmdNone {
				script.commands = append(script.commands, &cmd)
			}

			_, err = p.advance()

			return
		}

		if cmd.Type == CmdNone {
			if _, err = p.advance(); err != nil {
				return
			}

			cmdType, ok := p.getCommandType(tok.Value)

			if !ok {
				m, ok := script.macros[tok.Value]

				if ok {
					script.commands = append(script.commands, m.commands...)
				} else {
					err = &SyntaxError{"unknown command: '" + tok.Value + "'"}
					return
				}
			} else {
				cmd.Type = cmdType
			}
		} else {
			var argNode ExpressionNode

			argNode, err = p.parseExpression(script)

			if err != nil {
				return
			}

			tok, err = p.peek()

			if err != nil {
				return
			}

			if tok.Type == CommaToken {
				_, err = p.advance()

				if err != nil {
					return
				}
			}

			if argNode == nil {
				return
			}

			cmd.Args = append(cmd.Args, argNode)
		}
	}
}

func (p *Parser) parseLabelDeclaration(script *Script) (err error) {
	nameIdent, err := p.advance()

	if err != nil {
		return
	}

	if _, err = p.advance(); err != nil {
		return
	}

	script.labels[nameIdent.Value] = script.PC()

	return
}

func (p *Parser) parseIdent(script *Script) (err error) {
	tok, err := p.peekAhead(1)

	if err != nil {
		return
	}

	if tok.Type == ColonToken {
		err = p.parseLabelDeclaration(script)
		return
	}

	return p.parseCommand(script)
}

func (p *Parser) parseNextNode(script *Script, end TokenType) (ok bool, err error) {
	ok = true

	tok, err := p.peek()

	if err != nil {
		ok = false
		return
	}

	switch tok.Type {
	case end:
		ok = false

		if _, err = p.advance(); err != nil {
			return
		}
	case MacroToken:
		if err = p.parseMacro(script); err != nil {
			return
		}
	case ConstToken:
		if err = p.parseConst(script); err != nil {
			return
		}
	case IdentToken:
		if err = p.parseIdent(script); err != nil {
			return
		}
	case NewlineToken:
		if _, err = p.advance(); err != nil {
			return
		}
	default:
		err = &SyntaxError{"unexpected token"}
		return
	}

	return
}

func replaceLabelNodesInExpression(script *Script, expr ExpressionNode) (resultExpr ExpressionNode, err error) {
	resultExpr = expr

	switch n := expr.(type) {
	case *BinaryOpNode:
		n.Left, err = replaceLabelNodesInExpression(script, n.Left)

		if err != nil {
			return
		}

		n.Right, err = replaceLabelNodesInExpression(script, n.Right)

		if err != nil {
			return
		}

		break
	case *LabelNode:
		pc, ok := script.labels[n.Name]

		if !ok {
			err = &SyntaxError{"unknown label: '" + n.Name + "'"}
			return
		}

		resultExpr = &AddressNode{pc}

		break
	}

	return
}

func replaceLabelNodes(script *Script) (err error) {
	for _, c := range script.commands {
		for idx := range c.Args {
			c.Args[idx], err = replaceLabelNodesInExpression(script, c.Args[idx])

			if err != nil {
				return
			}
		}
	}

	return
}

func (p *Parser) Parse() (script *Script, err error) {
	script = newScript(nil)

	ok := true

	for ok {
		ok, err = p.parseNextNode(script, EOF)

		if err != nil {
			return nil, err
		}
	}

	err = replaceLabelNodes(script)

	return
}
