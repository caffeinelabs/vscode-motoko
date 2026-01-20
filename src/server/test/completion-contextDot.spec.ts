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

    test('Map module completion', async () => {
        const completion = await client.sendRequest<CompletionList>(
            'textDocument/completion',
            {
                textDocument: {
                    uri: file.uri,
                },
                position: {
                    line: 4,
                    character: 16, // Position right after the dot in "let test1 = Map."
                },
                context: {
                    triggerKind: 2,
                    triggerCharacter: '.',
                },
            },
        );

        const completions = completion.items.map((item) => item.label);
        expect(completions).toContain('empty');
        expect(completions).toContain('add');
        expect(completions).toContain('get');
    });
});
