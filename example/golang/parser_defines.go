package fx

type CommandType int

type Identifier int

type Variable int

type Flag int

type CommandTypeTable map[string]CommandType

type IdentifierTable map[string]Identifier

type VariableTable map[string]Variable

type FlagTable map[string]Flag

func mergeTables[T interface {
	CommandType | Identifier | Variable | Flag
}](dst map[string]T, tables ...map[string]T) map[string]T {

	for _, t := range tables {
		for k, v := range t {
			dst[k] = v
		}
	}

	return dst
}

func (p *Parser) getCommandType(name string) (CommandType, bool) {
	v, ok := p.commandTypes[name]
	return v, ok
}

func (p *Parser) getIdentifier(name string) (Identifier, bool) {
	v, ok := p.identifiers[name]
	return v, ok
}

func (p *Parser) getVariable(name string) (Variable, bool) {
	v, ok := p.variables[name]
	return v, ok
}

func (p *Parser) getFlag(name string) (Flag, bool) {
	v, ok := p.flags[name]
	return v, ok
}

const (
	CmdNone CommandType = iota
	CmdNop
	CmdHostCall
	CmdGoto
	CmdSet
	CmdCopy
	CmdSetFlag
	CmdClearFlag
	CmdAdd
	CmdCall
	CmdRet
	CmdJumpIf
	CmdJumpIfFlag
	CmdJumpIfNotFlag

	UserCommandOffset
)

var baseCommandTypes = CommandTypeTable{
	"none":          CmdNone,
	"nop":           CmdNop,
	"hostCall":      CmdHostCall,
	"goto":          CmdGoto,
	"set":           CmdSet,
	"copy":          CmdCopy,
	"setFlag":       CmdSetFlag,
	"clearFlag":     CmdClearFlag,
	"add":           CmdAdd,
	"call":          CmdCall,
	"ret":           CmdRet,
	"jumpIf":        CmdJumpIf,
	"jumpIfFlag":    CmdJumpIfFlag,
	"jumpIfNotFlag": CmdJumpIfNotFlag,
}
