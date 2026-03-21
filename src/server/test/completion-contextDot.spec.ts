/* eslint jest/expect-expect: ["error", { "assertFunctionNames": ["expect", "expectMapCompletions"] }] */
import {
    CompletionItemKind,
    CompletionList,
    Connection,
} from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import { cwd } from 'node:process';
import {
    defaultAfterAll,
    defaultBeforeAll,
    openTextDocument,
    TextDocument,
} from './helpers';
import { join } from 'node:path';

const rootPath = join(cwd(), 'test', 'completion');
const rootUri = URI.parse(rootPath);
jest.setTimeout(60000);

const fileUri = URI.parse(join(rootPath, 'contextDot.mo')).toString();

describe('contextDot completion', () => {
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

    async function getCompletion(line: number, character: number) {
        return await client.sendRequest<CompletionList>(
            'textDocument/completion',
            {
                textDocument,
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

    function expectMapCompletions(completion: CompletionList) {
        const labels = completion.items.map((item) => item.label);
        expect(labels).not.toContain('empty'); // empty is not a context dot method (no self parameter)
        expect(labels).toContain('add');
        expect(labels).toContain('get');

        completion.items.forEach((item) => {
            expect(item.kind).toBe(CompletionItemKind.Method);
        });

        const mapCompletions = completion.items.filter(
            (item) => item.label !== 'some',
        );
        expect(mapCompletions.length).toBeGreaterThan(0);

        const otherCompletions = completion.items.filter(
            (item) => item.label === 'some',
        );
        expect(otherCompletions.length).toBeGreaterThan(0);

        const completionsWithDocumentation = completion.items.filter(
            // exclude functions without documentation
            (item) => item.label !== 'toArray' && item.label !== 'toVarArray',
        );
        expect(completionsWithDocumentation.length).toBeGreaterThan(0);

        // Test Map function completions
        mapCompletions.forEach((item) => {
            expect(item.detail).toContain('>(self : Map<K, '); // detail should be the type of the Map function
            expect(item.additionalTextEdits).toBeUndefined(); // Map functions are already imported
        });

        // Test other completions
        otherCompletions.forEach((item) => {
            expect(item.additionalTextEdits?.length).toBe(1);
            expect(item.additionalTextEdits![0].newText).toBe(
                `import Option "mo:core/Option";\n`,
            ); // auto-import
        });

        // Test documentations
        completionsWithDocumentation.forEach((item) => {
            expect(item.documentation?.toString().length).toBeGreaterThan(30); // doc comment should be substantial
        });
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
    ])('variable dot completions at %i:%i', async (line, character) => {
        const completion = await getCompletion(line, character);
        expectMapCompletions(completion);
    });

    test.each([
        [26, 40],
        [27, 41],
        [28, 42],
    ])(
        'static method call result dot completions at %i:%i',
        async (line, character) => {
            const completion = await getCompletion(line, character);
            expectMapCompletions(completion);
        },
    );

    test.each([
        [30, 22],
        [31, 23],
        [32, 24],
    ])(
        'parenthesized expression dot completions at %i:%i',
        async (line, character) => {
            const completion = await getCompletion(line, character);
            expectMapCompletions(completion);
        },
    );

    test.each([
        [34, 48],
        [35, 49],
        [36, 50],
    ])(
        'chained method call dot completions at %i:%i',
        async (line, character) => {
            const completion = await getCompletion(line, character);
            expectMapCompletions(completion);
        },
    );

    test.each([
        [39, 24],
        [40, 25],
        [41, 26],
    ])('index access dot completions at %i:%i', async (line, character) => {
        const completion = await getCompletion(line, character);
        expectMapCompletions(completion);
    });

    test.each([
        [43, 63],
        [44, 71],
        [45, 58],
    ])('complex receiver dot completions at %i:%i', async (line, character) => {
        const completion = await getCompletion(line, character);
        expectMapCompletions(completion);
    });
});
