# Quick Start: Release Guide

This guide will help you quickly publish a new release of sudachi-ts to npm.

## Prerequisites

Before releasing, make sure you:

1. ✅ Have a clean git working directory
2. ✅ Are authenticated with npm (`npm login`)
3. ✅ Have push access to the repository
4. ✅ All tests pass (`npm test`)
5. ✅ No TypeScript errors (`npm run typecheck`)

## Quick Release

### Patch Release (Bug Fixes)

```bash
# Preview what will happen
./scripts/release.sh --dry-run

# Execute the release
./scripts/release.sh
```

### Minor Release (New Features)

```bash
./scripts/release.sh --minor
```

### Major Release (Breaking Changes)

```bash
./scripts/release.sh --major
```

## Custom Version

```bash
./scripts/release.sh --version 1.2.3
```

## What the Script Does

1. Validates npm authentication (unless `--skip-publish` or `--dry-run`)
2. Bumps version in `package.json`
3. Builds the project
4. Runs tests
5. Checks TypeScript types
6. Commits changes to git
7. Creates an annotated git tag
8. Publishes to npm
9. Pushes commits and tags to remote

## Common Commands

| Action | Command |
|--------|---------|
| Preview release | `./scripts/release.sh --dry-run` |
| Skip git operations | `./scripts/release.sh --skip-git` |
| Skip npm publish | `./scripts/release.sh --skip-publish` |
| Help | `./scripts/release.sh --help` |

## Verification After Release

```bash
# Check the published version
npm view sudachi-ts

# Verify the tag
git tag -l

# View tag details
git show v1.2.3
```

## Troubleshooting

**Working directory not clean?**
```bash
git status
git add .
git commit -m "WIP"
```

**Tests failing?**
```bash
npm test -- --bail=1
```

**TypeScript errors?**
```bash
npm run typecheck
```

**npm authentication issues?**
```bash
npm whoami
npm login
```

## Rollback (if needed)

```bash
# Delete git tag
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3

# Unpublish from npm (within 72 hours)
npm unpublish sudachi-ts@1.2.3
```

## Full Documentation

For detailed information, see [scripts/README.md](scripts/README.md).
