import { Node } from 'motoko/lib/ast';
import {
    CompletionItem,
    CompletionItemKind,
    Position,
} from 'vscode-languageserver/node';

import { Context } from './context';
import {
    getImportName,
    hasImportForModule as hasImportUri,
    importTextEdit,
    importUriFromCompilerUri,
} from './imports';
import { getRelativeUri } from './utils';
import { findMostSpecificNodeForPosition } from './navigation';
import { matchNode, Program } from './syntax';

export function addContextualDotCompletions(
    items: CompletionItem[],
    program: Program,
    context: Context,
    position: Position,
    documentUri: string,
): void {
    if (!program.ast) return;
    const cursorNode = findMostSpecificNodeForPosition(
        program.ast,
        position,
        (n) => n.name === 'DotE',
    );
    const receiverExp = matchNode(
        cursorNode,
        'DotE',
        (receiver: Node) => receiver,
    );
    if (!receiverExp) return;

    context
        .contextualDotSuggestions?.(receiverExp, program)
        ?.forEach((suggestion) => {
            // Note: suggestion.moduleUri is either an absolute path with .mo extension or `mo:` URI like "mo:core/Array"
            const importUri = importUriFromCompilerUri(suggestion.moduleUri);
            const importPath = getRelativeUri(documentUri, importUri);
            const additionalTextEdits = hasImportUri(
                program.imports,
                documentUri,
                importUri,
            )
                ? undefined
                : [
                      importTextEdit(
                          program.imports,
                          getImportName(importPath),
                          importPath,
                      ),
                  ];
            const field = context.importResolver.getField(
                importUri,
                suggestion.funcName,
            );
            items.push({
                label: suggestion.funcName,
                kind: CompletionItemKind.Method,
                detail: suggestion.funcType,
                documentation: field?.documentation,
                insertText: suggestion.funcName,
                additionalTextEdits,
            });
        });
}
