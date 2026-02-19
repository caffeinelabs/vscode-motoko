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
import * as fs from 'fs';
import { settings } from '../globals';

const rootPath = join(cwd(), 'test', 'requestMocJs');
const rootUri = URI.parse(rootPath);

jest.setTimeout(60000);

describe('request moc.js', () => {
    describe('download moc.js', () => {
        let client: Connection;
        let server: Connection;

        const mocPath = join(
            cwd(),
            'src',
            'server',
            'compiler',
            'moc-0.16.3.js',
        );

        beforeAll(async () => {
            [client, server] = await defaultBeforeAll(rootUri, true);
        });

        afterAll(async () => {
            fs.rmSync(mocPath);
            await defaultAfterAll(client, server);
        });

        test('Language server uses correct motoko compiler version', () => {
            const context = getContext(rootUri.toString());
            expect(context.mocJsInfo.version).toBe('0.16.3');
        });

        test('Moc.js has been downloaded', () => {
            expect(fs.existsSync(mocPath)).toBe(true);
        });

        test('Diagnostics work with downloaded moc.js', async () => {
            const textDocuments = new Map<string, TextDocument>();
            const filePath = join(rootPath, 'Main.mo');
            const fileUri = URI.parse(filePath).toString();

            const diagsPromise = waitForDiagnostics(client, fileUri);
            await openTextDocuments(client, textDocuments, rootUri, [fileUri]);
            const diags = await diagsPromise;

            expect(diags.length).toBeGreaterThan(0);
        });

        test('Old moc.js uses check() fallback', () => {
            const context = getContext(rootUri.toString());
            // Old moc.js doesn't have checkWithScopeCache
            expect(context.checkWithScopeCache).toBeUndefined();
            expect(context.motoko.check).toBeDefined();
        });
    });

    describe('configured moc.js has higher priority', () => {
        let client: Connection;
        let server: Connection;

        const mocPath = join(
            cwd(),
            'src',
            'server',
            'compiler',
            'moc-0.10.4.js',
        );

        beforeAll(async () => {
            settings.mocJsPath = mocPath;
            [client, server] = await defaultBeforeAll(rootUri, true);
        });

        afterAll(async () => {
            await defaultAfterAll(client, server);
        });

        test('server uses configured motoko compiler', () => {
            const context = getContext(rootUri.toString());
            expect(context.mocJsInfo.version).toBe('0.10.4');
            expect(context.mocJsInfo.path).toBe(mocPath);
            expect(context.motoko.version).toBeDefined();
        });
    });
});
