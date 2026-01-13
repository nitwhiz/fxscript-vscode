package vm

import (
	"github.com/nitwhiz/fxscript/fx"
)

var _ Environment = (*RuntimeFrame)(nil)

type RuntimeFrame struct {
	Environment
	*Runtime

	pc int

	sp    int
	stack [16]int
}

func (f *RuntimeFrame) pushPC() {
	f.stack[f.sp] = f.pc
	f.sp++
}

func (f *RuntimeFrame) popPC() (int, bool) {
	if f.sp == 0 {
		return 0, false
	}

	f.sp--
	return f.stack[f.sp], true
}

func (f *RuntimeFrame) ExecuteCommand(cmd *fx.CommandNode) (pc int, jump bool, err error) {
	pc, jump = f.handlers[cmd.Type](f, cmd.Args)
	return
}

func (f *RuntimeFrame) CmdNop() (jumpTarget int, jump bool) {
	return
}

func (f *RuntimeFrame) CmdGoto(jumpPc int) (jumpTarget int, jump bool) {
	return jumpPc, true
}

func (f *RuntimeFrame) CmdAdd(variable fx.Variable, value int) {
	f.Set(variable, f.Get(variable)+value)
}

func (f *RuntimeFrame) CmdJumpIf(variable fx.Variable, value int, jumpPc int) (pc int, jump bool) {
	return jumpPc, f.Get(variable) == value
}

func (f *RuntimeFrame) CmdJumpIfFlag(variable fx.Variable, flag fx.Flag, jumpPc int) (pc int, jump bool) {
	return jumpPc, f.CmdFlag(variable, flag)
}

func (f *RuntimeFrame) CmdJumpIfNotFlag(variable fx.Variable, flag fx.Flag, jumpPc int) (pc int, jump bool) {
	return jumpPc, !f.CmdFlag(variable, flag)
}

func (f *RuntimeFrame) CmdCall(addr int) (pc int, jump bool) {
	if addr == 0 {
		return f.script.EndOfScript(), true
	}

	f.pushPC()
	return addr, true
}

func (f *RuntimeFrame) CmdRet() (pc int, jump bool) {
	var ok bool

	jump = true

	pc, ok = f.popPC()

	if !ok {
		pc = f.script.EndOfScript()
	}

	return
}

func (f *RuntimeFrame) CmdCopy(from, to fx.Variable) {
	f.Set(to, f.Get(from))
}

func (f *RuntimeFrame) CmdSet(variable fx.Variable, value int) {
	f.Set(variable, value)
}

func (f *RuntimeFrame) CmdSetFlag(variable fx.Variable, flag fx.Flag) {
	f.Set(variable, int(variable)&int(flag))
}

func (f *RuntimeFrame) CmdClearFlag(variable fx.Variable, flag fx.Flag) {
	f.Set(variable, int(variable)&^int(flag))
}

func (f *RuntimeFrame) CmdFlag(variable fx.Variable, flag fx.Flag) (result bool) {
	return f.Get(variable)&int(flag) != 0
}
