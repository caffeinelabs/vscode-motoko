import { Connection, SignatureHelp } from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import { cwd } from 'node:process';
import {
    defaultAfterAll,
    defaultBeforeAll,
    openTextDocument,
    TextDocument,
    waitForDiagnostics,
} from './helpers';
import { join } from 'node:path';

const rootPath = join(cwd(), 'test', 'signatureHelpContextDot');
const rootUri = URI.parse(rootPath);
jest.setTimeout(60000);

const fileUri = URI.parse(join(rootPath, 'contextDot.mo')).toString();

describe('signatureHelp contextDot', () => {
    let client: Connection;
    let server: Connection;

    let textDocument: TextDocument;

    beforeAll(async () => {
        [client, server] = await defaultBeforeAll(rootUri, false, {
            useDefaultMocJs: true,
        });
        const diagnosticsPromise = waitForDiagnostics(client, fileUri);
        textDocument = await openTextDocument(client, rootUri, fileUri);
        await diagnosticsPromise;
    });
    afterAll(async () => await defaultAfterAll(client, server));

    async function getSignatureHelp(
        line: number,
        character: number,
    ): Promise<SignatureHelp | null> {
        return await client.sendRequest<SignatureHelp>(
            'textDocument/signatureHelp',
            {
                textDocument,
                position: { line, character },
                context: {
                    triggerKind: 2,
                    triggerCharacter: '(',
                    isRetrigger: false,
                },
            },
        );
    }

    test('Lib.f1 — 0 visible params (self only)', async () => {
        const result = await getSignatureHelp(8, 15);
        expect(result).not.toBeNull();
        expect(result!.signatures[0].label).toBe('f1() -> Nat');
        expect(result!.signatures[0].parameters).toEqual([]);
        expect(result!.activeParameter).toBe(0);
    });

    test('Lib.f2 — 1 visible param', async () => {
        const result = await getSignatureHelp(9, 15);
        expect(result).not.toBeNull();
        expect(result!.signatures[0].label).toBe('f2(amount : Nat) -> Nat');
        expect(result!.signatures[0].parameters).toEqual([{ label: [3, 15] }]);
        expect(result!.activeParameter).toBe(0);
    });

    test('Lib.f3 — 2 visible params, cursor at first', async () => {
        const result = await getSignatureHelp(10, 15);
        expect(result).not.toBeNull();
        expect(result!.signatures[0].label).toBe(
            'f3(prefix : Text, count : Nat) -> Text',
        );
        expect(result!.signatures[0].parameters).toEqual([
            { label: [3, 16] },
            { label: [18, 29] },
        ]);
        expect(result!.activeParameter).toBe(0);
    });

    test('Lib.f3 — 2 visible params, cursor at second', async () => {
        const result = await getSignatureHelp(10, 24);
        expect(result).not.toBeNull();
        expect(result!.signatures[0].label).toBe(
            'f3(prefix : Text, count : Nat) -> Text',
        );
        expect(result!.activeParameter).toBe(1);
    });

    test('Map.size — 0 visible params', async () => {
        const result = await getSignatureHelp(11, 15);
        expect(result).not.toBeNull();
        expect(result!.signatures[0].label).toBe('size() -> Nat');
        expect(result!.signatures[0].parameters).toEqual([]);
    });

    test('Map.get — shows compare and key params', async () => {
        const result = await getSignatureHelp(12, 14);
        expect(result).not.toBeNull();
        expect(result!.signatures[0].label).toBe(
            'get(compare : (K, K) -> Order, key : K) -> ?V',
        );
        expect(result!.signatures[0].parameters).toEqual([
            { label: [4, 29] },
            { label: [31, 38] },
        ]);
        expect(result!.activeParameter).toBe(0);
    });

    test('Map.add — shows compare, key, value params', async () => {
        const result = await getSignatureHelp(13, 14);
        expect(result).not.toBeNull();
        expect(result!.signatures[0].label).toBe(
            'add(compare : (K, K) -> Order, key : K, value : V) -> ()',
        );
        expect(result!.signatures[0].parameters).toEqual([
            { label: [4, 29] },
            { label: [31, 38] },
            { label: [40, 49] },
        ]);
        expect(result!.activeParameter).toBe(0);
    });

    test('Array.find — 1 predicate param', async () => {
        const result = await getSignatureHelp(14, 17);
        expect(result).not.toBeNull();
        expect(result!.signatures[0].label).toBe(
            'find(predicate : T -> Bool) -> ?T',
        );
        expect(result!.signatures[0].parameters).toEqual([{ label: [5, 26] }]);
        expect(result!.activeParameter).toBe(0);
    });
});
