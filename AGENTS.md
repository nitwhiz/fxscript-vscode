# FXScript VSCode Extension

## Language Overview

Assembly-ish scripting language with C-like expressions. Source: https://github.com/nitwhiz/fxscript

**Critical characteristics:**
- Commands: `nop`, `goto`, `set`, `push`, `pop`, `add`, `call`, `ret`, `jumpIf` (extensible via commands.json)
- Labels: `name:` (global scope, forward refs allowed, private if starts with `_`)
- Expressions: Full infix with parens - `(a + b * c)`
- Operators: Arithmetic, bitwise, comparison, unary
- Pointers: `&ident` = address, `*expr` = deref (NOT C syntax - address-based)
- Preprocessor: `const NAME value`, `macro name $param ... endmacro`, `@include "file"`
- Custom commands: User-extensible via commands.json
- Comments: `# hello world`
- File name: `*.fx`

**Example:**
```
const MAX_HEALTH 100
const DAMAGE_FLAG 1

macro take_damage $amount
    add health, -$amount
    jumpIf health == 0, death
endmacro

start:
    set health, MAX_HEALTH
    set player_state, player_state & DAMAGE_FLAG
    take_damage 10
    goto start

death:
    call game_over
    ret
```

## Parser Requirements

**Must handle:**
- Table-driven operator precedence (never hardcode)
- `*` and `&` as both unary operators and part of command args (`set *a, &b`)
- Dynamic command registration (don't hardcode command names)
- Preprocessor runs before parsing (text substitution)
- Macros: literal text replacement of `$params`

**Preprocessor order:** includes → consts → macros → expansion → parse

## Architecture

**Use these patterns:**
- Visitor: AST traversal (highlighting, diagnostics, completion)
- Strategy: Operator handling (extensibility)
- Composite: Expression trees

**Avoid:**
- Factories for simple objects (`new Token(...)` is fine)
- Premature abstraction (`IAbstractTokenFactory`)
- Pattern stacking

**Code style:**
- Self-documenting names
- Comments only for non-obvious decisions
- OOP without over-abstraction

## Critical Pitfalls

1. **Operators**: Use precedence tables, unary ops bind tight
2. **Pointers**: `*` = deref, `&` = address (not C semantics, it's address arithmetic)
3. **Macros**: Text substitution happens pre-parse
4. **Labels**: Global scope, must be unique
5. **Commands vs identifiers**: Commands recognized by name first

## VSCode Features

**Implement:** Syntax highlighting, LSP, semantic tokens, completion
**Don't implement:** Runtime/debugging (that's Go's job)
**Don't modify:** Language behavior – match Go parser exactly

### Command Definition System

**Base commands:** Always loaded from `data/base-commands.json` (embedded in extension)
**User commands:** Loaded from `commands.json` in workspace root (if exists)

Format:
```json
{
  "commands": [
    {
      "name": "commandName",
      "args": [
        { "name": "argName", "type": "identifier|label|number" },
        { "name": "optArg", "type": "identifier", "optional": true }
      ]
    }
  ],
  "identifiers": [],
  "stringTags": []
}
```

- Args default to required unless `"optional": true`
- Both base and user commands available in completion/validation
- Extension structure: `data/base-commands.json` contains all built-in commands

### Highlighting Distinctions

**Different colors for:**
- Labels (`label:`) vs identifiers (`variable`)
- Macro calls vs command calls
- Control flow commands (`call`, `ret`, `goto`) vs other commands
- Built-in commands vs user-defined commands

### Language Features

**Include resolution:** Resolve `@include "file.fxs"` to workspace files

**Workspace-wide suggestions:** Suggest all labels/macros/consts from all files
- Don't process includes for suggestions
- Just scan all `.fxs` files in workspace

**Outline view:** Show all labels except private ones (private: starts with `_`)

**Goto definition:** Jump to definition for:
- Labels
- Macros
- Consts

### Project Setup

**Package manager:** pnpm
**Language:** TypeScript
**Build check:** `pnpm build` must succeed
**No tests:** Skip test implementation

## Testing Focus

- Operator precedence correctness
- Pointer/address disambiguation
- Macro expansion edge cases
- LSP protocol compliance
