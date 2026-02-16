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
