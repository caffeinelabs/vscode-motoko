import { AST, Node, Span } from 'motoko/lib/ast';
import { Position } from 'vscode-languageserver/node';

/**
 * Converts a 1-based AST {@link Span} to a 0-based LSP {@link Position}.
 */
export function spanToPosition(span: Span): Position {
    return { line: span[0] - 1, character: span[1] };
}

export function getIdName(
    ast: AST | undefined,
    defaultName?: string,
): string | undefined {
    return matchNode(ast, 'ID', (name: string) => name) ?? defaultName;
}

export function findNodes(
    ast: AST,
    condition?: (node: Node, parents: Node[]) => any,
): Node[] {
    const nodes: Node[] = [];
    const parents: Node[] = [];
    findNodes_(ast, condition, nodes, parents);
    return nodes;
}

function findNodes_(
    ast: AST,
    condition: ((node: Node, parents: Node[]) => any) | undefined,
    nodes: Node[],
    parents: Node[],
) {
    if (!ast || typeof ast === 'string' || typeof ast === 'number') {
        return;
    }
    if (Array.isArray(ast)) {
        for (let i = 0; i < ast.length; i++) {
            const arg = ast[i];
            findNodes_(arg, condition, nodes, parents);
        }
        return;
    }

    if (condition?.(ast, parents)) {
        nodes.push(ast);
    }
    if (ast.args) {
        parents.push(ast);
        findNodes_(ast.args, condition, nodes, parents);
        if (parents.pop() !== ast) {
            throw new Error('Unexpected parent node in stack');
        }
    }
    if (ast.typeRep) {
        parents.push(ast);
        findNodes_(ast.typeRep, condition, nodes, parents);
        if (parents.pop() !== ast) {
            throw new Error('Unexpected parent node in stack');
        }
    }
}

export function fromAST(ast: AST): Syntax {
    if (
        !ast ||
        Array.isArray(ast) ||
        typeof ast === 'string' ||
        typeof ast === 'number'
    ) {
        return new Syntax(ast);
    } else if (ast.name === 'AwaitE') {
        const exp = ast.args![0];
        return (
            matchNode(exp, 'AsyncE', (_id: Node, exp: Node) => fromAST(exp)) ||
            new Syntax(exp)
        );
    } else if (ast.name === 'Prog') {
        const prog = new Program(ast);
        if (ast.args) {
            ast.args.forEach((a) => {
                matchNode(a, 'LetD', (pat, exp) => {
                    matchNode(exp, 'ImportE', (path) => {
                        const import_ = new Import(exp, path);
                        // Variable pattern name
                        import_.name = matchNode(pat, 'VarP', (id: AST) =>
                            getIdName(id),
                        );
                        // Object pattern fields
                        import_.fields = matchNode(
                            pat,
                            'ObjP',
                            (...args) =>
                                args.map(
                                    (
                                        field: Node & { args: [string, Node] },
                                    ) => {
                                        const name = field.args[0];
                                        const alias =
                                            getIdName(field.args[1]!, name) ||
                                            name;
                                        return [name, alias];
                                    },
                                ),
                            [],
                        );
                        prog.imports.push(import_);
                    });
                });
            });
            if (ast.args.length) {
                const export_ = ast.args[ast.args.length - 1];
                if (export_) {
                    prog.export = fromAST(export_);
                    prog.exportFields.push(...getFieldsFromAST(export_));
                }
            }
        }
        return prog;
    } else if (ast.name === 'ObjBlockE' && ast.args) {
        const sort = ast.args[0] as ObjSort;
        const fields = ast.args.slice(2) as Node[];

        const obj = new ObjBlock(ast, sort);
        fields.forEach((field) => {
            const df = asDecField(field);
            if (!df) {
                console.error('Error: expected `DecField`, received', field);
                return;
            }
            obj.fields.push(...getFieldsFromAST(df.dec));
        });
        return obj;
    }
    return new Syntax(ast);
}

function getFieldsFromAST(ast: AST): Field[] {
    const simplyNamedFields =
        matchNode(ast, 'TypD', (id: Node, type: Node) => {
            const field = new Field(ast, new Type(type));
            field.name = getIdName(id)!;
            return [field];
        }) ||
        matchNode(ast, 'VarD', (id: Node, exp: Node) => {
            const field = new Field(ast, new Type(exp));
            field.name = getIdName(id)!;
            return [field];
        }) ||
        matchNode(
            ast,
            'ClassD',
            (_sharedPat: any, id: Node, ...args: any[]) => {
                let index = args.length - 1;
                while (index >= 0 && typeof args[index] !== 'string') {
                    index--;
                }
                index -= 2; // [pat, returnType, sort]
                if (index < 0) {
                    console.warn('Unexpected `ClassD` AST format');
                    return [];
                }
                // const typeBinds = args.slice(0, index) as Node[];
                const [_pat, _returnType, sort, _id, ...decs] = args.slice(
                    index,
                ) as [Node, Node, ObjSort, Node, ...Node[]];

                const name = getIdName(id)!;
                const cls = new Class(ast, name, sort);
                decs.forEach((ast) => {
                    matchDecField(ast, ({ dec }) => {
                        cls.fields.push(...getFieldsFromAST(dec));
                    });
                });
                const field = new Field(ast, cls);
                field.name = name;
                return [field];
            },
        );
    if (simplyNamedFields) {
        return simplyNamedFields;
    }
    const parts: [Node | undefined, Node] | undefined =
        matchNode(ast, 'LetD', (pat: Node, exp: Node) => [pat, exp]) || // Named
        matchNode(ast, 'ExpD', (exp: Node) => [undefined, exp]); // Unnamed
    if (!parts) {
        return [];
    }
    const [pat, exp] = parts;
    if (pat) {
        const fields: [string, Node, Node][] = [];
        findInPattern(pat, (name, pat) => {
            fields.push([name, pat, exp]);
        });
        return fields.map(([name, pat, exp]) => {
            const field = new Field(ast, fromAST(exp));
            field.name = name;
            field.pat = fromAST(pat);
            return field;
        });
    } else {
        const field = new Field(ast, fromAST(exp));
        return [field];
    }
}

export function findInPattern<T>(
    pat: Node,
    fn: (name: string, pat: Node) => T | undefined,
): T | undefined {
    const matchAny = (...args: Node[]) => {
        for (const field of args) {
            const result = findInPattern(field, fn);
            if (result !== undefined) {
                return result;
            }
        }
        return;
    };
    const match = (arg: Node) => findInPattern(arg, fn);
    return (
        matchNode(pat, 'VarP', (id: Node) => fn(getIdName(id)!, id)) ||
        matchNode(pat, 'ObjP', (...args: Node[]) => {
            for (const field of args) {
                const result = matchNode(
                    field,
                    'ValPF',
                    (_fieldName: string, fieldPat: Node) =>
                        findInPattern(fieldPat, fn),
                );
                if (result !== undefined) {
                    return result;
                }
            }
            return;
        }) ||
        matchNode(pat, 'TupP', matchAny) ||
        matchNode(pat, 'AltP', matchAny) ||
        matchNode(pat, 'AnnotP', match) ||
        matchNode(pat, 'ParP', match) ||
        matchNode(pat, 'OptP', match) ||
        matchNode(pat, 'TagP', (_tag, arg: Node) => match(arg))
    );
}

export function asNode(ast: AST | undefined): Node | undefined {
    return ast && typeof ast === 'object' && !Array.isArray(ast)
        ? ast
        : undefined;
}

export function matchNode<T>(
    ast: AST | undefined,
    name: string,
    fn: (...args: any) => T,
): T | undefined;
export function matchNode<T>(
    ast: AST | undefined,
    name: string,
    fn: (...args: any) => T,
    defaultValue: T,
): T;
export function matchNode<T>(
    ast: AST | undefined,
    name: string,
    fn: (...args: any) => T,
    defaultValue?: T,
): T | undefined {
    if (
        ast &&
        typeof ast === 'object' &&
        !Array.isArray(ast) &&
        ast.name === name
    ) {
        return ast.args ? fn(...ast.args) : fn();
    }
    return defaultValue;
}

// --- Typed AST matchers (shapes documented from `astjs.ml`) ---

export type Visibility = 'Public' | 'Private' | 'System';

export interface NodeMatch {
    node: Node;
}

export interface DecFieldMatch extends NodeMatch {
    dec: Node;
    visibility: Visibility;
    stab: AST;
}

export interface DotEMatch extends NodeMatch {
    receiver: Node;
    id: Node; // ID node on RHS
}

export interface FuncEMatch extends NodeMatch {
    paramPat: Node;
    /** Return type annotation node, or `undefined` when the source had no annotation (serialized as `"_"`). */
    returnTypeAnnot: Node | undefined;
    body: Node;
}

export interface CallEMatch extends NodeMatch {
    /** The function expression being called (e.g. a DotE for method calls, VarE for plain calls). */
    funcExpr: Node;
    /** The argument to the call (last element): TupE for 0 or 2+ args, or the value directly for 1 arg. Always a Node since it comes from `exp_js`. */
    callArg: Node;
}

// Mirrors `vis_js` in `astjs.ml`: either a plain string or an object with `name`.
export function matchVisibility(vis: AST): Visibility {
    if (vis === 'Public' || vis === 'Private' || vis === 'System') {
        return vis;
    }

    // `astjs.ml` serializes either as a string (handled above) or an object
    // representing that it's public.
    return 'Public';
}

// Mirrors `dec_field'_js` in `astjs.ml`: args are `[dec, vis, stab]`.
export function asDecField(ast: AST | undefined): DecFieldMatch | undefined {
    return matchNode(ast, 'DecField', (dec: Node, vis: AST, stab: AST) => ({
        node: ast as Node,
        dec,
        visibility: matchVisibility(vis),
        stab,
    }));
}

// Mirrors `DotE` in `astjs.ml`: args are `[exp, id]`.
export function asDotE(ast: AST | undefined): DotEMatch | undefined {
    return matchNode(ast, 'DotE', (receiver: Node, id: Node) => ({
        node: ast as Node,
        receiver,
        id,
    }));
}

export function asFuncE(ast: AST | undefined): FuncEMatch | undefined {
    return matchNode(ast, 'FuncE', (...args: AST[]) => {
        const paramPat = asNode(args[args.length - 4]);
        const returnTypeAnnot = asNode(args[args.length - 3]);
        const body = asNode(args[args.length - 1]);
        if (!paramPat || !body) return undefined;
        return { node: ast as Node, paramPat, returnTypeAnnot, body };
    });
}

// Mirrors `CallE` in `astjs.ml`: args are `[funcExpr, ...typeInst, callArg]`.
export function asCallE(ast: AST | undefined): CallEMatch | undefined {
    return matchNode(ast, 'CallE', (...args: AST[]) => {
        const funcExpr = asNode(args[0]);
        const callArg = asNode(args[args.length - 1]);
        if (!funcExpr || !callArg) return undefined;
        return { node: ast as Node, funcExpr, callArg };
    });
}

// --- Pattern matchers ---

/** WildP patterns serialize as plain strings, not Node objects. */
export type PatternElement = Node | 'WildP';

export interface TupPMatch extends NodeMatch {
    elements: PatternElement[];
}

export function asTupP(ast: AST | undefined): TupPMatch | undefined {
    return matchNode(ast, 'TupP', (...elements: PatternElement[]) => ({
        node: ast as Node,
        elements,
    }));
}

export interface VarPMatch extends NodeMatch {
    id: Node;
}

export interface AnnotPMatch extends NodeMatch {
    pat: Node;
    typeAnnot: Node;
}

export interface ParPMatch extends NodeMatch {
    inner: Node;
}

export function asVarP(ast: AST | undefined): VarPMatch | undefined {
    return matchNode(ast, 'VarP', (id: Node) => ({
        node: ast as Node,
        id,
    }));
}

export function asAnnotP(ast: AST | undefined): AnnotPMatch | undefined {
    return matchNode(ast, 'AnnotP', (pat: Node, typeAnnot: Node) => ({
        node: ast as Node,
        pat,
        typeAnnot,
    }));
}

export function asParP(ast: AST | undefined): ParPMatch | undefined {
    return matchNode(ast, 'ParP', (inner: Node) => ({
        node: ast as Node,
        inner,
    }));
}

/** Recursively unwraps `ParP` nodes, returning the innermost non-parenthesized pattern. */
export function unwrapParP(pat: Node): Node {
    const p = asParP(pat);
    return p ? unwrapParP(p.inner) : pat;
}

// --- Type matchers ---

export interface NamedTMatch extends NodeMatch {
    label: string;
    type: Node;
}

export function asNamedT(ast: AST | undefined): NamedTMatch | undefined {
    return matchNode(ast, 'NamedT', (label: string, type: Node) => ({
        node: ast as Node,
        label,
        type,
    }));
}

export function asParT(ast: AST | undefined): Node | undefined {
    return matchNode(ast, 'ParT', (inner: Node) => inner);
}

/** Recursively unwraps `ParT` nodes, returning the innermost non-parenthesized type. */
export function unwrapParT(typ: Node): Node {
    const inner = asParT(typ);
    return inner ? unwrapParT(inner) : typ;
}

// ---------

export function matchDecField<T>(
    ast: AST | undefined,
    fn: (match: DecFieldMatch) => T,
): T | undefined {
    const df = asDecField(ast);
    return df ? fn(df) : undefined;
}

export class Syntax {
    ast: AST;

    constructor(ast: AST) {
        this.ast = ast;
    }
}

export class Program extends Syntax {
    imports: Import[] = [];
    export: Syntax | undefined;
    exportFields: Field[] = [];
}

export abstract class SyntaxWithFields extends Syntax {
    fields: Field[] = [];
}

export type ObjSort = 'Object' | 'Actor' | 'Module' | 'Memory';

export class ObjBlock extends SyntaxWithFields {
    constructor(ast: AST, public sort: ObjSort) {
        super(ast);
    }
}

export class Class extends SyntaxWithFields {
    constructor(ast: AST, public name: string, public sort: ObjSort) {
        super(ast);
    }
}

export class Field extends Syntax {
    name: string | undefined;
    pat: Syntax | undefined;

    constructor(ast: AST, public exp: Syntax) {
        super(ast);
    }
}

export class Import extends Syntax {
    name: string | undefined;
    fields: [string, string][] = []; // [name, alias]

    constructor(ast: AST, public path: string) {
        super(ast);
    }
}

export class Type extends Syntax {}
