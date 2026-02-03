import { Connection, Hover } from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import { cwd } from 'node:process';
import { readFileSync } from 'node:fs';
import { defaultAfterAll, setupWithDocument, TestFile } from './helpers';

jest.setTimeout(60000);

const rootPath = cwd();
const rootUri = URI.file(rootPath);
const filePath = `${rootPath}/test/hover`;
const text = readFileSync(`${filePath}/ContextDot.mo`, 'utf-8');

const file: TestFile = {
    uri: `${rootUri}/test/hover/ContextDot.mo`,
    textDocument: {
        uri: `${rootUri}/test/hover/ContextDot.mo`,
        languageId: 'motoko',
        version: 1,
        text: text,
    },
};

describe('contextDot hover', () => {
    let client: Connection;
    let server: Connection;

    beforeAll(async () => {
        [client, server] = await setupWithDocument(rootUri, file);
    });

    afterAll(async () => {
        await defaultAfterAll(client, server);
    });

    async function getHoverContents(
        line: number,
        character: number,
    ): Promise<string> {
        const hover = await client.sendRequest<Hover>('textDocument/hover', {
            textDocument: {
                uri: file.uri,
            },
            position: { line, character },
        });
        expect(hover).not.toBeNull();
        expect(hover.contents).toBeDefined();
        const contents = hover.contents as unknown as {
            kind: string;
            value: string;
        };
        return contents.value;
    }

    test('hover on context dot method "size" shows correct type', async () => {
        // let _size = obj.size();
        //                 ^^^^
        const contents = await getHoverContents(6, 17);
        expect(contents).toBe(
            '```motoko\n<K, V>(self : Map<K, V>) -> Nat\n```',
        );
    });

    test('hover on context dot method "get" shows correct type', async () => {
        // let _result = obj.get("key");
        //                   ^^^
        const contents = await getHoverContents(7, 18);
        expect(contents).toBe(
            '```motoko\n<K, V>(self : Map<K, V>, compare : (implicit : (K, K) -> Order), key : K) -> ?V\n```',
        );
    });

    test('hover on receiver "obj" shows Map type', async () => {
        // let _size = obj.size();
        //             ^^^
        const contents = await getHoverContents(6, 13);
        expect(contents).toBe(
            '```motoko\n{ var root : Node<Text, Nat>; var size : Nat }\n```',
        );
    });
});
