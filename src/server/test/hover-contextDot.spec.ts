import { Connection, Hover, MarkupContent } from 'vscode-languageserver/node';
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
        const contents = hover.contents as MarkupContent;
        return contents.value;
    }

    test('hover on context dot method "size" shows type and non-empty documentation', async () => {
        const contents = await getHoverContents(6, 17);
        expect(contents).toMatch(
            /^```motoko\n<K, V>\(self : Map<K, V>\) -> Nat\n```\n\n---\n\n[\s\S]+/,
        );
    });

    test('hover on context dot method "get" shows type and non-empty documentation', async () => {
        const contents = await getHoverContents(7, 18);
        expect(contents).toMatch(
            /^```motoko\n<K, V>\(self : Map<K, V>, compare : \(implicit : \(K, K\) -> Order\), key : K\) -> \?V\n```\n\n---\n\n[\s\S]+/,
        );
    });

    test('hover on receiver "obj" shows Map type and non-empty documentation', async () => {
        const contents = await getHoverContents(6, 13);
        expect(contents).toMatch(
            /^```motoko\n\{ var root : Node<Text, Nat>; var size : Nat \}\n```\n\n---\n\n[\s\S]+/,
        );
    });
});
