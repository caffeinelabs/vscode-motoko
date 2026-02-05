import { Node } from 'motoko/lib/ast';
import {
    CompletionItem,
    CompletionItemKind,
    Position,
    TextEdit,
} from 'vscode-languageserver/node';

import { Context } from './context';
import { findImportInsertPosition, getImportName } from './imports';
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
        +1, // When typing a field the AST is sometimes missing the last character, compensate for that
    );
    const receiverExp = matchNode(
        cursorNode,
        'DotE',
        (receiver: Node) => receiver,
    );
    if (!receiverExp) return;

    context.motoko
        .contextualDotSuggestions(receiverExp)
        ?.forEach((suggestion) => {
            const existingImport = program.imports.find(
                (i) => i.path === suggestion.moduleUri,
            );
            const additionalTextEdits = existingImport
                ? undefined
                : [
                      TextEdit.insert(
                          findImportInsertPosition(
                              program.imports,
                              suggestion.moduleUri,
                          ),
                          `import ${getImportName(suggestion.moduleUri)} "${
                              suggestion.moduleUri
                          }";\n`,
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
