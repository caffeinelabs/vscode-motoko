import { Node } from 'motoko/lib/ast';
import {
    CompletionItem,
    CompletionItemKind,
    Position,
} from 'vscode-languageserver/node';

import { Context } from './context';
import { getImportName, hasImportWithPath, importTextEdit } from './imports';
import { findMostSpecificNodeForPosition } from './navigation';
import { matchNode, Program } from './syntax';

export function addContextualDotCompletions(
    items: CompletionItem[],
    program: Program,
    context: Context,
    position: Position,
): void {
    if (!program.ast) return;
    const cursorNode = findMostSpecificNodeForPosition(
        program.ast,
        position,
        (n) => {
            switch (n.name) {
                case 'DotE':
                    return 2; // pick DotE when possible
                // after typing the first dot, the AST still does not have DotE yet, so here we get the receiver directly
                case 'CallE':
                    return 1; // prefer CallE over TupE (an argument list)
                default:
                    return 0;
            }
        },
        +1, // When typing a field the AST is sometimes missing the last character, compensate for that
    );
    const receiverExp =
        matchNode(cursorNode, 'DotE', (receiver: Node) => receiver) ??
        cursorNode;
    if (!receiverExp) return;

    context.motoko
        .contextualDotSuggestions(receiverExp)
        ?.forEach((suggestion) => {
            const additionalTextEdits = hasImportWithPath(
                program.imports,
                suggestion.moduleUri,
            )
                ? undefined
                : [
                      importTextEdit(
                          program.imports,
                          getImportName(suggestion.moduleUri),
                          suggestion.moduleUri,
                      ),
                  ];
            const field = context.importResolver.getField(
                suggestion.moduleUri,
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
