package movescript

import (
	"github.com/nitwhiz/fxscript/fx"
	"github.com/nitwhiz/fxscript/vm"
)

type Environment interface {
	vm.Environment

	CmdDamageCalc(power int)
	CmdCritCalc()
	CmdTypeCalc()
	CmdAccuracyCheck(jumpPc int) (pc int, jump bool)
	CmdHpUpdate()
	CmdStat(stat fx.Identifier, change int)
	CmdOhKo()
	CmdAilment(ailment fx.Identifier)
	CmdRecoil(typ fx.Identifier)
	CmdMoveEnd()
	CmdPrint(msg string)
	CmdSetSecondaryEffect(effectPc int, chance int)
	CmdCallSecondaryEffect()
	CmdJumpIfMove(moveName string, jumpPc int) (pc int, jump bool)
	CmdJumpIfLastMove(actor fx.Identifier, moveName string, jumpPc int) (pc int, jump bool)
	CmdJumpIfType(actor fx.Identifier, typeName string, jumpPc int) (pc int, jump bool)
	CmdRandCall(fnPc int, chance int)
	CmdRandJump(jumpPc int, chance int) (pc int, jump bool)
	CmdDamageSet(damageType fx.Identifier)
	CmdSetSource(source fx.Identifier)
	CmdSetTarget(target fx.Identifier)
}

type VM struct {
	r   *vm.Runtime
	env Environment
}

func (v *VM) Start(pc int) {
	v.r.Start(pc, v.env)
}

func NewVM(s *fx.Script, env Environment) (*VM, error) {
	v := VM{
		env: env,
	}

	v.r = newRuntime(s, v.env)

	return &v, nil
}

func newRuntime(s *fx.Script, env Environment) *vm.Runtime {
	r := vm.NewRuntime(s)

	r.RegisterCommands([]*vm.Command{
		{CmdDamageCalc, damageCalcHandler(env)},
		{CmdCritCalc, critCalcHandler(env)},
		{CmdTypeCalc, typeCalcHandler(env)},
		{CmdAccuracyCheck, accuracyCheckHandler(env)},
		{CmdHpUpdate, hpUpdateHandler(env)},
		{CmdStat, statHandler(env)},
		{CmdOhKo, ohKoHandler(env)},
		{CmdAilment, ailmentHandler(env)},
		{CmdRecoil, recoilHandler(env)},
		{CmdMoveEnd, moveEndHandler(env)},
		{CmdPrint, printHandler(env)},
		{CmdSetSecondaryEffect, setSecondaryEffectHandler(env)},
		{CmdCallSecondaryEffect, callSecondaryEffectHandler(env)},
		{CmdJumpIfMove, jumpIfMoveHandler(env)},
		{CmdJumpIfLastMove, jumpIfLastMoveHandler(env)},
		{CmdJumpIfType, jumpIfTypeHandler(env)},
		{CmdRandCall, randCallHandler(env)},
		{CmdRandJump, randJumpHandler(env)},
		{CmdDamageSet, damageSetHandler(env)},
		{CmdSetSource, setSourceHandler(env)},
		{CmdSetTarget, setTargetHandler(env)},
	})

	return r
}
