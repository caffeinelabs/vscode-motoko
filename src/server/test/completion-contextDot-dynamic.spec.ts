/* eslint jest/expect-expect: ["error", { "assertFunctionNames": ["expect"] }] */
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

const fileUri = URI.parse(join(rootPath, 'contextDotDynamic.mo')).toString();

describe('contextDot dynamic (dot insertion)', () => {
    let client: Connection;
    let server: Connection;
    let textDocument: TextDocument;
    let version = 1;

    beforeAll(async () => {
        [client, server] = await defaultBeforeAll(rootUri, true, {
            useDefaultMocJs: true,
        });
        textDocument = await openTextDocument(client, rootUri, fileUri);
    });
    afterAll(async () => await defaultAfterAll(client, server));

    /**
     * Finds `expression` in the original text, inserts a `.` right after it,
     * sends didChange, then requests completions at the dot position.
     */
    async function insertDotAndComplete(
        expression: string,
    ): Promise<CompletionList> {
        const idx = textDocument.text.indexOf(expression);
        const dotIdx = idx + expression.length;
        const newText =
            textDocument.text.slice(0, dotIdx) +
            '.' +
            textDocument.text.slice(dotIdx);

        // Convert absolute offset to line:character (cursor after the dot)
        const before = newText.slice(0, dotIdx + 1);
        const lines = before.split('\n');
        const line = lines.length - 1;
        const character = lines[lines.length - 1].length;

        // Send the notification but don't wait for the virtual file system to update to mimic the real world behavior
        await client.sendNotification('textDocument/didChange', {
            textDocument: { uri: textDocument.uri, version: ++version },
            contentChanges: [{ text: newText }],
        });
        return await client.sendRequest<CompletionList>(
            'textDocument/completion',
            {
                textDocument,
                position: { line, character },
                context: { triggerKind: 2, triggerCharacter: '.' },
            },
        );
    }

    test.each([
        '{ obj',
        '_ = obj',
        'Map.empty<Text, Nat>()',
        '(obj)',
        'obj.filter(func(k, v) { true })',
        'complexReceiver0() { Map.filter(obj, func(k, v) { true })',
        '_ = Map.filter(obj, func(k, v) { true })',
        'objs[0]',
    ])('%s.', async (expression) => {
        const completion = await insertDotAndComplete(expression);
        const labels = completion.items.map((item) => item.label);
        expect(labels).not.toContain('empty');
        expect(labels).toContain('add');
        expect(labels).toContain('get');
        completion.items.forEach((item) => {
            expect(item.kind).toBe(CompletionItemKind.Method);
        });
    });
});
