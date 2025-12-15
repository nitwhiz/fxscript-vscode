# Arena MoveScript (VS Code)

This VS Code extension adds language support for Arena MoveScript files (`*.ms`).

## Generate MoveScript data

`data/movescript.json` is generated from the Go sources in `example/golang/`.

Generate it with:

```
node scripts/generate-movescript-json.js example/golang
```

The generator reads `parser_defines_lookup.go` and `runtime.go` and writes `data/movescript.json`.

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
