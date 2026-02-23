import { AST, Node } from 'motoko/lib/ast';

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

export interface CallEMatch {
    /** The function expression being called (e.g. a DotE for method calls, VarE for plain calls). */
    funcExpr: Node;
    /** The argument to the call (last element): TupE for 0 or 2+ args, or the value directly for 1 arg. Always a Node since it comes from `exp_js`. */
    callArg: Node;
}

/**
 * Matches a CallE (function call) node.
 *
 * From `astjs.ml`:
 * ```
 * CallE (par_opt, e1, ts, (_, e2)) ->
 *   parenthetical par_opt ([ exp_js e1 ] @ inst ts @ [ exp_js !e2 ])
 * ```
 *
 * Resulting args: `[funcExpr, ...typeInsts, callArg]`
 * - `funcExpr`: the function expression being called (e.g. DotE, VarE)
 * - `typeInsts`: zero or more explicit type instantiation nodes
 * - `callArg`: the argument expression (always the last element)
 */
export function matchCallE(node: Node | undefined): CallEMatch | undefined {
    if (!node || node.name !== 'CallE' || !node.args || node.args.length < 2)
        return undefined;
    const funcExpr = asNode(node.args[0]);
    const callArg = asNode(node.args[node.args.length - 1]);
    if (!funcExpr || !callArg) return undefined;
    return { funcExpr, callArg };
}

export interface FuncParam {
    name: string;
    /** The type AST. Usually a Node but can be a string for `Any`, `Non`, `Pre`. */
    type: AST;
}

export interface FuncTypeMatch {
    params: FuncParam[];
    /** Individual return types. Usually Nodes but can be strings for `Any`, `Non`, `Pre`. */
    returnTypes: AST[];
}

/**
 * Matches a Func typeRep and extracts structured parameter/return information.
 *
 * From `astjs.ml`:
 * ```
 * Func (s, c, tbs, at, rt) ->
 *   [ func_sort_js s; control_js c ] @ List.map bind_js tbs
 *   @ [ to_js_object "" (List.map typ_js at);
 *       to_js_object "" (List.map typ_js rt) ]
 * ```
 *
 * Resulting args: `[sort, control, ...typBinds, inputs, outputs]`
 * - `sort`: sharing mode string (e.g. "Local", "Shared", "Shared Query")
 * - `control`: return control string (e.g. "Returns", "Promises", "Replies")
 * - `typBinds`: zero or more type parameter bindings (for generic functions)
 * - `inputs` (2nd-to-last): `{ name: '', args: [param, ...] }` where each param
 *   is a Named type `{ name: 'Name', args: [paramName: string, paramType: AST] }`
 * - `outputs` (last): `{ name: '', args: [type, ...] }` containing return type(s)
 */
export function matchFuncTypeRep(
    typeRep: Node | undefined,
): FuncTypeMatch | undefined {
    if (
        !typeRep ||
        typeRep.name !== 'Func' ||
        !typeRep.args ||
        typeRep.args.length < 4
    )
        return undefined;

    const len = typeRep.args.length;
    const inputsNode = asNode(typeRep.args[len - 2]);
    const outputsNode = asNode(typeRep.args[len - 1]);

    const params: FuncParam[] = (inputsNode?.args ?? [])
        .map(asNode)
        .filter(
            (n): n is Node =>
                !!n && n.name === 'Name' && !!n.args && n.args.length >= 2,
        )
        .map((n) => ({ name: String(n.args![0]), type: n.args![1] }));

    return {
        params,
        returnTypes: (outputsNode?.args ?? []) as AST[],
    };
}

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
