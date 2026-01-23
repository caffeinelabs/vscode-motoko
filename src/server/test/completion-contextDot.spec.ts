import {
    CompletionList,
    Connection,
    InitializeResult,
} from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import { clientInitParams, setupClientServer } from './mock';
import { cwd } from 'node:process';
import { readFileSync } from 'node:fs';
import { wait, waitForNotification } from './helpers';

jest.setTimeout(60000);

const rootPath = cwd();
const rootUri = URI.file(rootPath);
const filePath = `${rootPath}/test/completion`;
const text = readFileSync(`${filePath}/contextDot.mo`, 'utf-8');

const file = {
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
        [client, server] = setupClientServer(true);

        const serverInitialized = waitForNotification(
            'custom/initialized',
            client,
        );

        await client.sendRequest<InitializeResult>(
            'initialize',
            clientInitParams(rootUri),
        );

        await client.sendNotification('initialized', {});

        await serverInitialized;

        await client.sendNotification('textDocument/didOpen', {
            textDocument: file.textDocument,
        });

        // Send didChange to ensure the file is processed
        await client.sendNotification('textDocument/didChange', {
            textDocument: {
                uri: file.uri,
                version: 2,
            },
            contentChanges: [
                {
                    text: text,
                },
            ],
        });

        await wait(2); // Wait longer for Map module to be resolved
    });

    afterAll(async () => {
        await client.sendRequest('shutdown');
        await wait(2);
        client.dispose();
        server.dispose();
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
            // TODO: fix this path to be mo:core/Map.mo
            expect(item.detail).toBe('.mops/core%402.0.0/src/Map.mo');
        });
    });
});
