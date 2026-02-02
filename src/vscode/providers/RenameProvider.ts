import * as vscode from 'vscode';
import { SymbolTable } from '../../core/SymbolTable';

export class RenameProvider implements vscode.RenameProvider {
  constructor(private symbolTable: SymbolTable) {}

  public async prepareRename(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): Promise<vscode.Range | { range: vscode.Range; placeholder: string } | undefined> {
    const range = document.getWordRangeAtPosition(position, /[@%$a-zA-Z0-9_-]+/);
    if (!range) {
        throw new Error("You cannot rename this element.");
    }

    const word = document.getText(range);

    // Check if it's a comment (not allowed unless it's a special @const comment)
    const lineText = document.lineAt(position.line).text;
    const commentIndex = lineText.indexOf('#');
    if (commentIndex !== -1 && position.character >= commentIndex) {
        // Only allow if it's the first word of the comment and followed by @const on next non-empty line
        const commentPart = lineText.substring(commentIndex + 1).trim();
        const firstWord = commentPart.split(/\s+/)[0];

        if (firstWord && word === firstWord) {
            // Check if there's an @const below
            let foundConst = false;
            for (let i = position.line + 1; i < document.lineCount; i++) {
                const nextLine = document.lineAt(i).text.trim();
                if (nextLine === "") continue;
                if (nextLine.startsWith('@const')) {
                    foundConst = true;
                }
                break;
            }
            if (foundConst) {
                return range;
            }
        }
        throw new Error("You cannot rename this element.");
    }

    return range;
  }

  public async provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
    _token: vscode.CancellationToken
  ): Promise<vscode.WorkspaceEdit | undefined> {
    const range = document.getWordRangeAtPosition(position, /[@%$a-zA-Z0-9_-]+/);
    if (!range) return undefined;

    let word = document.getText(range);
    const lineText = document.lineAt(position.line).text;
    const contextPrefix = this.symbolTable.getContextPrefix(document.uri, position);

    // Handle @const special comment rename
    const commentIndex = lineText.indexOf('#');
    if (commentIndex !== -1 && position.character >= commentIndex) {
        const commentPart = lineText.substring(commentIndex + 1).trim();
        const firstWord = commentPart.split(/\s+/)[0];
        if (firstWord && word === firstWord) {
             // This is the runtime name
             return this.performRename(word, newName);
        }
    }

    if (word.startsWith('$') && contextPrefix) {
        const fullName = `${contextPrefix}:${word}`;
        const argSymbols = this.symbolTable.getSymbols(fullName);
        if (argSymbols.length > 0) {
             // This is a macro argument
             return this.performRename(fullName, newName);
        }
    }

    // Normalize word
    if (word.endsWith(':')) {
        word = word.slice(0, -1);
    }

    let symbolName = word;

    // Local labels
    if (word.startsWith('%')) {
        const contextPrefix = this.symbolTable.getContextPrefix(document.uri, position);
        if (contextPrefix) {
            symbolName = `${contextPrefix}${word}`;
        } else {
            // Fallback: search for unique local name if no context found
            const allSymbols = this.symbolTable.getAllSymbols();
            const matching = allSymbols.filter(s => s.localName === word);
            if (matching.length === 1) {
                symbolName = matching[0].name;
            } else if (matching.length > 1) {
                 // Try to find the one in the current file
                 const currentFile = matching.find(s => s.uri.toString() === document.uri.toString());
                 if (currentFile) {
                     symbolName = currentFile.name;
                 }
            }
        }
    } else if (word.startsWith('$')) {
        // Macro argument
        const contextPrefix = this.symbolTable.getContextPrefix(document.uri, position);
        if (contextPrefix) {
            symbolName = `${contextPrefix}:${word}`;
        }
    } else if (lineText.trim().startsWith('@const')) {
        // Special case for @const lookup value rename
        const symbolsAtPosition = this.symbolTable.getAllSymbols().filter(s =>
            s.uri.toString() === document.uri.toString() &&
            s.range.contains(position) &&
            s.documentation?.startsWith('const ')
        );
        if (symbolsAtPosition.length > 0) {
            symbolName = symbolsAtPosition[0].name; // The value following @const
        }
    }

    return this.performRename(symbolName, newName);
  }

  private async performRename(symbolName: string, newName: string): Promise<vscode.WorkspaceEdit> {
    const edit = new vscode.WorkspaceEdit();

    const symbols = this.symbolTable.getSymbols(symbolName);
    const references = this.symbolTable.getReferences(symbolName);

    // If we're renaming a macro argument, the new name should keep the '$'
    let effectiveNewName = newName;
    if (symbolName.includes(':') && symbolName.split(':')[1].startsWith('$') && !newName.startsWith('$')) {
        effectiveNewName = '$' + newName;
    }
    // If we're renaming a local label, keep '%'
    if (symbolName.includes('%') && !newName.startsWith('%')) {
        const percentIndex = symbolName.indexOf('%');
        effectiveNewName = symbolName.substring(0, percentIndex) === "" ? '%' + newName : newName;
        if (symbolName.startsWith('%') && !newName.startsWith('%')) {
             effectiveNewName = '%' + newName;
        }
    }

    // Handle @const runtime name rename (needs to find the other symbol)
    // Actually, if we rename the runtime name, we need to update the documentation of the directive symbol
    // But since the documentation is not in the text, we don't need to update it in the workspace edit.
    // However, we should check if this symbol IS a runtime name for an @const

    for (const sym of symbols) {
        let range = sym.range;
        let text = effectiveNewName;

        // If it's a label definition, it might have a colon at the end of the token
        // and we want to preserve it if it's there.
        // The word range from getWordRangeAtPosition usually excludes the colon.
        // But our symbol range comes from the parser's token.
        // Let's check the document text at the end of the range.
        try {
            const symDoc = await vscode.workspace.openTextDocument(sym.uri);
            const rangeText = symDoc.getText(range);
            if (rangeText.endsWith(':') && !text.endsWith(':')) {
                text += ':';
            }
        } catch (e) {
            // Ignore if document cannot be opened
        }

        edit.replace(sym.uri, range, text);
    }

    for (const ref of references) {
        edit.replace(ref.uri, ref.range, effectiveNewName);
    }

    return edit;
  }
}
