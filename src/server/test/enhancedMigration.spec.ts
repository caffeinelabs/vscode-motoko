import { URI } from 'vscode-uri';
import { join } from 'node:path';
import { cwd } from 'node:process';
import {
    TextDocument,
    defaultBeforeAll,
    defaultAfterAll,
    openTextDocuments,
    waitForDiagnostics,
} from './helpers';
import { Connection } from 'vscode-languageserver';
import { getContext } from '../context';

const rootPath = join(cwd(), 'test', 'enhancedMigration');
const rootUri = URI.parse(rootPath);

jest.setTimeout(60000);

describe('enhanced migration', () => {
    let client: Connection;
    let server: Connection;

    beforeAll(async () => {
        [client, server] = await defaultBeforeAll(rootUri, true, {
            useDefaultMocJs: true,
        });
    });

    afterAll(async () => {
        await defaultAfterAll(client, server);
    });

    test('--enhanced-migration flag is loaded from mops.toml', () => {
        const context = getContext(rootUri.toString());
        expect(context.mopsArgs).toContain('--enhanced-migration=migrations');
    });

    test('Main.mo compiles without errors using migration-provided fields', async () => {
        const textDocuments = new Map<string, TextDocument>();
        const filePath = join(rootPath, 'Main.mo');
        const fileUri = URI.parse(filePath).toString();

        const diagsPromise = waitForDiagnostics(client, fileUri);
        await openTextDocuments(client, textDocuments, rootUri, [fileUri]);
        const diags = await diagsPromise;

        const errors = diags.filter((d) => d.severity === 1);
        expect(errors).toHaveLength(0);
    });
});
