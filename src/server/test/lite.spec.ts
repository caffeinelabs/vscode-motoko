import { join } from 'node:path';
import { cwd } from 'node:process';
import { InitializeResult } from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import { allContexts } from '../context';
import { defaultAfterAll, waitForNotification } from './helpers';
import { clientInitParams, setupClientServer } from './mock';

const rootUri = URI.file(join(cwd(), 'test', 'formatter'));

jest.setTimeout(30000);

describe('lite mode', () => {
    test('registers only formatting and loads no compiler', async () => {
        const [client, server] = setupClientServer(true);
        try {
            const serverInitialized = waitForNotification(
                'custom/initialized',
                client,
            );
            const { capabilities } = await client.sendRequest<InitializeResult>(
                'initialize',
                clientInitParams(rootUri, { lite: true }),
            );
            await client.sendNotification('initialized', {});
            await serverInitialized;

            expect(capabilities.documentFormattingProvider).toBe(true);
            expect(capabilities.hoverProvider).toBeUndefined();
            expect(capabilities.completionProvider).toBeUndefined();
            expect(capabilities.definitionProvider).toBeUndefined();
            expect(allContexts()).toStrictEqual([]);
        } finally {
            await defaultAfterAll(client, server);
        }
    });
});
