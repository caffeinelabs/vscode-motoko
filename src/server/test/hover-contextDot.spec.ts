import { Connection, Hover, MarkupContent } from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import { cwd } from 'node:process';
import {
    defaultAfterAll,
    defaultBeforeAll,
    openTextDocument,
    TextDocument,
} from './helpers';
import { join } from 'node:path';

const rootPath = join(cwd(), 'test', 'hover');
const rootUri = URI.parse(rootPath);
jest.setTimeout(60000);

const fileUri = URI.parse(join(rootPath, 'ContextDot.mo')).toString();

describe('contextDot hover', () => {
    let client: Connection;
    let server: Connection;

    let textDocument: TextDocument;

    beforeAll(async () => {
        [client, server] = await defaultBeforeAll(rootUri, true, {
            useDefaultMocJs: true,
        });
        textDocument = await openTextDocument(client, rootUri, fileUri);
    });
    afterAll(async () => await defaultAfterAll(client, server));

    async function getHoverContents(
        line: number,
        character: number,
    ): Promise<string> {
        const hover = await client.sendRequest<Hover>('textDocument/hover', {
            textDocument,
            position: { line, character },
        });
        expect(hover).not.toBeNull();
        expect(hover.contents).toBeDefined();
        const contents = hover.contents as MarkupContent;
        return contents.value;
    }

    test('hover on context dot method "size" shows type and non-empty documentation', async () => {
        const contents = await getHoverContents(7, 17);
        expect(contents).toMatch(
            /^```motoko\n<K, V>\(self : Map<K, V>\) -> Nat\n```\n\n---\n\n[\s\S]+/,
        );
    });

    test('hover on context dot method "get" shows type and non-empty documentation', async () => {
        const contents = await getHoverContents(8, 18);
        expect(contents).toMatch(
            /^```motoko\n<K, V>\(self : Map<K, V>, compare : \(implicit : \(K, K\) -> Order\), key : K\) -> \?V\n```\n\n---\n\n[\s\S]+/,
        );
    });

    test('hover on receiver "obj" shows Map type and non-empty documentation', async () => {
        const contents = await getHoverContents(7, 13);
        expect(contents).toMatch(
            /^```motoko\n\{ var root : Node<Text, Nat>; var size : Nat \}\n```\n\n---\n\n[\s\S]+/,
        );
    });

    test('hover on context dot method from relative import shows documentation', async () => {
        const contents = await getHoverContents(10, 20);
        expect(contents).toMatch(
            /^```motoko\n\(self : Text\) -> Text\n```\s*---\s*Documentation for foo\.$/,
        );
    });
});
