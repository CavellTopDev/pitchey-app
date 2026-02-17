# Frontend Context — Pitchey

React 18 SPA served from Cloudflare Pages with three portals (Creator, Investor, Production) plus Admin.

## Tech Stack
- React 18 + React Router 7 + Vite + TailwindCSS + Zustand + Radix UI
- TypeScript strict mode (`tsconfig.app.json`: `strict: true`, `noUnusedLocals: false`, `noUnusedParameters: false`)
- Sentry v8 for error tracking (`@sentry/react` — use `startInactiveSpan()`, NOT `startTransaction()`)

## State Management
Zustand stores — no Redux:
- `betterAuthStore.ts` — session auth (PRIMARY, the only auth store)
- `pitchStore.ts` — pitch CRUD, drafts, publish
- `sessionCache.ts` — prevents auth flicker on page load
- `onboardingStore.ts` — onboarding flow + gamification

## API Communication
- 33 service files in `services/` — all calls go through the Worker API
- `lib/api-client.ts` — main HTTP client with `credentials: 'include'` for cookie transmission
- `lib/apiServices.ts` — payments, NDA, auth, pitch API wrappers
- WebSocket via `contexts/WebSocketContext.tsx` for real-time features
- Production: `VITE_API_URL=` (empty) — calls go same-origin via Pages Functions proxy at `frontend/functions/api/[[path]].ts`

## Portal Routing
`user_type` from session determines portal access:
- `creator` → `/creator/*` routes
- `investor` → `/investor/*` routes
- `production` → `/production/*` routes
- `admin` → `/admin/*` routes

## Frontend RBAC
- `usePermissions` hook + `PermissionGuard` component mirror backend `rbac.service.ts`
- 50 permissions across 5 roles (admin, creator, investor, production, viewer)

## Dashboard Patterns
All 3 dashboards (Creator, Investor, Production) follow the same pattern:
- Session check on mount → redirect to login if unauthenticated
- `Promise.allSettled` for parallel API fetches
- Per-section `sectionStatus` tracking: `{ loaded: boolean; error: string | null }`
- Skeleton loading while `!loaded && !error`
- Offline detection via `navigator.onLine` + `window.addEventListener('online'/'offline')`
- Connectivity banners (offline, WebSocket disconnected, reconnecting, poor quality)
- Per-section Retry buttons on error

## Real-time Features
- Notifications with Redis caching
- Dashboard metrics with 5-minute cache TTL
- Draft auto-sync with 5-second intervals
- Presence tracking (online/offline/away)
- Typing indicators
- Upload progress tracking

## Testing
- Vitest + jsdom + @testing-library/react
- 53 test files, 1130 tests, zero failures
- Test utils at `test/utils.tsx` (custom render with providers, mock factories)
- Page tests use `MemoryRouter` wrapper + `vi.mock` for stores/services
- **Critical**: Mock Zustand store user objects as stable references (same object across renders) to prevent infinite `useEffect` loops
- Use `waitFor()` for all async assertions, never arbitrary timeouts
- Use `getAllByText` when text appears in multiple DOM locations (e.g., hero + KPI cards)
- `vi.useFakeTimers({ shouldAdvanceTime: true })` for timer-dependent tests (auto-refresh)

## Key Files
- Entry: `src/main.tsx` → `src/App.tsx`
- Router: `src/App.tsx` (React Router 7)
- API client: `src/lib/api-client.ts`
- Auth store: `src/store/betterAuthStore.ts`
- WebSocket: `src/contexts/WebSocketContext.tsx`
- Types: `src/types/api.ts`, `src/types/websocket.ts`
- Defensive utils: `src/utils/defensive.ts` (safeAccess, safeNumber, safeArray, etc.)
- Formatters: `src/utils/formatters.ts` (formatCurrency, formatNumber, formatDate, etc.)

## Commands
- Dev: `cd frontend && npm run dev`
- Build: `cd frontend && npm run build`
- Type check: `cd frontend && npx tsc --noEmit -p tsconfig.app.json`
- Tests: `cd frontend && npx vitest run`
- Deploy: `cd frontend && wrangler pages deploy dist/ --project-name=pitchey`
