# FXScript (VS Code)

This VS Code extension adds language support for FXScript files (`*.fx`). It's 99.9% vibe coded.

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
