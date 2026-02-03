import {
    CompletionItemKind,
    CompletionList,
    Connection,
} from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import { cwd } from 'node:process';
import { readFileSync } from 'node:fs';
import { defaultAfterAll, setupWithDocument, TestFile } from './helpers';

jest.setTimeout(60000);

const rootPath = cwd();
const rootUri = URI.file(rootPath);
const filePath = `${rootPath}/test/completion`;
const text = readFileSync(`${filePath}/contextDot.mo`, 'utf-8');

const file: TestFile = {
    uri: `${rootUri}/test/completion/contextDot.mo`,
    textDocument: {
        uri: `${rootUri}/test/completion/contextDot.mo`,
        languageId: 'motoko',
        version: 1,
        text: text,
    },
};

describe('contextDot completion', () => {
    let client: Connection;
    let server: Connection;

    beforeAll(async () => {
        [client, server] = await setupWithDocument(rootUri, file);
    });

    afterAll(async () => {
        await defaultAfterAll(client, server);
    });

    async function getCompletion(line: number, character: number) {
        return await client.sendRequest<CompletionList>(
            'textDocument/completion',
            {
                textDocument: {
                    uri: file.uri,
                },
                position: {
                    line,
                    character,
                },
                context: {
                    triggerKind: 2,
                    triggerCharacter: '.',
                },
            },
        );
    }

    test.each([
        [4, 16],
        [5, 17],
        [6, 18],

        [8, 26],
        [9, 27],
        [10, 28],

        [12, 28],
        [13, 28],
        [14, 29],
        [15, 29],
        [16, 30],
        [17, 30],

        [19, 23],
        [20, 23],
        [21, 24],
        [22, 24],
        [23, 25],
        [24, 25],
    ])('map completions at %i:%i', async (line, character) => {
        const completion = await getCompletion(line, character);
        const labels = completion.items.map((item) => item.label);
        expect(labels).not.toContain('empty'); // empty is not a context dot method (no self parameter)
        expect(labels).toContain('add');
        expect(labels).toContain('get');

        completion.items.forEach((item) => {
            expect(item.kind).toBe(CompletionItemKind.Method);
        });

        // Test Map function completions
        completion.items
            .filter((item) => item.label !== 'some')
            .forEach((item) => {
                expect(item.detail).toContain('>(self : Map<K, '); // detail should be the type of the Map function
            });

        // Test other completions
        completion.items
            .filter((item) => item.label === 'some')
            .forEach((item) => {
                expect(item.additionalTextEdits?.length).toBe(1);
                expect(item.additionalTextEdits![0].newText).toBe(
                    `import Option "mo:core/Option";\n`,
                ); // auto-import
            });

        // Test documentations
        completion.items
            .filter(
                (item) =>
                    item.label !== 'toArray' && item.label !== 'toVarArray',
            ) // exclude functions without documentation
            .forEach((item) => {
                expect(item.documentation?.toString().length).toBeGreaterThan(
                    30,
                ); // doc comment should be substantial
            });
    });
});
