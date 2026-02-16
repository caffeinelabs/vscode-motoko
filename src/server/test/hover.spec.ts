import { Connection, Hover } from 'vscode-languageserver/node';
import { URI } from 'vscode-uri';
import { join } from 'node:path';
import {
    defaultAfterAll,
    defaultBeforeAll,
    makeTextDocument,
    waitForDiagnostics,
} from '../test/helpers';

jest.setTimeout(60000);

beforeAll(() => {
    jest.mock('ic-mops/commands/add');
});

const rootUri = URI.parse(join(__dirname, '..', '..', '..', 'test', 'hover'));

type HoverCase = {
    name: string;
    position: { line: number; character: number };
    expected: Hover['contents'] | null;
};

function setupHoverSuite(file: string) {
    let client: Connection;
    let server: Connection;
    const textDocument = makeTextDocument(rootUri, file);

    beforeAll(async () => {
        [client, server] = await defaultBeforeAll(rootUri, true);
        const diagnosticsPromise = waitForDiagnostics(client, textDocument.uri);
        await client.sendNotification('textDocument/didOpen', { textDocument });
        await diagnosticsPromise;
    });

    afterAll(async () => await defaultAfterAll(client, server));

    const getHover = (position: { line: number; character: number }) =>
        client.sendRequest<Hover | null>('textDocument/hover', {
            textDocument: { uri: textDocument.uri },
            position,
        });

    return {
        getClient: () => client,
        textDocument,
        getHover,
    };
}

function registerHoverCases(
    suite: ReturnType<typeof setupHoverSuite>,
    cases: HoverCase[],
) {
    test.each(cases)('$name', async ({ position, expected }) => {
        const hover = await suite.getHover(position);
        const actual = expected === null ? hover : hover?.contents;
        expect(actual).toStrictEqual(expected);
    });
}

const moduleDocumentation: Hover['contents'] = {
    kind: 'markdown',
    value: 'Module documentation\n\n---\n\n*Type definition:*\n```motoko\nmodule {\n  type Class = { classMethod : () -> (); classValue : Nat };\n  type Record = { var age : Nat; name : Text };\n  Class : (initialValue : Nat) -> Class;\n  Object : { objectMethod : () -> (); objectValue : Nat };\n  inc : (x : Nat) -> Nat;\n  value : Nat;\n};\n```',
};

const functionDocumentation: Hover['contents'] = {
    kind: 'markdown',
    value: '```motoko\n(x : Nat) -> Nat\n```\n\n---\n\nIncrement the value by one\n\n#### Example\n\n```motoko\nlet x = 41;\nlet y = inc(x);\nassert Nat.equal(y, 42);\n```',
};

describe('module', () => {
    const suite = setupHoverSuite('Module.mo');
    const cases: HoverCase[] = [
        {
            name: 'Module has correct hover',
            position: { line: 1, character: 0 },
            expected: moduleDocumentation,
        },
        {
            name: 'Empty space in a module has no hover',
            position: { line: 4, character: 0 },
            expected: null,
        },
        {
            name: 'Variable has correct hover',
            position: { line: 3, character: 13 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nNat\n```\n\n---\n\nVariable documentation',
            },
        },
        {
            name: 'Function has correct hover',
            position: { line: 14, character: 14 },
            expected: functionDocumentation,
        },
        {
            name: 'Argument has correct hover',
            position: { line: 14, character: 18 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nNat\n```',
            },
        },
        {
            name: 'Mutable variable has correct hover',
            position: { line: 16, character: 8 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nvar Nat\n```\n\n---\n\nMutable variable documentation',
            },
        },
        {
            name: 'Async function has correct hover',
            position: { line: 22, character: 7 },
            expected: {
                kind: 'markdown',
                value: '```motoko\n() -> async ()\n```\n\n---\n\nAsync function documentation',
            },
        },
        {
            name: 'Optional type has correct hover',
            position: { line: 24, character: 31 },
            expected: {
                kind: 'markdown',
                value: '```motoko\n?Int\n```',
            },
        },
        {
            name: 'Literal expression has correct hover',
            position: { line: 25, character: 15 },
            expected: {
                kind: 'markdown',
                value: '```motoko\n?Int\n```',
            },
        },
        {
            name: 'Optional expression has correct hover',
            position: { line: 30, character: 6 },
            expected: {
                kind: 'markdown',
                value: '```motoko\n?Int\n```',
            },
        },
        {
            name: 'Class has correct hover',
            position: { line: 37, character: 15 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nclass Class(initialValue : Nat)\n```\n\n---\n\nClass documentation',
            },
        },
        {
            name: 'Object has correct hover',
            position: { line: 46, character: 16 },
            expected: {
                kind: 'markdown',
                value: '```motoko\n{ objectMethod : () -> (); objectValue : Nat }\n```\n\n---\n\nObject documentation',
            },
        },
        {
            name: 'Record has correct hover',
            position: { line: 55, character: 14 },
            expected: {
                kind: 'markdown',
                value: '```motoko\n{ var age : Nat; name : Text }\n```\n\n---\n\nRecord documentation',
            },
        },
        {
            name: 'Record member has correct hover',
            position: { line: 56, character: 4 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nText\n```',
            },
        },
        {
            name: 'Mutable record member has correct hover',
            position: { line: 57, character: 8 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nvar Nat\n```',
            },
        },
        {
            name: 'Variant has correct hover',
            position: { line: 61, character: 7 },
            expected: {
                kind: 'markdown',
                value: '```motoko\n{ #leaf; #node : { left : Tree; right : Tree; var value : Nat } }\n```\n\n---\n\nVariant documentation',
            },
        },
        {
            name: 'Record tag has correct hover',
            position: { line: 62, character: 4 },
            expected: {
                kind: 'markdown',
                value: '```motoko\n{ left : Tree; right : Tree; var value : Nat }\n```',
            },
        },
    ];

    registerHoverCases(suite, cases);
});

describe('actor', () => {
    const suite = setupHoverSuite('Actor.mo');
    const cases: HoverCase[] = [
        {
            name: 'Import has correct hover',
            position: { line: 0, character: 7 },
            expected: moduleDocumentation,
        },
        {
            name: '"persistent" keyword has no hover',
            position: { line: 3, character: 0 },
            expected: null,
        },
        {
            name: 'Actor has correct hover',
            position: { line: 3, character: 11 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nactor { inc : shared () -> async () }\n```\n\n---\n\nActor documentation',
            },
        },
        {
            name: 'Mutable variable has correct hover',
            position: { line: 5, character: 6 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nvar Nat\n```\n\n---\n\nMutable variable documentation',
            },
        },
        {
            name: 'Actor class has correct hover',
            position: { line: 8, character: 25 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nactor class _ActorClass(initialValue : Nat)\n```\n\n---\n\nActor class documentation',
            },
        },
        {
            name: 'Imported module has correct hover',
            position: { line: 12, character: 16 },
            expected: moduleDocumentation,
        },
        {
            name: 'Imported type has correct hover',
            position: { line: 12, character: 23 },
            expected: {
                kind: 'markdown',
                value: '```motoko\n{ var age : Nat; name : Text }\n```\n\n---\n\nRecord documentation',
            },
        },
        {
            name: 'Imported function has correct hover',
            position: { line: 18, character: 20 },
            expected: functionDocumentation,
        },
    ];

    registerHoverCases(suite, cases);
});

describe('named module', () => {
    const suite = setupHoverSuite('NamedModule.mo');
    const cases: HoverCase[] = [
        {
            name: '"module" keyword of module A has correct hover',
            position: { line: 1, character: 0 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nmodule {}\n```\n\n---\n\nModule A documentation',
            },
        },
        {
            name: 'ID of module A has correct hover',
            position: { line: 1, character: 7 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nmodule {}\n```\n\n---\n\nModule A documentation',
            },
        },
        {
            name: '"module" keyword of module B has correct hover',
            position: { line: 4, character: 0 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nmodule {}\n```\n\n---\n\nModule B documentation',
            },
        },
        {
            name: 'ID of module B has correct hover',
            position: { line: 4, character: 7 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nmodule {}\n```\n\n---\n\nModule B documentation',
            },
        },
        {
            name: '"module" keyword of module C has correct hover',
            position: { line: 6, character: 0 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nmodule {}\n```\n\n---\n\nModule A documentation',
            },
        },
        {
            name: 'ID of module C has correct hover',
            position: { line: 6, character: 7 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nmodule {}\n```\n\n---\n\nModule A documentation',
            },
        },
    ];

    registerHoverCases(suite, cases);
});

describe('named actor', () => {
    const suite = setupHoverSuite('NamedActor.mo');
    const cases: HoverCase[] = [
        {
            name: '"actor" keyword of actor A has correct hover',
            position: { line: 1, character: 11 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nactor {}\n```\n\n---\n\nActor A documentation',
            },
        },
        {
            name: 'ID of actor A has correct hover',
            position: { line: 1, character: 17 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nactor {}\n```\n\n---\n\nActor A documentation',
            },
        },
        {
            name: '"actor" keyword of actor B has correct hover',
            position: { line: 4, character: 11 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nactor {}\n```\n\n---\n\nActor B documentation',
            },
        },
        {
            name: 'ID of actor B has correct hover',
            position: { line: 4, character: 17 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nactor {}\n```\n\n---\n\nActor B documentation',
            },
        },
        {
            name: '"actor" keyword of actor C has correct hover',
            position: { line: 6, character: 11 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nactor {}\n```\n\n---\n\nActor A documentation',
            },
        },
        {
            name: 'ID of actor C has correct hover',
            position: { line: 6, character: 17 },
            expected: {
                kind: 'markdown',
                value: '```motoko\nactor {}\n```\n\n---\n\nActor A documentation',
            },
        },
    ];

    registerHoverCases(suite, cases);
});

describe('keyword caching', () => {
    const suite = setupHoverSuite('Keyword.mo');

    test('non-node keyword hover invalidates cached comment scan after change', async () => {
        const keywordHover = await suite.getHover({ line: 2, character: 9 });
        expect(keywordHover).not.toBeNull();

        const updatedText = [
            '/// Keyword caching test module',
            'module {',
            '  //     let keyword is now inside a comment',
            '  public let noop = 0;',
            '};',
        ].join('\n');

        const diagnosticsPromise = waitForDiagnostics(
            suite.getClient(),
            suite.textDocument.uri,
        );
        await suite.getClient().sendNotification('textDocument/didChange', {
            textDocument: {
                uri: suite.textDocument.uri,
                version: suite.textDocument.version + 1,
            },
            contentChanges: [
                {
                    text: updatedText,
                },
            ],
        });

        await diagnosticsPromise;

        const commentHover = await suite
            .getClient()
            .sendRequest<Hover | null>('textDocument/hover', {
                textDocument: {
                    uri: suite.textDocument.uri,
                },
                position: { line: 2, character: 9 },
            });

        expect(commentHover).toBeNull();
    });
});
