# Releasing

1. Update `version` in `package.json`
2. Commit and push to `main`
3. Go to [GitHub Releases](https://github.com/caffeinelabs/vscode-motoko/releases) and draft a new release
4. Create a new tag matching the version (e.g. `v0.21.0`)
5. Leave the title blank so it's automatically populated with the version
6. Generate release notes by clicking **Generate release notes**
7. Click **Publish release**

The [release workflow](.github/workflows/release.yml) will automatically:
- Build the `.vsix` extension
- Publish it to the VS Code Marketplace
- Upload the `.vsix` as a release asset
