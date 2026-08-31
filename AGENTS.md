# AGENTS.md

VS Code extension providing Motoko language support (type checking, formatting, snippets, and a language server).

## Requirements

- Node.js >= 24 (CI runs on 24.x). Cargo is required only for building against a local Motoko compiler.
- `npm ci` runs `postinstall`, which runs `npm run generate`. This downloads files over the network into `src/generated/`; installs will fail offline.

## Build, test, lint, format

- `npm run compile` — bundle the extension, browser, server, and Motoko into `out/` via esbuild.
- `npm test` — run the Jest test suite. `pretest` runs `scripts/install-test-deps.js` first.
- `npm run lint` — ESLint over TypeScript (`eslint . --ext ts`). `npm run lint:fix` to autofix.
- `npm run format` — Prettier over `src`.
- `npm run package` — generate, `vsce package` (produces `vscode-motoko-*.vsix` at the repo root), then test and lint.

CI (`.github/workflows/tests.yml`) runs `npm ci`, `npm run compile`, then `npm test` on Node 24.x.

## Generated files (never hand-edit)

- `src/generated/**` — created by `scripts/generate.js` (downloaded/derived); gitignored.
- `snippets.json`, `out/` — build artifacts; gitignored.
- `.vsix` files — packaged output.

## Layout

- `src/server/` — language server (AST, completions, hover, navigation, formatter, dfx integration).
- `src/common/` — code shared between client and server.
- `src/browser.ts`, `src/extension.ts` — web and Node extension entry points.
- `scripts/` — build/setup helpers (`generate.js`, `install-test-deps.js`).
- `syntaxes/`, `assets/`, `guide/` — TextMate grammars, images, and documentation assets.
- `test/` — Jest fixtures grouped by feature; some use `mops.toml` for Motoko package resolution.
- `__mocks__/` — Jest module mocks.

## Conventions

- Prettier config: single quotes, semicolons, 4-space tabs, trailing commas. `src/generated/**` is excluded from formatting.
- A Husky `pre-commit` hook runs `lint-staged`, which ESLint-fixes (`--max-warnings=0`) and Prettier-formats staged `src` JS/TS files.
- `.npmrc` sets `min-release-age=7`, quarantining npm releases newer than 7 days.
- Tests live alongside code as `*.spec.ts` and under `test/`.
