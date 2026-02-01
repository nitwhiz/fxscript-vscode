### FXScript Language VSCode Extension Guidelines

Guidelines for implementing a VSCode extension for FXScript, a line-based, case-sensitive assembly-like scripting language for mission logic.

### 1. Language Overview

FXScript is characterized by its instruction-oriented syntax, supporting macros, includes, and a set of operators for constant and variable manipulation.

- **File Extension**: `.fx`
- **Comments**: Initiated with `#`. Comments can be full-line or trailing.
- **Include Mechanism**: `@include filename.fx`
    - C-style textual inclusion (replaced with file content).
    - Path resolution should be relative to the current file.
    - **Symbol Discovery**: Since the entry file may not be known, symbols should be indexed workspace-wide regardless of includes.
- **Constants & Variables**:
    - `var name`: Declares a variable (memory location). Cannot be redeclared.
    - `const name <expression>`: Defines a standard constant. Tokens are replaced on usage; value cannot change.
    - `@const name`: External/Special constants (Const Lookups).
        - Highlighting only (no deep parsing required).
        - **Value Format**: The value following `@const` can be any string (e.g., `name:value` or just `value`). The colon in `name:value` is just an example and is not part of the specification.
        - **Documentation Rule**: If a `@const` is preceded by a comment on the line immediately above, the first word of that comment is the name this `@const` will be represented as at runtime. Ignore everything else in the comment.
        - *Example:*
          ```fx
          # MOVE_DIG
          @const move:dig
          ```
          (Renders as `const MOVE_DIG` at runtime).
- **Labels**:
    - **Global Labels**: `LabelName:` (Definition) or `LabelName` (Usage).
    - **External Labels**: Global labels starting with an underscore (e.g., `_ExternalLabel`). These are treated as normal global labels but are not suggested during code completion.
    - **Local Labels**: `%_LocalLabel:`.
        - Valid anywhere but typically used in macros or subroutines.
        - **Resolved Name**: 
            - In a macro body: Prefixed with the macro name.
            - Outside a macro: Prefixed by the last global label encountered.
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
    - `commandName arg1, arg2, ...` (Arguments are always separated by commas).
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

```
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
```
const fStatusSleep      1 << 0
const fStatusBurn       1 << 3
const fStatusCombined   (fStatusSleep | fStatusBurn)
```

### 4. Core Extension Requirements

#### Technical Stack
- **Language**: TypeScript.
- **Architecture**: VSCode Extension API. 
    - A **Language Server (LSP)** is the preferred way to handle workspace-wide indexing and complex symbol resolution while keeping the UI thread responsive.
    - If an LSP is deemed too heavy for initial development, the extension must still be structured such that the logic (parsing, indexing) is decoupled from the VSCode-specific glue code (providers).

#### Symbol Navigation & Workspace Scope
- **Global Indexing**: All symbols (labels, vars, consts, macros) must be indexed across the entire workspace. This index should be incrementally updated.
- **Resolution**: A symbol usage should resolve to its definition even if they are in different files not explicitly linked by `@include`.
- **Features**: Go to Definition, Find Usages, Symbol Rename, and Workspace Symbol search.

#### Code Completion & Validation
- **Context-Aware Suggestions**:
    - Suggest `label` names only for arguments of type `label` (e.g., `goto`, `call`).
    - Exclude "external" labels (non-local labels starting with `_`) from suggestions.
    - Suggest `var`, `const` and global `identifiers` (predefined in the runtime, loaded from `commands.json`) for `identifier` types.
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

#### Common Pitfalls & Edge Cases
- **Case Sensitivity**: All keywords, commands, and identifiers are case-sensitive.
- **Symbol Shadowing**: Local labels (`%_name`) are scoped to the last global label or macro. Ensure the indexer correctly prefixes them to avoid collisions.
- **Circular Includes**: Prevent infinite loops in the `@include` resolver.
- **Expression Complexity**: Expressions can be nested and contain any combination of operators. Use a proper precedence-based parser.
- **Dynamic Commands**: `commands.json` can change. The LSP must re-validate the entire workspace when this happens, as new commands might make previously invalid lines valid (or vice versa).
- **Argument Types in `commands.json`**: Arguments are objects with a key (name) and a value (object with a `type` property). Supported types: `identifier`, `label`, `number`, `string`.

### 7. Agent Remarks & Architectural Roadmap

To ensure the extension is well-written, extensible, and maintainable, I propose the following architectural approach:

#### Structural Decoupling
- **`src/core`**: Contains the pure logic for FXScript.
    - `Lexer`: Tokenizes the input stream.
    - `Parser`: Builds an Abstract Syntax Tree (AST) or a simplified Instruction Map. 
    - `ExpressionEvaluator`: Logic for evaluating constant expressions.
    - `SymbolTable`: Manages the scope and resolution of symbols (vars, consts, labels, macros).
- **`src/workspace`**: Manages the global state.
    - `WorkspaceIndexer`: Scans the workspace, watches for file changes, and updates the global `SymbolTable`.
    - `CommandRegistry`: Loads and watches `commands.json`.
- **`src/vscode`**: VSCode-specific implementation.
    - `Extension.ts`: Entry point.
    - `providers/`: Concrete implementations of `CompletionItemProvider`, `DefinitionProvider`, etc., which delegate to the `core` and `workspace` modules.

#### Phased Implementation
1. **Foundation**: Implement the `Lexer` and `CommandRegistry`. Set up basic TextMate syntax highlighting.
2. **Indexing**: Implement the `WorkspaceIndexer` and a basic `Parser` that only identifies symbol definitions and `@include`s. This enables Go to Definition and Workspace Symbols.
3. **Semantic Analysis**: Enhance the `Parser` and implement `ExpressionEvaluator`. This enables validation (diagnostics) and context-aware completion.
4. **Refinement**: Implement Symbol Rename and Find Usages using the established `SymbolTable`.

#### Why this matters
By separating the `core` logic from the `vscode` API, we achieve:
- **Testability**: The parser and expression logic can be tested with standard unit tests without mocking the VSCode API.
- **LSP Readiness**: If we decide to move to a full LSP later, the `core` and `workspace` logic can be easily moved to the server process.
- **Maintainability**: Changes to the FXScript language (new operators, macro syntax) only affect the `core` module, while VSCode-specific bugs only affect the `vscode` module.

#### Constraint
- Never modify files in the `examples/` directory.
