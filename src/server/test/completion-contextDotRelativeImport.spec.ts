import { CompletionList, Connection } from 'vscode-languageserver/node';
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

const fileUri = URI.parse(
    join(rootPath, 'contextDotImports', 'main.mo'),
).toString();

describe('contextDot completion with relative import', () => {
    let client: Connection;
    let server: Connection;
    let mainDocument: TextDocument;

    beforeAll(async () => {
        [client, server] = await defaultBeforeAll(rootUri, true, {
            useDefaultMocJs: true,
        });
        mainDocument = await openTextDocument(client, rootUri, fileUri);
    });

    afterAll(async () => await defaultAfterAll(client, server));

    async function requestMainCompletion(line: number, character: number) {
        return await client.sendRequest<CompletionList>(
            'textDocument/completion',
            {
                textDocument: mainDocument,
                position: { line, character },
                context: {
                    triggerKind: 2,
                    triggerCharacter: '.',
                },
            },
        );
    }

    test('already imported lib methods do not insert imports', async () => {
        const completion = await requestMainCompletion(4, 6);
        expect(completion.items.length).toBe(3);
        const fromLibAItem = completion.items.find(
            (item) => item.label === 'fromLibA',
        );
        const fromLibBItem = completion.items.find(
            (item) => item.label === 'fromLibB',
        );
        const someItem = completion.items.find((item) => item.label === 'some');
        expect(fromLibAItem).toBeDefined();
        expect(fromLibAItem?.additionalTextEdits).toBeUndefined();
        expect(fromLibAItem?.documentation).toBe('Documentation for fromLibA');
        expect(fromLibBItem).toBeDefined();
        expect(fromLibBItem?.additionalTextEdits).toBeUndefined();
        expect(fromLibBItem?.documentation).toBe('Documentation for fromLibB');
        expect(someItem).toBeDefined();
        expect(someItem?.additionalTextEdits?.length).toBeGreaterThan(0);
    });
});
