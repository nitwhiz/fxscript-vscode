# Arena MoveScript (VS Code)

This VS Code extension adds language support for Arena MoveScript files (`*.ms`). This is vibe coded.

## Configure MoveScript data

Edit `data/movescript.json`. Schema:

```
{
  "commands": [
    { "name": "set" },
    { "name": "goto" }
    // Optional: you may also include "detail": "…" per command to show extra help on hover/completion
    // Optional: you may include "args": [] to explicitly disable argument suggestions for that command
    // Optional: if you provide typed args, they enable type-aware suggestions (see below)
  ],
  "flags": [
    "moveMissed", "secondTurn", "moveLocked"
  ],
  "identifiers": [
    "attacker", "defender", "statAttack"
  ],
  "variables": [
    "multiHitCounter", "sourceFlags", "targetFlags"
  ]
}
```

Typed args (optional, per command) enable stricter argument suggestions and richer signature help:

```
{ "name": "goto", "args": [ { "name": "label", "type": "label" } ] }
{ "name": "setFlag", "args": [ { "name": "dst" }, { "name": "flag", "type": "flag" } ] }
{ "name": "stat", "args": [ { "name": "id", "type": "identifier" }, { "name": "delta", "type": "number" } ] }
```

If `args` is omitted for a command, argument completions show “all things”. If `args` is an empty array, argument completions are suppressed for that command.

## Usage

Open a MoveScript project (see `example/` for a sample). Files with the `.ms` extension are recognized automatically.

Tips:
- Suggestions only show when the line is indented.
- Constants are suggested by type (string/number) when relevant.
- Labels are suggested where appropriate and can be navigated with F12/Shift+F12.

## Build / Run

Prerequisites: Node.js LTS and pnpm.

```
pnpm install
pnpm watch
```

Press F5 in VS Code to launch the Extension Development Host.

## Package

Build and create a VSIX with a stable filename:

```
pnpm build
pnpm dlx @vscode/vsce package -o arena-movescript.vsix
```

You can also run:

```
pnpm run package
```

…and install locally with:

```
pnpm run vscode:install
```
