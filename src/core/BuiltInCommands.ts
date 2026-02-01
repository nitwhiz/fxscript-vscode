export interface BuiltInCommand {
  name: string;
  argCount: number;
}

export const BUILT_IN_COMMANDS: { [name: string]: BuiltInCommand } = {
  'set': { name: 'set', argCount: 2 },
  'goto': { name: 'goto', argCount: 1 },
  'call': { name: 'call', argCount: 1 },
  'ret': { name: 'ret', argCount: 0 },
  'exit': { name: 'exit', argCount: 0 },
  'jumpIf': { name: 'jumpIf', argCount: 2 },
  'push': { name: 'push', argCount: 1 },
  'pop': { name: 'pop', argCount: 1 },
};

export function isBuiltInCommand(name: string): boolean {
  return name in BUILT_IN_COMMANDS;
}

export function getBuiltInCommandNames(): string[] {
  return Object.keys(BUILT_IN_COMMANDS);
}
