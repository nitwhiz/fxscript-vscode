import * as vscode from 'vscode';

export type ArgType = 'label' | 'string' | 'number' | 'flag' | 'identifier' | 'variable';

export interface ArgSpec {
  name: string;
  type?: ArgType;
  optional?: boolean;
}

export interface CommandSpec {
  name: string;
  args?: ArgSpec[];
  detail?: string;
}

export interface FXScriptConfig {
  commands: CommandSpec[];
  flags: string[];
  identifiers: string[];
  variables: string[];
  string_tags?: string[];
  tags?: string[];
}

export type ConstType = 'string' | 'number' | 'unknown';

export interface LabelDef {
  name: string;
  uri: vscode.Uri;
  range: vscode.Range;
  documentation?: string;
}

export interface ConstDef {
  name: string;
  uri: vscode.Uri;
  range: vscode.Range;
}

export interface MacroDef {
  name: string;
  uri: vscode.Uri;
  range: vscode.Range;
  documentation?: string;
}
