# Releasing

1. Update the bundled Motoko compiler: `npm i motoko@latest`
2. Update `version` in `package.json`
3. Commit and push to `master`
4. Go to [GitHub Releases](https://github.com/caffeinelabs/vscode-motoko/releases) and draft a new release
5. Create a new tag matching the version (e.g. `v0.21.0`)
6. Leave the title blank so it's automatically populated with the version
7. Generate release notes by clicking **Generate release notes**
8. Click **Publish release**

The [release workflow](.github/workflows/release.yml) will automatically:
- Build the `.vsix` extension
- Publish it to the VS Code Marketplace
- Upload the `.vsix` as a release asset
