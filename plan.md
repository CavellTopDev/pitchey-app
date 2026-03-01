# Phase 2: Migrate Shared Layer — Implementation Plan

## Scope Summary

Move cross-cutting files from flat directories to `shared/`, updating all imports to use `@shared/` aliases. **7 commits**, each verified with build + type-check.

## Current State (from exploration)

| Source | Files | Import occurrences | Importing files |
|--------|-------|--------------------|-----------------|
| `components/ui/` (shadcn) | 24 | 79 | 34 |
| `lib/utils.ts` (cn function) | 1 | 23 | 23 |
| `components/Loading/` | 3 | 5 | 5 |
| `components/Toast/` | 4 | 10 | 9 |
| `components/ErrorBoundary*` | 4 | 5 | 5 |
| `components/layout/` | 3 | 1 | 1 |
| `types/` | 10 | 50 | 43 |
| `contexts/` | 9 | 17 | 17 |
| `constants/` | 3 | 11 | 10 |
| `utils/defensive.ts` | 1 | 4 | 4 |
| `utils/formatters.ts` | 1 | 2 | 2 |
| `config/` | 4 | low | low |

**Total**: ~65 files moved, ~207 import updates across ~100 files.

## Migration Strategy

- `git mv` to preserve history
- Bulk `sed` to rewrite imports to `@shared/` or `@config/` aliases
- Build + type-check after each commit
- Tests run once at the end (they use the same aliases via vitest.config.ts)

## Commits

### Commit 1: `components/ui/` → `shared/components/ui/`
**Highest impact — 79 imports across 34 files**

1. `git mv src/components/ui/* src/shared/components/ui/`
2. Remove `shared/components/ui/.gitkeep`
3. Sed rewrite: all variations of `components/ui/X` → `@shared/components/ui/X`
   - Pattern: `from ['"].*components/ui/(.*)['"]` → `from '@shared/components/ui/$1'`
4. `lib/utils.ts` also moves (cn function, imported by every shadcn component)
   - `git mv src/lib/utils.ts src/shared/utils/cn.ts`
   - Sed rewrite: `from ['"].*lib/utils['"]` → `from '@shared/utils/cn'`
5. Build + type-check

### Commit 2: `components/layout/` → `shared/components/layout/`
**Low risk — only 1 import in App.tsx**

1. `git mv src/components/layout/* src/shared/components/layout/`
2. Update App.tsx import
3. Build + type-check

### Commit 3: Feedback components → `shared/components/feedback/`
**Loading + Toast + ErrorBoundary — 20 imports across ~15 files**

1. `git mv src/components/Loading/LoadingSpinner.tsx src/shared/components/feedback/`
2. `git mv src/components/Loading/Skeleton.tsx src/shared/components/feedback/`
3. `git mv src/components/Toast/NotificationToast.tsx src/shared/components/feedback/`
4. `git mv src/components/Toast/NotificationToastContainer.tsx src/shared/components/feedback/`
5. `git mv src/components/Toast/ToastProvider.tsx src/shared/components/feedback/`
6. `git mv src/components/ErrorBoundary.tsx src/shared/components/feedback/`
7. `git mv src/components/RouteErrorBoundary.tsx src/shared/components/feedback/`
8. `git mv src/components/ConsoleErrorBoundary.tsx src/shared/components/feedback/`
9. Handle `index.ts` barrel exports in Loading/ and Toast/ — either move or inline
10. Sed rewrite all imports
11. Build + type-check

### Commit 4: `types/` → `shared/types/`
**50 imports across 43 files**

1. `git mv src/types/* src/shared/types/`
2. Sed rewrite: `from ['"].*types/(.*)['"]` → `from '@shared/types/$1'`
   - Careful: must NOT match `node_modules` or `*.d.ts` type imports
3. Build + type-check

### Commit 5: Generic utils → `shared/utils/`
**defensive.ts, formatters.ts — 6 imports across 6 files**

1. `git mv src/utils/defensive.ts src/shared/utils/`
2. `git mv src/utils/formatters.ts src/shared/utils/`
3. Sed rewrite imports
4. Build + type-check

### Commit 6: `contexts/` → `shared/contexts/`
**17 imports across 17 files**

Note: contexts/ isn't in the original shared/ skeleton but these are app-wide providers. They'll go to `shared/contexts/` (create the dir).

1. `mkdir -p src/shared/contexts`
2. `git mv src/contexts/* src/shared/contexts/`
3. Sed rewrite: `contexts/` → `@shared/contexts/`
4. Build + type-check

### Commit 7: `constants/` + `config/` → `config/`
**11 + low imports**

Note: config/ already exists at `src/config/`. The plan's target also has `config/` at `src/config/`. These files may just stay in place with the `@config/` alias already pointing there. Constants merge into config.

1. `git mv src/constants/* src/config/` (merge constants into config)
2. Sed rewrite: `constants/` → `@config/`
3. Build + type-check

## What Does NOT Move (stays for Phase 3)

- `components/` root-level files (56 files) — feature-specific, move in Phase 3
- `components/Analytics/` — feature-specific (analytics)
- `components/NDA/` — feature-specific (ndas)
- `components/Search/` — feature-specific (browse)
- `components/Onboarding/` — feature-specific
- `components/Investment/` — feature-specific (deals)
- `components/FileUpload/` — feature-specific (uploads)
- `hooks/` — move in Phase 3 (per-feature)
- `services/` — move in Phase 3 (per-feature)
- `store/` — move in Phase 3 (per-feature)
- `lib/api.ts`, `lib/api-client.ts` — shared API client, could move to shared/utils but tight coupling with services
- `schemas/`, `monitoring/`, `assets/` — leave in place

## Risk Mitigation

- Each commit is independently verified (build + type-check)
- Old directories are NOT deleted until Phase 5 (cleanup)
- Existing `@/*` alias still works as fallback
- Tests run at end to catch any vitest-specific issues

## Estimated Scope

- ~65 files moved via `git mv`
- ~207 import statements updated via `sed`
- ~100 files touched for import rewrites
- 7 verified commits
