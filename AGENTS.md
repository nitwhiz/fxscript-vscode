### FXScript Language VSCode Extension Guidelines

Guidelines for implementing a VSCode extension for FXScript, a line-based, case-sensitive assembly-like scripting language for mission logic.

### 1. Language Overview

FXScript is characterized by its simple, instruction-oriented syntax, supporting macros, includes, and a set of operators for constant and variable manipulation.

- **File Extension**: `.fx`
- **Comments**: Initiated with `#`. Comments can be full-line or trailing.
- **Include Mechanism**: `@include filename.fx`
    - C-style textual inclusion.
    - Path resolution should be relative to the current file.
- **Constants & Variables**:
    - `var name`: Declares a variable.
    - `const name <expression>`: Defines a standard constant. The expression is evaluated at runtime.
    - `@const name:value`: External/Special constants.
        - Highlighting only (no deep parsing required).
        - **Documentation Rule**: If a `@const` is preceded by a comment, the first word of that comment is the name this `@const` will be represented as at runtime.
        - *Example:*
          ```fx
          # MOVE_DIG
          @const move:dig
          ```
          (Renders as `const MOVE_DIG` at runtime).
- **Labels**:
    - **Global Labels**: `LabelName:` (Definition) or `LabelName` (Usage).
    - **Local Labels**: `%_LocalLabel:`.
        - Valid anywhere but typically used in macros or functions.
        - **Resolved Name**: They are prefixed by the last global label or the containing macro name.
        - *Recommendation*: Show the fully qualified name in tooltips.
- **Macros**:
    - **Definition**:
      ```fx
      macro MacroName $arg1, $arg2, ...
          # Body
      endmacro
      ```
    - **Calls**: Look like standard commands: `MacroName value1, value2`.
- **Commands**:
    - `commandName arg1, arg2, ...`
    - **Base Commands**: `set`, `goto`, `call`, `ret`, `jumpIf`.
    - **Custom Commands**: Dynamically loaded from `commands.json`.

### 2. Expressions & Operators

FXScript supports expressions for constants and instruction arguments.

| Category | Operators |
| :--- | :--- |
| **Arithmetic** | `+`, `-`, `*`, `/` |
| **Bitwise** | `&` (AND), `\|` (OR), `^` (XOR), `~` (NOT), `<<` (LSHIFT), `>>` (RSHIFT) |
| **Comparison** | `==`, `!=`, `<`, `>`, `<=`, `>=` |
| **Logical** | `!` (NOT) |
| **Grouping** | `(` , `)` |

### 3. Sophisticated Examples

#### Local Labels & Macros
Macros often use local labels to avoid collisions when called multiple times.

```fx
macro Canceler
    # Jump to local label if certain flags are set
    jumpIf moveResult & (fTurnCanceled | fMoveMissed), %_cancel
    goto %_continue

%_cancel:
    goto End  # Global jump

%_continue:
    # Macro continues here
endmacro

Main:
    Canceler  # First call
    # ... code ...
    Canceler  # Second call: %_cancel internally differentiates from the first
```

#### Expressions in Constants
```fx
const fStatusSleep      1 << 0
const fStatusBurn       1 << 3
const fStatusCombined   (fStatusSleep | fStatusBurn)
```

### 4. Core Extension Requirements

#### Technical Stack
- **Language**: TypeScript.
- **Architecture**: VSCode Extension API. A Language Server (LSP) is strongly recommended to handle workspace-wide indexing and complex symbol resolution.

#### Symbol Navigation & Workspace Scope
- **Global Indexing**: All symbols (labels, vars, consts, macros) must be indexed across the entire workspace.
- **Resolution**: A symbol usage should resolve to its definition even if they are in different files not explicitly linked by `@include` (the compiler handles global scope).
- **Features**: Go to Definition, Find Usages, Symbol Rename, and Workspace Symbol search.

#### Code Completion & Validation
- **Context-Aware Suggestions**:
    - Suggest `label` names only for arguments of type `label` (e.g., `goto`, `call`).
    - Suggest `var` and `const` for `identifier` types.
    - Suggest files for `@include`.
- **Validation**:
    - Flag missing symbols.
    - Type check arguments (`identifier`, `label`, `number`, `string`).
    - Validate expression syntax and macro closure (`endmacro`).

#### Dynamic Configuration
- Watch `commands.json` in the workspace root.
- Update syntax highlighting and validation rules immediately upon changes to `commands.json`.

### 5. Implementation Guidelines

To ensure the extension is maintainable and scalable, follow these architectural principles:

- **Modular Design**: Do NOT write a single-file "god object" extension. 
    - Separate the **Lexer/Parser** logic.
    - Separate **Workspace Indexing**.
    - Separate **Command Loading** (from `commands.json`).
    - Separate **Feature Providers** (Completion, Definition, Hover).
- **Extensibility**:
    - Use a formal grammar (e.g., TextMate `.tmLanguage.json`) for basic highlighting.
    - Use a robust parser for the LSP to handle semantic highlighting and validation.
- **Reference-First**: The Go implementation at `~/dev/fxscript` (or `github.com/nitwhiz/fxscript`) is the source of truth. Mirror its logic for expression evaluation and symbol resolution.

### 6. Technical Implementation Details

#### Expected Project Structure
- `src/`: TypeScript source code.
    - `lexer/`: Lexer implementation.
    - `parser/`: Recursive descent or similar parser for expressions and instructions.
    - `index/`: Workspace-wide symbol indexer.
    - `lsp/`: Language Server implementation and providers.
- `syntaxes/`: TextMate grammar files (`.tmLanguage.json`).

#### Common Pitfalls & Edge Cases
- **Case Sensitivity**: All keywords, commands, and identifiers are case-sensitive.
- **Symbol Shadowing**: Local labels (`%_name`) are scoped to the last global label or macro. Ensure the indexer correctly prefixes them to avoid collisions.
- **Circular Includes**: Prevent infinite loops in the `@include` resolver.
- **Expression Complexity**: Expressions can be nested and contain any combination of operators. Use a proper precedence-based parser.
- **Dynamic Commands**: `commands.json` can change. The LSP must re-validate the entire workspace when this happens, as new commands might make previously invalid lines valid (or vice versa).

#### Constraint
- Never modify files in the `examples/` directory.
