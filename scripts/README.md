# Release Script

Automated release script for sudachi-ts that handles version bumping, building, testing, git tagging, and npm publishing.

## Features

- **Version Bumping**: Automatically bump major, minor, or patch versions
- **Custom Versions**: Specify an exact version number if needed
- **Pre-release Validation**: Runs build, tests, and type checking before releasing
- **Git Integration**: Commits version changes and creates annotated tags
- **Dry Run Mode**: Preview what would happen without making actual changes
- **Flexible Operations**: Skip git or npm publishing when needed

## Usage

### Basic Usage

```bash
# Perform a patch release (default)
./scripts/release.sh

# Perform a minor release
./scripts/release.sh --minor

# Perform a major release
./scripts/release.sh --major
```

### With Dry Run

Preview the release process without making any changes:

```bash
./scripts/release.sh --dry-run
./scripts/release.sh --minor --dry-run
```

### Custom Version

Specify an exact version number:

```bash
./scripts/release.sh --version 1.2.3
```

### Skip Operations

Skip git operations or npm publishing:

```bash
# Bump version and publish without git
./scripts/release.sh --skip-git

# Bump version and commit/tag without publishing
./scripts/release.sh --skip-publish
```

### Help

```bash
./scripts/release.sh --help
```

## Options

| Option | Description |
|--------|-------------|
| `--major` | Bump major version (e.g., 1.0.0 → 2.0.0) |
| `--minor` | Bump minor version (e.g., 1.0.0 → 1.1.0) |
| `--patch` | Bump patch version (e.g., 1.0.0 → 1.0.1) [default] |
| `--version <ver>` | Set specific version (e.g., 1.2.3) |
| `--dry-run` | Show what would be done without executing |
| `--skip-git` | Skip git commit and tag |
| `--skip-publish` | Skip npm publish |
| `-h, --help` | Show help message |

## Release Process

When you run the release script, it performs the following steps:

1. **Version Calculation**: Determines the new version based on the selected option
2. **Update package.json**: Bumps the version number in package.json
3. **Build**: Compiles the TypeScript code
4. **Test**: Runs the test suite
5. **Type Check**: Validates TypeScript types
6. **Git Commit** (unless `--skip-git`):
   - Stages the updated package.json
   - Creates a commit with message "chore: release v{version}"
   - Creates an annotated tag "v{version}"
7. **Publish** (unless `--skip-publish`): Publishes to npm using bun
8. **Git Push** (unless `--skip-git`): Pushes commit and tags to remote

## Prerequisites

Before running the release script:

1. **Clean Working Directory**: Ensure all changes are committed or stashed
2. **Authentication**: You must be authenticated with npm:
    ```bash
    npm login
    ```
3. **Git Access**: You must have push access to the repository
4. **Pass Tests**: All tests must pass
5. **No Type Errors**: TypeScript must compile without errors

## Workflow Example

### Standard Patch Release

```bash
# 1. Ensure working directory is clean
git status

# 2. Run dry-run to verify
./scripts/release.sh --dry-run

# 3. Perform the release
./scripts/release.sh
```

### Feature Release (Minor Bump)

```bash
# 1. Update CHANGELOG.md with new features
# 2. Commit the changes
git add CHANGELOG.md
git commit -m "docs: update changelog for v1.1.0"

# 3. Perform the release
./scripts/release.sh --minor
```

### Breaking Change (Major Bump)

```bash
# 1. Update documentation for breaking changes
# 2. Commit the changes
git add .
git commit -m "docs: document breaking changes for v2.0.0"

# 3. Perform the release
./scripts/release.sh --major
```

## Troubleshooting

### "Working directory is not clean"

Commit or stash your changes before running the release:

```bash
git status
git add .
git commit -m "WIP"
```

### "Failed: Run tests"

Fix failing tests before releasing:

```bash
bun test --bail=1
```

### "Failed: Run type checking"

Fix TypeScript errors:

```bash
bun x tsc --noEmit
```

### npm Publish Fails

Check your npm authentication:

```bash
npm whoami
npm login
```

### Git Push Fails

Ensure you have the correct permissions and your branch is up to date:

```bash
git pull origin main
```

## Best Practices

1. **Always Dry Run First**: Use `--dry-run` to verify the release will work correctly
2. **Update Changelog**: Update CHANGELOG.md before releasing
3. **Test Locally**: Ensure all tests pass in your local environment
4. **Verify Package**: After publishing, verify the package on npm:
    ```bash
    npm view sudachi-ts
    ```
5. **Tag Verification**: Verify the tag was created:
   ```bash
   git tag -l
   git show v1.2.3
   ```

## Rollback

If you need to rollback a release:

```bash
# Delete the tag
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3

# Unpublish from npm (only within 72 hours)
npm unpublish sudachi-ts@1.2.3

# Reset package.json version
git checkout HEAD~1 -- package.json
```

## Integration with CI/CD

The release script can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Release
  if: startsWith(github.ref, 'refs/tags/')
  run: |
    ./scripts/release.sh --version ${GITHUB_REF#refs/tags/v} --skip-git
  env:
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## See Also

- [Bun publish documentation](https://bun.sh/docs/cli/publish)
- [Semantic Versioning](https://semver.org/)
- [Git tagging](https://git-scm.com/book/en/v2/Git-Basics-Tagging)