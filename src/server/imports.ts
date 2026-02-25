import { pascalCase } from 'change-case';
import { MultiMap } from 'mnemonist';
import { AST, Node } from 'motoko/lib/ast';
import {
    CompletionItemKind,
    CompletionItem,
    Position,
    TextEdit,
} from 'vscode-languageserver/node';
import { Context, getContext } from './context';
import { Import, Program, getIdName, asDecField, matchNode } from './syntax';
import { URI } from 'vscode-uri';
import { formatMotoko, getAbsoluteUri, getRelativeUri } from './utils';

export function extractFields(
    ast: AST,
    uri: string,
): MultiMap<string, CompletionItem, Set<CompletionItem>> {
    const fieldMap = new MultiMap<string, CompletionItem>(Set);
    matchNode(ast, 'ObjBlockE', (_s: string, _t: string, ...fields: Node[]) =>
        fields.forEach((field) => {
            const df = asDecField(field);
            if (!df || df.visibility !== 'Public') {
                return;
            }
            const { node, dec } = df;
            const doc = node.doc;
            matchNode(dec, 'LetD', (pat: Node, exp: Node) => {
                const name = matchNode(pat, 'VarP', (field: Node) => field);
                if (name) {
                    fieldMap.set(uri, {
                        label: getIdName(name)!,
                        kind:
                            exp.name === 'FuncE'
                                ? CompletionItemKind.Function
                                : CompletionItemKind.Variable,
                        documentation: doc,
                    });
                }
            });
            matchNode(dec, 'ClassD', (_local: string, name: Node) => {
                if (name) {
                    const className = getIdName(name)!;
                    fieldMap.set(uri, {
                        label: className,
                        kind: CompletionItemKind.Class,
                        documentation: doc,
                    });
                }
            });
            matchNode(dec, 'VarD', (name: Node, _exp: Node) => {
                if (name) {
                    fieldMap.set(uri, {
                        label: getIdName(name)!,
                        kind: CompletionItemKind.Variable,
                        documentation: doc,
                    });
                }
            });
            matchNode(dec, 'TypD', (name: Node, _exp: Node) => {
                if (name) {
                    fieldMap.set(uri, {
                        label: getIdName(name)!,
                        kind: CompletionItemKind.Interface,
                        documentation: doc,
                    });
                }
            });
        }),
    );
    return fieldMap;
}

export default class ImportResolver {
    // module name -> uri
    private readonly _moduleNameUriMap = new MultiMap<string, string>(Set);
    // uri -> resolved field
    private readonly _fieldMap = new MultiMap<string, CompletionItem>(Set);
    // import path -> file system uri
    private readonly _fileSystemMap = new Map<string, string>();

    constructor(private readonly context: Context) {}

    clear() {
        this._moduleNameUriMap.clear();
    }

    update(uri: string, program: Program | undefined): boolean {
        const info = getImportInfo(uri, this.context);
        if (!info) {
            return false;
        }
        const [name, importUri] = info;
        this._moduleNameUriMap.set(name, importUri);
        this._fileSystemMap.set(importUri, uri);
        this._updateFields(uri, program);
        return true;
    }

    _updateFields(uri: string, program: Program | undefined) {
        this._fieldMap.delete(uri);
        program?.exportFields.forEach(({ exp }) => {
            const fieldMap = extractFields(exp.ast, uri);
            fieldMap.forEach((value, key, _map) =>
                this._fieldMap.set(key, value),
            );
        });
    }

    delete(uri: string): boolean {
        const info = getImportInfo(uri, this.context);
        if (!info) {
            return false;
        }
        const [, importUri] = info;

        let changed = false;
        for (const key of this._moduleNameUriMap.keys()) {
            if (this._moduleNameUriMap.remove(key, importUri)) {
                changed = true;
            }
        }
        if (this._fieldMap.delete(uri)) {
            changed = true;
        }
        return changed;
    }

    getImportPaths(name: string, uri: string): string[] {
        const options = this._moduleNameUriMap.get(name);
        if (!options) {
            return [];
        }
        return [...options].map((option) => getRelativeUri(uri, option));
    }

    getUrisByModuleName(name: string): string[] {
        const uris = [];
        for (const [key, value] of this._moduleNameUriMap.entries()) {
            if (key === name) {
                uris.push(value + '.mo');
            }
        }
        return uris;
    }

    /**
     * Finds all available module-level imports.
     * @returns Array of `[name, path]` entries
     */
    getNameEntries(): [string, string][] {
        return [...this._moduleNameUriMap.entries()];
    }

    // /**
    //  * Finds all importable fields.
    //  * @returns Array of `[name, field, path]` entries
    //  */
    // getFieldEntries(uri: string): [ResolvedField, string][] {
    //     return [...this._fieldMap.entries()].map(([path, field]) => [
    //         field,
    //         getRelativeUri(uri, path),
    //     ]);
    // }

    /**
     * Finds all importable fields for a given document.
     * @returns Array of `[name, field, path]` entries
     */
    getFields(uri: string): CompletionItem[] {
        const fields = this._fieldMap.get(uri);
        return fields ? [...fields] : [];
    }

    /**
     * Finds a specific importable field by label in a module.
     * @param uri Absolute file import URI (e.g. `mo:package/File`, `canister:alias`, `file:///Lib`)
     * @param label The field label to find
     */
    getField(uri: string, label: string): CompletionItem | undefined {
        const fsUri = this.getFileSystemURI(uri);
        if (!fsUri) return undefined;
        return this.getFields(fsUri).find((f) => f.label === label);
    }

    /**
     * Converts a resolved import path into the corresponding file system URI.
     * @param uri Absolute file import URI (e.g. `mo:package/File`, `canister:alias`, `file:///Lib`)
     */
    getFileSystemURI(uri: string): string | undefined {
        return (
            this._fileSystemMap.get(uri) ||
            this._fileSystemMap.get(`${uri}/lib`)
        );
    }
}

export function getImportName(path: string): string {
    return pascalCase(/([^/]+)$/i.exec(path)?.[1] || '');
}

function getImportInfo(
    uri: string,
    context: Context,
): [string, string] | undefined {
    if (!uri.endsWith('.mo')) {
        return;
    }
    uri = uri.slice(0, -'.mo'.length);
    // Resolve package import paths
    for (const regex of [
        /\.vessel\/([^/]+)\/[^/]+\/src\/(.+)/,
        /\.mops\/([^%/]+)%40[^/]+\/src\/(.+)/,
        /\.mops\/_github\/([^%/]+)%40[^/]+\/src\/(.+)/,
    ]) {
        const match = regex.exec(uri);
        if (match) {
            if (getContext(uri) !== context) {
                // Skip packages from other contexts
                return;
            }
            const [, name, path] = match;
            if (path === 'lib') {
                // Account for `lib.mo` entry point
                return [getImportName(name), `mo:${name}`];
            } else {
                // Resolve `mo:` URI for Vessel and MOPS packages
                return [getImportName(uri) || name, `mo:${name}/${path}`];
            }
        }
    }
    if (uri.includes('/.vessel/') || uri.includes('/.mops/')) {
        // Ignore everything else in Vessel and MOPS cache directories
        return;
    }
    return [getImportName(uri), uri];
}

const importGroups: {
    prefix: string;
}[] = [
    // IC imports
    { prefix: 'ic:' },
    // Canister alias imports
    { prefix: 'canister:' },
    // Package imports
    { prefix: 'mo:' },
    // Everything else
    { prefix: '' },
];

export function organizeImports(imports: Import[]): string {
    const groupParts: string[][] = importGroups.map(() => []);

    // Combine imports with the same path
    const combinedImports: Record<
        string,
        { names: string[]; fields: [string, string][] }
    > = {};
    imports.forEach((x) => {
        const combined =
            combinedImports[x.path] ||
            (combinedImports[x.path] = { names: [], fields: [] });
        if (x.name) {
            combined.names.push(x.name);
        }
        combined.fields.push(...x.fields);
    });

    // Sort and print imports
    Object.entries(combinedImports)
        .sort(
            // Sort by import path
            (a, b) => a[0].localeCompare(b[0]),
        )
        .forEach(([path, { names, fields }]) => {
            const parts =
                groupParts[
                    importGroups.findIndex((g) => path.startsWith(g.prefix))
                ] || groupParts[groupParts.length - 1];
            names.forEach((name) => {
                parts.push(`import ${name} ${JSON.stringify(path)};`);
            });
            if (fields.length) {
                parts.push(
                    `import { ${fields
                        .sort(
                            // Sort by name, then alias
                            (a, b) =>
                                a[0].localeCompare(b[0]) ||
                                (a[1] || a[0]).localeCompare(b[1] || b[0]),
                        )
                        .map(([name, alias]) =>
                            !alias || name === alias
                                ? name
                                : `${name} = ${alias}`,
                        )
                        .join('; ')} } ${JSON.stringify(path)};`,
                );
            }
        });

    return formatMotoko(groupParts.map((p) => p.join('\n')).join('\n\n'));
}

/**
 * Finds the position where a new import should be inserted.
 * @param imports The existing imports in the program
 * @param importPath The path of the import to add
 * @returns The position where the new import should be inserted
 */
export function findImportInsertPosition(
    imports: Import[] | undefined,
    importPath: string,
): Position {
    if (!imports?.length) {
        return Position.create(0, 0);
    }

    let lastImport = imports[imports.length - 1];

    // add after last import from the same package
    if (importPath.startsWith('mo:')) {
        const importsReversed = imports.slice().reverse();
        const packagePrefix = importPath.split('/')[0];

        const lastSamePackageImport = importsReversed.find((imprt) => {
            return (
                imprt.path === packagePrefix ||
                imprt.path.startsWith(`${packagePrefix}/`)
            );
        });
        if (lastSamePackageImport) {
            lastImport = lastSamePackageImport;
        } else {
            // add after last package import
            const lastPackageImport = importsReversed.find((imprt) => {
                return imprt.path.startsWith('mo:');
            });
            if (lastPackageImport) {
                lastImport = lastPackageImport;
            }
        }
    }

    const end = (lastImport.ast as Node)?.end;
    if (end) {
        return Position.create(end[0], 0);
    }
    return Position.create(0, 0);
}

/**
 * Checks if an import with the given name already exists.
 * Matches against module name or field alias.
 */
export function hasImportWithName(
    imports: Import[] | undefined,
    name: string,
): boolean {
    if (!imports) return false;
    return imports.some(
        (i) => i.name === name || i.fields.some(([, alias]) => alias === name),
    );
}

function stripMoExtension(path: string): string {
    return path.endsWith('.mo') ? path.slice(0, -3) : path;
}

/**
 * Converts a compiler virtual path (e.g. `/Users/.../libA.mo`)
 * to a module URI (e.g. `file:///Users/.../libA`).
 * Scheme-based URIs (e.g. `mo:core/Array`) are returned as-is.
 */
export function importUriFromCompilerUri(moduleUri: string): string {
    if (moduleUri.includes(':')) {
        return moduleUri;
    }
    return URI.file(stripMoExtension(moduleUri)).toString();
}

/**
 * Resolves a Motoko import path to a full module URI.
 * Scheme-based paths (e.g. `mo:core/Array`) are returned as-is.
 * Relative paths are resolved against the document URI.
 */
export function resolveImportUri(
    documentUri: string,
    importPath: string,
): string {
    if (importPath.includes(':')) {
        return importPath;
    }
    return getAbsoluteUri(documentUri, '..', importPath);
}

/**
 * Checks if any existing import references the same module as the given module URI.
 */
export function hasImportForModule(
    imports: Import[] | undefined,
    documentUri: string,
    moduleUri: string,
): boolean {
    if (!imports) return false;
    return imports.some(
        (i) => resolveImportUri(documentUri, i.path) === moduleUri,
    );
}

/**
 * Creates a TextEdit for adding a new import.
 */
export function importTextEdit(
    imports: Import[] | undefined,
    name: string,
    path: string,
): TextEdit {
    return TextEdit.insert(
        findImportInsertPosition(imports, path),
        `import ${name} "${path}";\n`,
    );
}
