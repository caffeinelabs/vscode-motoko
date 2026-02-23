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
    let version = 1;

    beforeAll(async () => {
        [client, server] = await defaultBeforeAll(rootUri, false, {
            useDefaultMocJs: true,
        });
        const diagnosticsPromise = waitForDiagnostics(client, fileUri);
        textDocument = await openTextDocument(client, rootUri, fileUri);
        await diagnosticsPromise;
    });
    afterAll(async () => await defaultAfterAll(client, server));

    function activeParamString(result: SignatureHelp): string {
        const sig = result.signatures[0];
        const param = sig.parameters![result.activeParameter!];
        const [start, end] = param.label as [number, number];
        return sig.label.slice(start, end);
    }

    async function appendAndGetSignatureHelp(
        expression: string,
        cursorOffsetFromEnd: number,
    ): Promise<SignatureHelp | null> {
        const newText = textDocument.text + '\n' + expression;
        const cursorPos = newText.length - cursorOffsetFromEnd;
        const before = newText.slice(0, cursorPos);
        const lines = before.split('\n');
        const line = lines.length - 1;
        const character = lines[lines.length - 1].length;

        await client.sendNotification('textDocument/didChange', {
            textDocument: { uri: textDocument.uri, version: ++version },
            contentChanges: [{ text: newText }],
        });
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

    // -- Lib local functions --

    test('f1: type ( — self is the only param, no visible params', async () => {
        // obj.f1(|)  cursor between parens
        const result = await appendAndGetSignatureHelp('obj.f1()', 1);
        expect(result).not.toBeNull();
        expect(result!.signatures[0].label).toBe('f1() -> Nat');
        expect(result!.signatures[0].parameters).toEqual([]);
    });

    test('f2: type ( — shows amount as 1st visible param', async () => {
        // obj.f2(|)  cursor between parens
        const result = await appendAndGetSignatureHelp('obj.f2()', 1);
        expect(result).not.toBeNull();
        expect(result!.signatures[0].label).toBe('f2(amount : Nat) -> Nat');
        expect(activeParamString(result!)).toBe('amount : Nat');
    });

    test('f3: type ( — shows prefix as 1st visible param', async () => {
        // obj.f3(|)  cursor between parens
        const result = await appendAndGetSignatureHelp('obj.f3()', 1);
        expect(result).not.toBeNull();
        expect(result!.signatures[0].label).toBe(
            'f3(prefix : Text, count : Nat) -> Text',
        );
        expect(activeParamString(result!)).toBe('prefix : Text');
    });

    test('f3: type 1st arg then , — shows count as 2nd param', async () => {
        // obj.f3("hello", |)  cursor after comma
        const result = await appendAndGetSignatureHelp('obj.f3("hello", )', 1);
        expect(result).not.toBeNull();
        expect(result!.signatures[0].label).toBe(
            'f3(prefix : Text, count : Nat) -> Text',
        );
        expect(activeParamString(result!)).toBe('count : Nat');
    });

    // -- mo:core Map --

    test('Map.size: type ( — self only, no visible params', async () => {
        // m.size(|)  cursor between parens
        const result = await appendAndGetSignatureHelp('m.size()', 1);
        expect(result).not.toBeNull();
        expect(result!.signatures[0].label).toBe('size() -> Nat');
        expect(result!.signatures[0].parameters).toEqual([]);
    });

    test('Map.get: type ( — primary sig omits implicits, secondary shows all', async () => {
        // m.get(|)  cursor between parens
        const result = await appendAndGetSignatureHelp('m.get()', 1);
        expect(result).not.toBeNull();
        expect(result!.signatures).toHaveLength(2);
        expect(result!.signatures[0].label).toBe('get(key : K) -> ?V');
        expect(result!.signatures[1].label).toBe(
            'get(compare : (K, K) -> Order, key : K) -> ?V',
        );
        expect(result!.activeSignature).toBe(0);
        expect(activeParamString(result!)).toBe('key : K');
    });

    test('Map.add: type 1st arg then , — highlights value in primary sig', async () => {
        // m.add("mykey", |)  cursor after comma
        const result = await appendAndGetSignatureHelp('m.add("mykey", )', 1);
        expect(result).not.toBeNull();
        expect(result!.signatures).toHaveLength(2);
        expect(result!.signatures[0].label).toBe(
            'add(key : K, value : V) -> ()',
        );
        expect(result!.signatures[1].label).toBe(
            'add(compare : (K, K) -> Order, key : K, value : V) -> ()',
        );
        expect(result!.activeSignature).toBe(0);
        expect(activeParamString(result!)).toBe('value : V');
    });

    // -- mo:core Array --

    test('Array.find: type ( — shows predicate param', async () => {
        // arr.find(|)  cursor between parens
        const result = await appendAndGetSignatureHelp('arr.find()', 1);
        expect(result).not.toBeNull();
        expect(result!.signatures[0].label).toBe(
            'find(predicate : T -> Bool) -> ?T',
        );
        expect(activeParamString(result!)).toBe('predicate : T -> Bool');
    });
});
