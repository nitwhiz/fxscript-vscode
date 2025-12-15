# Arena MoveScript (VS Code)

This VS Code extension adds language support for Arena MoveScript files (`*.ms`).

## Generate MoveScript data

`data/movescript.json` is generated from the Go sources.

Generate it with:

```
node scripts/generate-movescript-json.js <path/to/runtime.go> <path/to/parser_defines_lookup.go> <path/to/logger_tags.go>
```

The generator reads:
- `runtime.go` (interfaces and doc comments for commands and their args)
- `parser_defines_lookup.go` (maps of commands/flags/identifiers/variables)
- `logger_tags.go` (const ( ... ) block listing allowed logger tag values)

It writes `data/movescript.json` including commands, flags, identifiers, variables, and `string_tags`.

## Build / Run

Prerequisites: Node.js LTS and pnpm.

```
pnpm install
pnpm watch
```

Press F5 in VS Code to launch the Extension Development Host.

## Package

Create a VSIX package:

```
pnpm package
```

Install the built VSIX locally:

```
pnpm run vscode:install
```
