# Arena MoveScript (VS Code)

This extension adds basic language support for the Arena MoveScript files (`*.ms`).

## Usage

Open a MoveScript project (see `example/` for a sample). Files with the `.ms` extension will be recognized automatically.

Completions will show when you start typing, especially at the start of a line. Constants, labels, and macros are always suggested.

## Extending the commands list

Edit `data/commands.json`. Each entry has:

```
{ "name": "set", "args": ["identifier", "value"] }
```

`detail` is optional and should be used sparingly (only for unusual commands). When present, it will show in the completion menu. `args` are used to show simple argument name hints.

## Build / Run

Prerequisites: Node.js LTS.

```
pnpm install
pnpm watch
```

Press F5 in VS Code to launch the extension host with the extension loaded.

To package:

```
pnpm build
pnpm package
```

## Language summary

- Preprocessor: `@include <file>` (simple textual include)
- Commands: `set`, `clearFlag`, `moveEnd`, … (list is extendable)
- Macros: `macro NAME` … `endmacro` (invoked like a command; content is expanded)
- Strings (double-quoted), floats, ints
- Labels: `name:`
- Functions: `call`, `ret`
- `goto`
- Comments with `#`
- `const NAME value`
