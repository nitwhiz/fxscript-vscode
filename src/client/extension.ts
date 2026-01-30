import * as path from 'path';
import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
    console.log('FXScript extension is now active!');
    
    let serverModule = context.asAbsolutePath(path.join('out', 'server', 'server.js'));
    console.log(`Server module path: ${serverModule}`);
    let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    let serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };

    let clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'fxscript' }],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/commands.json')
        }
    };

    client = new LanguageClient(
        'fxscriptLanguageServer',
        'FXScript Language Server',
        serverOptions,
        clientOptions
    );

    client.start().catch(err => {
        vscode.window.showErrorMessage(`Failed to start FXScript Language Server: ${err}`);
    });
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
