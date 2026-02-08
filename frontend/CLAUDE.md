# Pitchey Frontend

React 18 SPA with three portals (Creator, Investor, Production) plus Admin.

## Tech
React 18 + React Router 7 + Vite + TailwindCSS + Zustand + Radix UI

## Auth
Better Auth client — session cookies stored as pitchey-session.
Auth state in store/betterAuthStore.ts (primary), legacy store/authStore.ts exists.
Cache in store/sessionCache.ts prevents auth flicker on page load.
API calls include credentials: 'include' for cookie transmission.

## State Management
Zustand stores — no Redux. Key stores:
- betterAuthStore.ts: session auth (primary)
- pitchStore.ts: pitch data
- sessionCache.ts: prevents auth flicker on page load
- authStore.ts: legacy auth store
- onboardingStore.ts: onboarding flow

## API Communication
36 service files in services/ — all calls go to pitchey-api-prod Worker.
WebSocket service for real-time notifications and 5-second draft auto-sync.

## Portal Routing
user_type from session determines portal access:
- creator -> /creator/* routes
- investor -> /investor/* routes
- production -> /production/* routes
- admin -> /admin/* routes

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Type check: `npx tsc --noEmit`
- Tests: `npx vitest run`
- Deploy: `wrangler pages deploy dist/ --project-name=pitchey`
