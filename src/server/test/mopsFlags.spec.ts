import { URI } from 'vscode-uri';
import { join } from 'node:path';
import { cwd } from 'node:process';
import {
    TextDocument,
    defaultBeforeAll,
    defaultAfterAll,
    openTextDocuments,
    waitForDiagnostics,
    waitForNotification,
} from './helpers';
import { Connection, DiagnosticSeverity } from 'vscode-languageserver';
import { configParams } from './mock';

jest.setTimeout(30000);

async function initWorkspace(rootUri: URI): Promise<[Connection, Connection]> {
    const [client, server] = await defaultBeforeAll(rootUri, true, {
        useDefaultMocJs: true,
    });
    await client.sendNotification(
        'workspace/didChangeConfiguration',
        configParams,
    );
    await waitForNotification('custom/initialized', client);
    return [client, server];
}

async function openAndGetDiagnostics(
    client: Connection,
    textDocuments: Map<string, TextDocument>,
    rootUri: URI,
    file: string,
) {
    const fileUri = URI.parse(join(rootUri.fsPath, file)).toString();
    await openTextDocuments(client, textDocuments, rootUri, [fileUri]);
    return waitForDiagnostics(client, fileUri);
}

describe('mops.toml [moc].args flags', () => {
    describe('valid flags from mops.toml', () => {
        const rootUri = URI.parse(join(cwd(), 'test', 'mopsFlags'));
        let client: Connection;
        let server: Connection;
        const textDocuments = new Map<string, TextDocument>();

        beforeAll(async () => {
            [client, server] = await initWorkspace(rootUri);
        });

        afterAll(async () => {
            await defaultAfterAll(client, server);
        });

        test('M0154 is treated as error via mops.toml [moc].args', async () => {
            const diags = await openAndGetDiagnostics(
                client,
                textDocuments,
                rootUri,
                'deprecated.mo',
            );
            expect(diags).toHaveLength(1);
            expect(diags[0].severity).toBe(DiagnosticSeverity.Error);
        });
    });

    describe('mixed valid and unsupported flags', () => {
        const rootUri = URI.parse(join(cwd(), 'test', 'mopsFlagsMixed'));
        let client: Connection;
        let server: Connection;
        const textDocuments = new Map<string, TextDocument>();

        beforeAll(async () => {
            [client, server] = await initWorkspace(rootUri);
        });

        afterAll(async () => {
            await defaultAfterAll(client, server);
        });

        test('valid flag still applies when mixed with unsupported flag', async () => {
            const diags = await openAndGetDiagnostics(
                client,
                textDocuments,
                rootUri,
                'deprecated.mo',
            );
            expect(diags).toHaveLength(1);
            expect(diags[0].severity).toBe(DiagnosticSeverity.Error);
        });
    });
});
