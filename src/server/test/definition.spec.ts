/* eslint-disable jest/expect-expect */
import { URI } from 'vscode-uri';
import { join } from 'node:path';
import { cwd } from 'node:process';
import {
    TextDocument,
    defaultBeforeAll,
    defaultAfterAll,
    openTextDocuments,
} from './helpers';
import { Connection, Location, Position, Range } from 'vscode-languageserver';

const rootPath = join(cwd(), 'test', 'definition');
const rootUri = URI.parse(rootPath);
const listPath = join('.mops', 'core@2.0.0', 'src', 'List.mo');
const arrayPath = join('.mops', 'core@2.0.0', 'src', 'Array.mo');

jest.setTimeout(60000);

function location(
    path: string,
    line: number,
    startCharacter: number,
    endCharacter: number,
): Location {
    return Location.create(
        URI.parse(join(rootUri.fsPath, path)).toString(),
        Range.create(
            Position.create(line, startCharacter),
            Position.create(line, endCharacter),
        ),
    );
}

describe('go to definition', () => {
    let client: Connection;
    let server: Connection;

    const textDocuments = new Map<string, TextDocument>();

    async function testDefinition(
        reference: Location,
        expected: Location[],
    ): Promise<void> {
        await openTextDocuments(client, textDocuments, rootUri, [
            reference.uri,
        ]);
        const textDocument = textDocuments.get(reference.uri);
        const locations = await client.sendRequest<Location[]>(
            'textDocument/definition',
            {
                textDocument,
                position: reference.range.start,
            },
        );
        expect(locations).toStrictEqual(expected);
    }

    async function testDefinitionSimple({
        pos,
        declPos,
    }: {
        pos: Position;
        declPos: Location;
    }): Promise<void> {
        const filePath = join(rootPath, 'simple.mo');
        const fileUri = URI.parse(filePath).toString();
        await openTextDocuments(client, textDocuments, rootUri, [fileUri]);
        const textDocument = textDocuments.get(fileUri);
        const response = await client.sendRequest('textDocument/definition', {
            textDocument,
            position: pos,
        });
        expect(response).toStrictEqual([declPos]);
    }

    beforeAll(async () => {
        [client, server] = await defaultBeforeAll(rootUri, true, {
            useDefaultMocJs: true,
        });
    });

    afterAll(async () => {
        await defaultAfterAll(client, server);
    });

    // module {
    //^^
    const arrayModuleDeclPos = location(arrayPath, 21, 0, 0);
    test.each([
        // Jump from:
        // let b : [Int] = Array.repeat(42, 2);
        // 1)             ^^
        // 2)              ^^
        // 3)                  ^^
        { pos: { line: 5, character: 20 }, declPos: arrayModuleDeclPos },
        { pos: { line: 5, character: 21 }, declPos: arrayModuleDeclPos },
        { pos: { line: 5, character: 25 }, declPos: arrayModuleDeclPos },
    ])('core:Array-%#', testDefinitionSimple);

    // public func repeat<T>(...
    //            ^^
    const arrayRepeatDeclPos = location(arrayPath, 45, 14, 20);
    test.each([
        // Jump from:
        // let b : [Int] = Array.repeat(42, 2);
        // 1)                   ^^
        // 2)                    ^^
        // 3)                          ^^
        { pos: { line: 5, character: 26 }, declPos: arrayRepeatDeclPos },
        { pos: { line: 5, character: 27 }, declPos: arrayRepeatDeclPos },
        { pos: { line: 5, character: 32 }, declPos: arrayRepeatDeclPos },
    ])('core:Array.repeat-%#', testDefinitionSimple);

    // module {
    //^^
    const listModuleDeclPos = location(listPath, 23, 0, 0);
    test.each([
        // Jump from:
        // let a : List.List<Int> = List.empty();
        // 1)     ^^
        // 2)      ^^
        // 3)         ^^
        // 4)                      ^^
        // 5)                       ^^
        // 6)                          ^^
        { pos: { line: 4, character: 12 }, declPos: listModuleDeclPos },
        { pos: { line: 4, character: 13 }, declPos: listModuleDeclPos },
        { pos: { line: 4, character: 16 }, declPos: listModuleDeclPos },
        { pos: { line: 4, character: 29 }, declPos: listModuleDeclPos },
        { pos: { line: 4, character: 30 }, declPos: listModuleDeclPos },
        { pos: { line: 4, character: 33 }, declPos: listModuleDeclPos },
    ])('core:List-%#', testDefinitionSimple);

    // public type List<T> = Types.List<T>;
    //            ^^
    const listTypeDeclPos = location(listPath, 31, 14, 18);
    test.each([
        // Jump from:
        // let a : List.List<Int> = List.empty();
        // 1)          ^^
        // 2)           ^^
        // 3)              ^^
        // 4)                   ^^
        { pos: { line: 4, character: 17 }, declPos: listTypeDeclPos },
        { pos: { line: 4, character: 18 }, declPos: listTypeDeclPos },
        { pos: { line: 4, character: 21 }, declPos: listTypeDeclPos },
        { pos: { line: 4, character: 26 }, declPos: listTypeDeclPos },
    ])('core:List.List-%#', testDefinitionSimple);

    test.each([
        // Jump from:
        // let c : List
        //        .List<Int> = List.empty();
        { pos: { line: 6, character: 12 }, declPos: listModuleDeclPos },
        { pos: { line: 6, character: 13 }, declPos: listModuleDeclPos },
        { pos: { line: 6, character: 16 }, declPos: listModuleDeclPos },
        { pos: { line: 7, character: 12 }, declPos: listTypeDeclPos },
        { pos: { line: 7, character: 13 }, declPos: listTypeDeclPos },
        { pos: { line: 7, character: 16 }, declPos: listTypeDeclPos },
    ])('multiline-%#', testDefinitionSimple);

    test('Can find object method definition', () =>
        testDefinition(
            location('A.mo', 6, 17, 21), // a.meth
            [location('B.mo', 9, 20, 24)], // definition of meth
        ));

    test('Definition of value points to itself', () =>
        testDefinition(
            location('chain.mo', 7, 27, 28), // definition of x
            [location('chain.mo', 7, 27, 28)], // definition of x
        ));

    test('Can find nested value definition', () =>
        testDefinition(
            location('chain.mo', 12, 31, 32), // x in a.b.c.x
            [location('chain.mo', 7, 27, 28)], // definition of x
        ));

    test('Can find nested object definition (left)', () =>
        testDefinition(
            location('chain.mo', 12, 25, 26), // a in a.b.c.x
            [location('chain.mo', 2, 18, 19)], // definition of a
        ));

    test('Can find nested object definition (middle)', () =>
        testDefinition(
            location('chain.mo', 12, 27, 28), // b in a.b.c.x
            [location('chain.mo', 4, 22, 23)], // definition of b
        ));

    test('Can find nested object definition (right)', () =>
        testDefinition(
            location('chain.mo', 12, 29, 30), // c in a.b.c.x
            [location('chain.mo', 6, 26, 27)], // definition of c
        ));

    test('Can find circular object definition', async () => {
        await testDefinition(
            location('circular.mo', 2, 19, 20), // definition of o
            [location('circular.mo', 2, 19, 20)], // definition of o
        );
        for (const column of [12, 14, 16, 18, 20, 22]) {
            await testDefinition(
                location('circular.mo', 5, column, column + 1), // /\.o\.?/
                [location('circular.mo', 2, 19, 20)], // definition of o
            );
        }
    }, 20000);

    test('Can find definition for var', () =>
        testDefinition(
            location('var.mo', 4, 8, 9), // x
            [location('var.mo', 1, 8, 9)], // definition of x
        ));

    test('Can find definition of type from definition', () =>
        testDefinition(
            location('record.mo', 1, 9, 12), // definition of Foo
            [location('record.mo', 1, 9, 12)], // definition of Foo
        ));

    test('Can find definition of type from reference', () =>
        testDefinition(
            location('record.mo', 4, 18, 21), // Foo in annotation
            [location('record.mo', 1, 9, 12)], // definition of Foo
        ));

    test('Can find field from record type definition', () =>
        testDefinition(
            location('record.mo', 5, 12, 15), // bar in foo.bar (test1)
            [
                location('record.mo', 1, 17, 20), // type definition of bar (type Foo)
                location('record.mo', 4, 26, 29), // expression definition of bar (field assignment)
            ],
        ));

    test('Can find field from record expression definition', () =>
        testDefinition(
            location('record.mo', 4, 26, 29), // bar in { bar = 42 } (test1)
            [
                location('record.mo', 1, 17, 20), // type definition of bar (type Foo)
                location('record.mo', 4, 26, 29), // expression definition of bar (field assignment)
            ],
        ));

    test('Can find field from record type expression annotation', () =>
        testDefinition(
            location('record.mo', 10, 12, 15), // bar in foo.bar (test2)
            [
                location('record.mo', 9, 20, 23), // type definition of bar (expression type annotation)
                location('record.mo', 9, 36, 39), // expression definition of bar (field assignment)
            ],
        ));

    test('Can find field from record type pattern annotation', () =>
        testDefinition(
            location('record.mo', 15, 43, 46), // bar in foo.bar (test3)
            [
                location('record.mo', 14, 18, 21), // expression definition of bar (field assignment)
                location('record.mo', 15, 26, 29), // type definition of bar (pattern type annotation)
            ],
        ));
});
