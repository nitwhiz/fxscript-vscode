package movescript

import (
	"errors"
	"fmt"
	"log/slog"
	"reflect"
	"strconv"
	"strings"
)

type RuntimeEnvironment interface {
	CmdHostCall(argv []any)

	Get(variable Variable) (value int)
	Set(variable Variable, value int)
	Copy(from, to Variable)

  // copy variable value
	CmdCopy(from, to Variable)
	// set variable value
	CmdSet(variable Variable, value int)
	CmdSetFlag(variable Variable, flag Flag)
	CmdClearFlag(variable Variable, flag Flag)
	CmdFlag(variable Variable, flag Flag) (result bool)

	CmdDamageCalc(power int)
	CmdCritCalc()
	CmdTypeCalc()
	CmdCanceler(jumpPtr int) (pc int, jump bool)
	CmdAccuracyCheck(jumpPtr int) (pc int, jump bool)
	CmdHpUpdate()
	CmdStat(statRef Identifier, change int)
	CmdOhKo()
	CmdAilment(ailmentRef Identifier)
	CmdRecoil(typeRef Identifier)
	CmdSetSource(sourceRef Identifier)
	CmdSetTarget(targetRef Identifier)
	CmdMoveEnd()
	CmdPrint(str string)
	CmdSetSecondaryEffect(fnPtr int, chance int)
	CmdSecondaryEffect()
	CmdJumpIfMove(identifier string, jumpPtr int) (pc int, jump bool)
	CmdRandCall(fnPtr int, chance int)
	CmdRandJump(jumpPtr int, chance int) (pc int, jump bool)
	CmdDamageSet(damageType Identifier) (pc int, jump bool)
}

type baseRuntime interface {
	CmdNop() (pc int, jump bool)
	CmdGoto(jumpPtr int) (pc int, jump bool)
	CmdAdd(variable Variable, value int)
	CmdJumpIf(variable Variable, value int, jumpPtr int) (pc int, jump bool)
	CmdJumpIfFlag(variable Variable, flag Flag, jumpPtr int) (pc int, jump bool)
	CmdJumpIfNotFlag(variable Variable, flag Flag, jumpPtr int) (pc int, jump bool)
	CmdCall(ptr int) (pc int, jump bool)
	CmdRet() (pc int, jump bool)
}

type Runtime struct {
	script   *Script
	handlers [CmdCount]CommandHandler
}

func NewRuntime(script *Script) *Runtime {
	r := Runtime{
		script:   script,
		handlers: [CmdCount]CommandHandler{},
	}

	r.registerCommands()

	return &r
}

func (r *Runtime) newFrame(pc int, env RuntimeEnvironment) *runtimeFrame {
	return &runtimeFrame{
		RuntimeEnvironment: env,
		Runtime:            r,
		pc:                 pc,
	}
}

// Start starts to run from a specific PC
func (r *Runtime) Start(pc int, env RuntimeEnvironment) {
	f := r.newFrame(pc, env)

	commands := f.script.Commands()

	for ; f.pc < len(commands); f.pc++ {
		nextPc, jump := f.executeCommand(commands[f.pc])

		if jump {
			f.pc = nextPc - 1
		}
	}
}

// Call starts to run from a specific label name
func (r *Runtime) Call(labelName string, env RuntimeEnvironment) {
	pc, ok := r.script.Label(labelName)

	if !ok {
		slog.Error("Unknown label", slog.String("name", labelName))
		return
	}

	r.Start(pc, env)
}

func unmarshalArgs(argv []any, v any) error {
	if len(argv) == 0 {
		return nil
	}

	typ := reflect.TypeOf(v).Elem()
	val := reflect.ValueOf(v).Elem()

	for i := 0; i < typ.NumField(); i++ {
		argTag := typ.Field(i).Tag.Get("arg")

		if argTag != "-" {
			segments := strings.Split(argTag, ",")

			var argIdx int

			if segments[0] == "" {
				argIdx = i
			} else {
				var err error

				argIdx, err = strconv.Atoi(segments[0])

				if err != nil {
					return err
				}
			}

			useDefaultValue := false

			if len(argv) <= argIdx {
				if len(segments) == 2 && segments[1] == "optional" {
					useDefaultValue = true
				} else {
					return fmt.Errorf("index out of bounds: %d", argIdx)
				}
			}

			valField := val.Field(i)

			if useDefaultValue {
				switch valField.Interface().(type) {
				case Identifier:
					valField.Set(reflect.ValueOf(MissingIdentifier))
				case Variable:
					valField.Set(reflect.ValueOf(MissingVariable))
				case Flag:
					slog.Error("a Flag has no defined default value", "field", typ.Field(i).Name)
					break
				}
			} else {
				switch node := argv[argIdx].(type) {
				case *AddressNode:
					valField.Set(reflect.ValueOf(node.Address))
				case *IdentifierNode:
					valField.Set(reflect.ValueOf(node.Identifier))
				case *VariableNode:
					valField.Set(reflect.ValueOf(node.Variable))
				case *FlagNode:
					valField.Set(reflect.ValueOf(node.Flag))
				case *StringNode:
					valField.Set(reflect.ValueOf(node.Value))
				case *IntegerNode:
					valField.Set(reflect.ValueOf(node.Value))
				case *FloatNode:
					valField.Set(reflect.ValueOf(node.Value))
				default:
					return errors.New("unknown arg type")
				}
			}
		}
	}

	return nil
}
