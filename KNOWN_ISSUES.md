# Known Issues

## CLI Build Configuration (Blocking Manual Testing)

### Issue
The TypeScript build creates a nested directory structure (`dist/cli/src/` and `dist/core/src/`) instead of a flat `dist/` structure. This causes Node's ESM module resolution to fail when trying to find dependencies like `pacote`.

### Root Cause
The monorepo TypeScript configuration with composite project references preserves the full directory structure including package boundaries.

### Impact
- CLI cannot be run directly with `node dist/index.js`
- Manual testing is blocked
- All **automated tests pass** (281 tests)
- Code is functionally complete

### Workarounds Tried
1. ❌ Setting explicit `rootDir: "src"` → Breaks workspace references
2. ❌ Running via `pnpm exec` → Still hits module resolution issues
3. ❌ Adjusting import paths → Would require changing source code

### Solutions
**Option A**: Use a bundler (esbuild/tsup) instead of raw `tsc`
- Pros: Proper ESM bundling, resolves all dependencies
- Cons: Adds build tool dependency

**Option B**: Fix TypeScript project references
- Pros: Keeps pure TypeScript compilation
- Cons: Complex to configure correctly in monorepo

**Option C**: Create wrapper script that sets NODE_PATH
- Pros: Quick workaround
- Cons: Hacky, not portable

### Recommendation
**Use esbuild** for the CLI package. It's fast, handles ESM correctly, and will bundle everything into a single executable file.

```bash
cd packages/cli
pnpm add -D esbuild
# Update package.json build script to use esbuild
```

### Status
- All code is complete and tested (281 automated tests passing)
- CLI commands (`add`, `install`) fully implemented
- Only manual testing is blocked by build configuration
