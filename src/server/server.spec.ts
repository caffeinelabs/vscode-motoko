import icCandid from '../generated/aaaaa-aa.did';
import { Hover } from 'vscode';
import { URI } from 'vscode-uri';
import { join } from 'node:path';
import { makeTextDocument, runTest, wait } from './test/helpers';
import { TEST_GET_DEPENDENCY_GRAPH } from '../common/connectionTypes';

describe('server', () => {
    test('generated IC Candid file has expected format', () => {
        expect(icCandid).toContain('service ic : {\n');
    });
});

describe('cache', () => {
    jest.setTimeout(60000);

    beforeAll(() => {
        jest.mock('ic-mops/commands/add');
    });

    const rootUri = URI.parse(join(__dirname, '..', '..', 'test', 'cache'));

    test('Top.mo has correct hover', async () => {
        const hover = await runTest(rootUri, async (client) => {
            const textDocument = makeTextDocument(rootUri, 'Top.mo');
            await client.sendNotification('textDocument/didOpen', {
                textDocument,
            });
            return client.sendRequest<Hover>('textDocument/hover', {
                textDocument,
                position: { line: 2, character: 0 },
            });
        });
        expect(hover.contents).toStrictEqual({
            kind: 'markdown',
            value: '```motoko\nmodule { top : { foo : () -> () } }\n```',
        });
    });

    test('Top.mo has correct hover after changing value', async () => {
        const hover = await runTest(rootUri, async (client) => {
            const textDocument = makeTextDocument(rootUri, 'Top.mo');
            await client.sendNotification('textDocument/didOpen', {
                textDocument,
            });
            await client.sendNotification('textDocument/didChange', {
                textDocument,
                contentChanges: [
                    {
                        text: textDocument.text
                            .replace(': ()', ': Nat')
                            .replace('Bottom.bottom.bar()', '42'),
                    },
                ],
            });
            return await client.sendRequest<Hover>('textDocument/hover', {
                textDocument,
                position: { line: 2, character: 0 },
            });
        });
        expect(hover.contents).toStrictEqual({
            kind: 'markdown',
            value: '```motoko\nmodule { top : { foo : () -> () } }\n```',
        });
    });

    test('Top.mo has correct hover for changed dependency', async () => {
        // Hover will get the typed AST
        const hover = await runTest(rootUri, async (client) => {
            const textDocumentTop = makeTextDocument(rootUri, 'Top.mo');
            await client.sendNotification('textDocument/didOpen', {
                textDocument: textDocumentTop,
            });
            const textDocumentBottom = makeTextDocument(rootUri, 'Bottom.mo');
            await client.sendNotification('textDocument/didOpen', {
                textDocument: textDocumentBottom,
            });
            await client.sendNotification('textDocument/didChange', {
                textDocument: textDocumentBottom,
                contentChanges: [
                    {
                        text: textDocumentBottom.text
                            .replace(': ()', ': Nat')
                            .replace('return ()', 'return 42'),
                    },
                ],
            });
            await client.sendNotification('textDocument/didChange', {
                textDocument: textDocumentTop,
                contentChanges: [
                    {
                        text: textDocumentTop.text.replace(': ()', ': Nat'),
                    },
                ],
            });
            await wait(1); // wait for changes to complete
            return await client.sendRequest<Hover>('textDocument/hover', {
                textDocument: textDocumentTop,
                position: { line: 2, character: 0 },
            });
        });
        expect(hover.contents).toStrictEqual({
            kind: 'markdown',
            value: '```motoko\nmodule { top : { foo : () -> Nat } }\n```',
        });
    });

    test('Top.mo has correct hover for changed dependency without changing itself', async () => {
        // Hover will get the typed AST
        const hover = await runTest(rootUri, async (client) => {
            const textDocumentTop = makeTextDocument(rootUri, 'Top.mo');
            await client.sendNotification('textDocument/didOpen', {
                textDocument: textDocumentTop,
            });
            const textDocumentBottom = makeTextDocument(rootUri, 'Bottom.mo');
            await client.sendNotification('textDocument/didOpen', {
                textDocument: textDocumentBottom,
            });
            await client.sendNotification('textDocument/didChange', {
                textDocument: textDocumentBottom,
                contentChanges: [
                    {
                        text: textDocumentBottom.text.replace(
                            'bottom {',
                            'bottom { public let foo : Nat = 42;',
                        ),
                    },
                ],
            });
            await wait(1); // wait for changes to complete
            return await client.sendRequest<Hover>('textDocument/hover', {
                textDocument: textDocumentTop,
                position: { line: 4, character: 49 },
            });
        });
        expect(hover.contents).toStrictEqual({
            kind: 'markdown',
            value: '```motoko\n{ bar : () -> (); foo : Nat }\n```',
        });
    });

    test('The server has a correct dependency graph after loading the workspace', async () => {
        // Hover will get the typed AST
        const actual = await runTest(rootUri, async (client) => {
            const textDocument = makeTextDocument(rootUri, 'Top.mo');
            await client.sendNotification('textDocument/didOpen', {
                textDocument,
            });
            await wait(1); // wait for loading to complete
            return await client.sendRequest(TEST_GET_DEPENDENCY_GRAPH, {
                uri: textDocument.uri,
            });
        });
        // The dependency graph contains two kinds of entries:
        // - Package paths: the base library is always present because node-motoko
        //   unconditionally loads it into the virtual filesystem at
        //   `.node-motoko/base/<version>/`, and the `--all-libs` moc flag causes
        //   all package modules to appear in the graph as `base/...` paths too.
        // - Absolute paths: the actual project files from the workspace on disk.
        // Note: project files like Top.mo also list base package files among
        // their dependencies, so we strip those out before asserting.
        const isPackagePath = (p: string) =>
            p.startsWith('base/') ||
            p.startsWith('.node-motoko/base/moc-0.15.0/');
        const packageEntries = actual.filter((ar) => isPackagePath(ar[0]));
        expect(packageEntries.length).toBeGreaterThan(0);
        const projectEntries = actual.filter((ar) => !isPackagePath(ar[0]));
        const root = rootUri.fsPath;
        const projectDeps = projectEntries.map(
            ([path, deps]: [string, string[]]) => [
                path,
                deps.filter((d) => !isPackagePath(d)),
            ],
        );
        expect(projectDeps).toEqual(
            expect.arrayContaining([
                [join(root, 'Top.mo'), [join(root, 'Bottom.mo')]],
                [join(root, 'Bottom.mo'), []],
            ]),
        );
    });

    test('We can get typed AST for second hover (regression test for issue #340)', async () => {
        const [hover0, hover1] = await runTest(rootUri, async (client) => {
            const textDocument = makeTextDocument(rootUri, 'issue-340.mo');
            await client.sendNotification('textDocument/didOpen', {
                textDocument,
            });
            await wait(1);
            const hover0 = await client.sendRequest<Hover>(
                'textDocument/hover',
                {
                    textDocument,
                    position: { line: 2, character: 24 },
                },
            );
            await wait(2);
            const hover1 = await client.sendRequest<Hover>(
                'textDocument/hover',
                {
                    textDocument,
                    position: { line: 2, character: 24 },
                },
            );
            return [hover0, hover1];
        });
        expect(hover0.contents).toStrictEqual({
            kind: 'markdown',
            value: '```motoko\nInt\n```',
        });
        expect(hover1).toStrictEqual(hover0);
    });
});
