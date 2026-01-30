### FXScript Language VSCode Extension Guidelines

Guidelines for implementing a VSCode extension for FXScript, an asm-ish scripting language for missions.

### Language Overview
FXScript is a line-based, case-sensitive assembly-like language.
- **File Extension**: `.fx`
- **Comments**: Not explicitly shown in all examples but typically `#` or `;`. (Based on `main.fx:14`, `#` is used for comments).
- **Include Mechanism**: `@include filename.fx` (C-style include - is replaced with the file content).
- **Constants & Variables**:
    - `@const name:value` (External/Special constants, will be looked up by a custom function on script load - just highlight this in a proper way, don't 
      parse it further). If it has a comment behind it, the first word of the comment is the name this `@const` will render at runtime as a `const`. E.g. `@const move:mything # MOVE_MYTHING` renders `const MOVE_MYTHING`.
    - `const name value` (Standard constants, value can be an expression – evaulated at runtime, not before).
    - `var name` (Variable declaration).
- **Labels**:
    - `LabelName:` (Definition).
    - `%_LocalLabel:` (Local labels, usually within macros or functions, generally valid syntax everywhere, they take the last label or their containing 
      macro as prefix (but not labels within macros) – showing the user the actual label name in a tooltip would be nice).
- **Macros**:
    - `macro Name $arg1, $arg2 ...`
    - `... body ...`
    - `endmacro`
    - Macro calls look like command calls.
- **Commands**:
    - `commandName arg1, arg2, ...`
    - Base commands (like `set`, `goto`, `call`, `ret`, `jumpIf`) are built-in.
    - Custom commands are loaded from `commands.json`.
- **Expressions**:
    - Full expression support: `+`, `-`, `*`, `/`, `&`, `|`, `^`, `<<`, `>>`, `==`, `!=`, `<`, `>`, `<=`, `>=`, `!`, `~`.
    - Parentheses for grouping.

### Core Extension Requirements

#### 0. Technical Stack

- **Language**: TypeScript
- **Platform**: VSCode Extension API
- **Optional**: Language Server Protocol (LSP) for advanced features (recommended for global symbol indexing).

#### 1. Syntax Highlighting

- **Keywords**: `macro`, `endmacro`, `const`, `var`, `@include`, `@const`.
- **Built-in Commands**: `set`, `goto`, `call`, `ret`, `jumpIf`, and any other base commands from Go source.
- **Custom Commands & Macros**: Highlighted the same as built-in commands.
- **Labels**: Definitions (`LabelName:`) and usages (in `goto`, `call`, `jumpIf`).
- **Identifiers**: Variables and constants.
- **Literals**: Numbers (decimal, hex `0x`, binary `0b`), Strings (if applicable).
- **Comments**: `#` comments.

#### 2. Navigation & Symbols

- **Label Navigation**: 
    - Go to definition from usage.
    - Find usages from definition.
- **Variable/Const Navigation**:
    - Go to definition from usage.
    - Find usages from definition.
- **Include Navigation**:
    - Clicking/Ctrl-clicking on the filename in `@include "file.fx"` should navigate to that file.
- **Workspace Scope**: All symbols (labels, vars, consts, macros) in the workspace should be available globally for resolution and suggestions, regardless of `@include` hierarchy.

#### 3. Code Completion & Suggestions

- **Commands & Macros**: Suggest built-in, custom, and user-defined macros.
- **Labels**: Suggest defined labels when the argument type is `label`. Do NOT suggest labels for `number` types.
- **Variables & Consts**: Suggest defined variables and constants for `identifier` types.
- **Include Files**: Suggest `.fx` files in the workspace for `@include`.

#### 4. Error Checking & Validation

- **Missing Symbols**: Flag missing commands, labels, variables, or constants.
- **Argument Types**:
    - `identifier`: Accepts variable names, constant names, or complete expressions.
    - `label`: Accepts label names.
    - `number`: Accepts numeric literals or expressions (no labels).
    - `string`: Accepts string literals.
- **Syntax Errors**: Invalid expression syntax, unclosed macros, missing `endmacro`, etc.
- **Commands.json**: 
    - Read from the workspace root.
    - Dynamically update highlighting and validation when `commands.json` changes.

#### 5. Extensibility

- Design the grammar and parser to be easily readable and maintainable.
- Avoid "one-off" solutions. Use proper grammar files or a Language Server (LSP) if possible.
- Reconstruct base command argument types from the provided Go source (`~/dev/fxscript` or github.com/nitwhiz/fxscript).

### Reference Implementation Details (from Go source)

- **Base Commands**: 
    - `set <target:identifier>, <value:identifier>`
    - `goto <target:label>`
    - `call <target:label>`
    - `ret`
    - `jumpIf <condition:identifier>, <target:label>`
    - (Verify others from repo).
- **Pointer Syntax**: If an argument type is `identifier`, it allows any expression. This implies identifiers can be resolved to values or used as pointers depending on the command context.

### Development Workflow

- **Never modify anything in the `examples/` directory.**
0. **Reference Implementation**: Use the Go implementation at `~/dev/fxscript` as the source of truth for lexing, parsing, and preprocessor logic.
1. **Setup Project**: Initialize a TypeScript-based VSCode extension project (using `yo code` or similar).
2. **Analyze `commands.json`**: Ensure it is the source of truth for custom commands.
3. **Reconstruct Grammar**: Use the Go implementation as the reference for the lexer and parser logic.
4. **Global Index**: Implement a Symbol Index or Language Server (LSP) in TypeScript to provide workspace-wide symbol resolution.
5. **Dynamic Refresh**: Listen for changes to `commands.json` and trigger a re-highlighting/re-parsing of `.fx` files.
6. **Testing**: There should be a npm script to start a VSCode instance (sandbox-ish?) with the latest extension build loaded and the examples/script folder 
   opened. The vscode binary should be configurable, this will be developed on mac and linux.
   Ensure the extension is compiled before running (e.g., `npm run compile && code ...`).
