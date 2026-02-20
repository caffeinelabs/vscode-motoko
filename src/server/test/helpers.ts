import { Connection, Diagnostic } from 'vscode-languageserver/node';
import { InitializeResult } from 'vscode-languageclient/node';
import { URI } from 'vscode-uri';
import { clientInitParams, setupClientServer } from './mock';
import * as fs from 'node:fs';
import { join } from 'node:path';

export type TextDocument = {
    uri: string;
    version: number;
    text: string;
    languageId: string;
};

export const wait = (s: number) =>
    new Promise((resolve) => setTimeout(resolve, s * 1000));

export function waitForNotification<T>(
    name: string,
    conn: Connection,
): Promise<T> {
    return new Promise<T>((resolve) => {
        conn.onNotification(name, (message: T) => {
            resolve(message);
        });
    });
}

/**
 * Waits for diagnostics to be published for a specific document URI.
 * Set up the listener BEFORE triggering document changes.
 */
export function waitForDiagnostics(
    client: Connection,
    uri: string,
    timeout: number = 10000,
): Promise<Diagnostic[]> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            disposable.dispose();
            reject(new Error(`Timeout waiting for diagnostics for ${uri}`));
        }, timeout);
        const disposable = client.onNotification(
            'textDocument/publishDiagnostics',
            (params: { uri: string; diagnostics: Diagnostic[] }) => {
                if (params.uri === uri) {
                    clearTimeout(timer);
                    disposable.dispose();
                    resolve(params.diagnostics);
                }
            },
        );
    });
}

export function makeTextDocument(
    rootUri: URI,
    file: string,
    version: number = 1,
): TextDocument {
    const uri = join(rootUri.fsPath, file);
    return {
        uri: URI.parse(uri).toString(),
        version,
        text: fs.readFileSync(uri, 'utf-8'),
        languageId: 'motoko',
    };
}

export async function runTest<T>(
    rootUri: URI,
    test: (client: Connection) => Promise<T>,
    redirectConsole: boolean = true,
    initializationOptions?: Record<string, unknown>,
): Promise<T> {
    const [client, server] = setupClientServer(redirectConsole);
    try {
        const serverInitialized = waitForNotification(
            'custom/initialized',
            client,
        );
        await client.sendRequest<InitializeResult>(
            'initialize',
            clientInitParams(rootUri, initializationOptions),
        );
        await client.sendNotification('initialized', {});
        await serverInitialized;
        return await test(client);
    } finally {
        await defaultAfterAll(client, server);
    }
}

// Use if you don't care about having server state between tests.
export async function defaultBeforeAll(
    rootUri: URI,
    redirectConsole: boolean = true,
    initializationOptions?: Record<string, unknown>,
): Promise<[Connection, Connection]> {
    const [client, server] = setupClientServer(redirectConsole);

    const serverInitialized = waitForNotification('custom/initialized', client);

    await client.sendRequest<InitializeResult>(
        'initialize',
        clientInitParams(rootUri, initializationOptions),
    );

    await client.sendNotification('initialized', {});

    await serverInitialized;

    return [client, server];
}

export async function defaultAfterAll(
    client: Connection,
    server: Connection,
): Promise<void> {
    try {
        await client.sendRequest('shutdown');
    } finally {
        client.dispose();
        server.dispose();
    }
}

export async function openTextDocuments(
    client: Connection,
    textDocuments: Map<string, TextDocument>,
    rootUri: URI,
    uris: string[],
): Promise<void> {
    await Promise.all(
        uris.map(async (uri) => {
            if (!textDocuments.has(uri)) {
                const textDocument = await openTextDocument(
                    client,
                    rootUri,
                    uri,
                );
                textDocuments.set(uri, textDocument);
            }
        }),
    );
}

export async function openTextDocument(
    client: Connection,
    rootUri: URI,
    uri: string,
): Promise<TextDocument> {
    const basename = uri.startsWith(rootUri.toString())
        ? uri.slice(rootUri.toString().length)
        : uri;
    const textDocument = makeTextDocument(rootUri, basename);
    await client.sendNotification('textDocument/didOpen', {
        textDocument,
    });
    return textDocument;
}
