# AGENTS.md

VS Code extension providing Motoko language support (type checking, formatting, snippets, and a language server).

## Commands

- Install dependencies: `npm ci` (or `npm install`). A `postinstall` step runs `npm run generate`.
- Build: `npm run compile` (bundles with esbuild into `out/`).
- Test: `npm test` (Jest). `pretest` installs Mops packages for the `test/` fixtures.
- Lint: `npm run lint` (ESLint on `.ts` files); autofix with `npm run lint:fix`.
- Format: `npm run format` (Prettier on `src`).
- Package a `.vsix`: `npm run package` (runs generate, `vsce package`, tests, and lint).

CI (`.github/workflows/tests.yml`) runs `npm ci`, `npm run compile`, then `npm test` on Node 24.

## Requirements

- Node.js >= 24.x (CI uses Node 24; the `engines` field requires VS Code `^1.75.0`).
- `.npmrc` sets `min-release-age=7`, so freshly published npm versions are quarantined for 7 days.

## Layout

- `src/` — TypeScript source. `src/server/` is the language server; `src/browser.ts` and `src/extension.ts` are entry points; `src/common/` is shared code.
- `src/generated/` — generated at install time by `scripts/generate.js`; gitignored and must never be hand-edited.
- `test/` — Jest fixtures; many subdirectories contain a `mops.toml` whose packages are installed before tests.
- `scripts/` — build/test helper scripts (`generate.js`, `install-test-deps.js`).
- `syntaxes/`, `snippets.json` — TextMate grammars and snippets (`snippets.json` is copied in during compile and gitignored).
- `guide/` — documentation assets. `assets/` — extension icons and images.
- `__mocks__/` — Jest module mocks.

## Conventions

- Prettier config: single quotes, semicolons, 4-space tabs, trailing commas (`all`). Do not reformat against these settings.
- A Husky pre-commit hook runs `lint-staged`, which runs ESLint (`--max-warnings=0`) and Prettier on staged `src` files.
- ESLint ignores `test/`, `scripts/`, `__mocks__/`, `out/`.
- The bundled Motoko compiler comes from the `motoko` npm package; version bumps are automated via `.github/workflows/update-motoko.yml`.
