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
const backendMainPath = join(rootPath, 'src', 'main.mo');
const backendMainUri = URI.file(backendMainPath).toString();
const testMainPath = join(rootPath, 'src', 'test.mo');
const testMainUri = URI.file(testMainPath).toString();

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

    test('backend canister has per-file --enhanced-migration flag', () => {
        const ctx = getContext(backendMainUri);
        const flags = ctx.perFileFlags.get(backendMainUri);
        expect(flags).toBeDefined();
        expect(flags!.some((f) => f.startsWith('--enhanced-migration='))).toBe(
            true,
        );
    });

    test('canister has no per-file flags', () => {
        const ctx = getContext(testMainUri);
        const flags = ctx.perFileFlags.get(testMainUri);
        expect(flags).toBeUndefined();
    });

    test('canister compiles without errors', async () => {
        const textDocuments = new Map<string, TextDocument>();

        const diagsPromise = waitForDiagnostics(client, testMainUri);
        await openTextDocuments(client, textDocuments, rootUri, [testMainUri]);
        const diags = await diagsPromise;

        const errors = diags.filter((d) => d.severity === 1);
        expect(errors).toHaveLength(0);
    });

    test('backend main.mo compiles without errors', async () => {
        const textDocuments = new Map<string, TextDocument>();

        const diagsPromise = waitForDiagnostics(client, backendMainUri);
        await openTextDocuments(client, textDocuments, rootUri, [
            backendMainUri,
        ]);
        const diags = await diagsPromise;

        const errors = diags.filter((d) => d.severity === 1);
        expect(errors).toHaveLength(0);
    });
});
