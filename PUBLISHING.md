# FridayCode — Publishing & Release Guide

How to build, release, and publish FridayCode to npm and GitHub.

---

## Table of Contents

- [Pre-release Checklist](#pre-release-checklist)
- [Versioning](#versioning)
- [Build for Release](#build-for-release)
- [Publishing to npm](#publishing-to-npm)
- [GitHub Releases](#github-releases)
- [CI/CD Pipeline](#cicd-pipeline)
- [Post-release Verification](#post-release-verification)
- [Unpublishing / Deprecation](#unpublishing--deprecation)

---

## Pre-release Checklist

Before every release, verify:

```bash
# 1. Clean build
npm run clean && npm run build

# 2. All tests pass
npm test

# 3. Linting passes
npm run lint

# 4. TypeScript types are correct
npm run typecheck

# 5. Manual smoke test
cd packages/cli && npx tsx src/index.ts --help
```

Ensure all three packages build without errors and the CLI starts correctly.

---

## Versioning

FridayCode uses **semantic versioning** (semver):

| Change Type | Version Bump | Example |
|-------------|-------------|---------|
| Breaking API change | Major | `0.1.0` → `1.0.0` |
| New feature (backward-compatible) | Minor | `0.1.0` → `0.2.0` |
| Bug fix | Patch | `0.1.0` → `0.1.1` |

### Bumping Versions

All three packages should be bumped together to keep versions in sync:

```bash
# Bump all workspaces (e.g. patch release)
npm version patch --workspaces --no-git-tag-version

# Bump root package too
npm version patch --no-git-tag-version

# Verify
grep '"version"' package.json packages/*/package.json
```

> **Note**: While in `0.x.x`, breaking changes can happen in minor releases. Once `1.0.0` is reached, follow strict semver.

---

## Build for Release

```bash
# Full clean build
npm run clean
npm run build

# Verify dist output exists for each package
ls packages/shared/dist/index.js
ls packages/core/dist/index.js
ls packages/cli/dist/index.js
```

---

## Publishing to npm

### First-time Setup

1. **Create an npm account** at https://www.npmjs.com/signup
2. **Login from terminal**:
   ```bash
   npm login
   ```
3. **Verify login**:
   ```bash
   npm whoami
   ```

### Package Names

| Package | npm Name | Public? |
|---------|----------|---------|
| packages/shared | `@fridaycode/shared` | Yes (scoped) |
| packages/core | `@fridaycode/core` | Yes (scoped) |
| packages/cli | `fridaycode-cli` | Yes |

> For scoped packages (`@fridaycode/*`), you need an npm organization named `fridaycode`. Create one at https://www.npmjs.com/org/create.

### Publishing Steps

```bash
# 1. Build everything
npm run clean && npm run build

# 2. Publish packages in dependency order
cd packages/shared
npm publish --access public

cd ../core
npm publish --access public

cd ../cli
npm publish --access public
```

### Dry Run (Preview Without Publishing)

```bash
# See what would be published
cd packages/cli
npm publish --dry-run
```

This shows the files that would be included and the tarball size.

### The `bin/friday.js` Entry Point

The CLI package has a `bin` entry in its `package.json`:

```json
{
  "bin": {
    "friday": "bin/friday.js"
  }
}
```

Make sure `packages/cli/bin/friday.js` exists and is executable:

```bash
# Check the bin file
cat packages/cli/bin/friday.js

# Ensure it's executable (Unix)
chmod +x packages/cli/bin/friday.js
```

The bin file should be a thin wrapper like:

```js
#!/usr/bin/env node
import '../dist/index.js';
```

### `.npmignore` or `files` Field

To keep the published package lean, use the `files` field in each `package.json`:

```json
{
  "files": ["dist", "bin", "README.md", "LICENSE"]
}
```

This ensures only built output is published (no `src/`, no test files, no config).

---

## GitHub Releases

### Creating a Release

```bash
# 1. Commit version bump
git add -A
git commit -m "release: v0.1.0"

# 2. Create a git tag
git tag v0.1.0

# 3. Push commit and tag
git push origin main
git push origin v0.1.0
```

### Creating a GitHub Release (Web UI)

1. Go to https://github.com/katipally/Friday-CLI/releases/new
2. Select the tag you just pushed (e.g., `v0.1.0`)
3. Title: `FridayCode v0.1.0`
4. Describe changes (use the changelog)
5. Click **Publish release**

### Automating with GitHub Actions

The CI workflow at `.github/workflows/ci.yml` already runs build + test on every push. You can extend it with a publish job:

```yaml
# Add to .github/workflows/ci.yml (or create a new release.yml)
  publish:
    needs: build
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: |
          cd packages/shared && npm publish --access public
          cd ../core && npm publish --access public
          cd ../cli && npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Add `NPM_TOKEN` to your repo's secrets: **Settings → Secrets → Actions → New repository secret**.

---

## CI/CD Pipeline

The existing GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push:

1. Checkout code  
2. Setup Node.js 20  
3. `npm ci` (clean install)  
4. `npm run build` (all workspaces)  
5. `npm test` (vitest)  
6. `npm run lint` (ESLint)

### Extending for Multiple Node Versions

```yaml
strategy:
  matrix:
    node-version: [20, 22]
```

---

## Post-release Verification

After publishing, verify the package works:

```bash
# Install globally from npm
npm install -g fridaycode-cli

# Verify it runs
friday --version
friday --help

# Quick test
friday "What is 2 + 2?"
```

### Verifying the Published Package

```bash
# Check what's on npm
npm info fridaycode-cli

# Check all versions
npm view fridaycode-cli versions

# Check package contents
npm pack fridaycode-cli --dry-run
```

---

## Unpublishing / Deprecation

### Deprecating a Version

```bash
npm deprecate fridaycode-cli@0.1.0 "Use v0.2.0 instead — critical bug fix"
```

### Unpublishing (Within 72 Hours)

```bash
npm unpublish fridaycode-cli@0.1.0
```

> **Warning**: npm only allows unpublishing within 72 hours. After that, you can only deprecate.

---

## Summary

| Step | Command |
|------|---------|
| Clean build | `npm run clean && npm run build` |
| Run tests | `npm test` |
| Bump version | `npm version patch --workspaces --no-git-tag-version` |
| Publish shared | `cd packages/shared && npm publish --access public` |
| Publish core | `cd packages/core && npm publish --access public` |
| Publish CLI | `cd packages/cli && npm publish --access public` |
| Tag release | `git tag v0.x.x && git push origin v0.x.x` |
| Verify | `npm install -g fridaycode-cli && friday --help` |
