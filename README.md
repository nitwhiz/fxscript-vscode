# FXScript (VS Code)

This VS Code extension adds language support for FXScript files (`*.fx`). It's 99.9% vibe coded.

## Generate FXScript data

`data/fxscript.json` is generated from the Go sources.

Generate it with:

```
node scripts/generate-fxscript-json.js <path/to/env.go> <path/to/fxscript_defines_lookup.go> <path/to/logger_tags.go>
```

The generator reads:
- `env.go` (interfaces and doc comments for commands and their args)
- `fxscript_defines_lookup.go` (maps of commands/flags/identifiers/variables)
- `logger_tags.go` (const ( ... ) block listing allowed logger tag values)

It writes `data/fxscript.json` including commands, flags, identifiers, variables, and `string_tags`.

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
