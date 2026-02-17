# Endpoint → User Flow Map

How every API endpoint connects to the frontend UI and serves the business logic.

---

## 1. Real-Time Fallback Infrastructure

When WebSocket is unavailable, three frontend services activate polling loops. These endpoints keep the app feeling "live" even over plain HTTP.

| Endpoint | Frontend Service | User Flow |
|----------|-----------------|-----------|
| `GET /api/ws/health` | `websocket.service.ts` | On app load, checks if WebSocket is available. Returns `websocketAvailable: false` → frontend switches to HTTP polling mode transparently. User never sees a degraded experience. |
| `GET /api/poll/all` | `polling.service.ts` | Polls every 30s. Returns dashboard metrics, unread notifications, new messages, and online presence — all in one request. Powers the notification badge count, sidebar presence indicators, and dashboard stat cards without separate requests. |
| `GET /api/notifications/unread` | `polling.service.ts` | Lightweight check for notification badge. Returns `{ count: N }` so the top nav can show unread count without fetching full notification list. |
| `POST /api/presence/update` | `presence-fallback.service.ts` | Sends heartbeat every 30s with user's status (`online`, `away`, `busy`, `dnd`, `offline`) and current activity text. Powers "who's online" indicators in Messages and collaboration views. |
| `GET /api/presence/online` | `presence-fallback.service.ts` | Returns list of users active in last 5 minutes. Used by Messages sidebar and team collaboration panels to show green/yellow/red status dots. |
| `GET /api/analytics/realtime` | `polling.service.ts` | Returns active users, views this hour, new pitches today, investments today, and trending genres. Feeds the Creator and Admin dashboard real-time stats widgets. |

---

## 2. Config & Browse (Public, No Auth)

These endpoints power the app before the user logs in — landing page, browse experience, and form dropdowns.

| Endpoint | Frontend Consumer | User Flow |
|----------|------------------|-----------|
| `GET /api/config/all` | `config.service.ts` → Create Pitch form, Search filters | Returns all genres (54), formats (4), budget ranges (7), and stages (5). Populates every dropdown and filter in the app. Cached on frontend — called once per session. |
| `GET /api/config/genres` | Genre filter dropdowns | Subset of config — just the genre list. Used when only genre filtering is needed (Browse, Search). |
| `GET /api/config/formats` | Format filter in Create Pitch | Feature Film, Short Film, TV Series, Web Series — the format selector. |
| `GET /api/config/budget-ranges` | Budget range selector | Under $1M through Over $100M — used in pitch creation and investor search filters. |
| `GET /api/config/stages` | Stage selector in pitch editor | Development → Pre-Production → Production → Post-Production → Distribution pipeline stages. |
| `GET /api/browse/genres` | Browse page genre cards | Real genre stats from DB: count of pitches per genre + average views. Powers the genre discovery grid with live numbers. |
| `GET /api/browse/top-rated` | Browse page "Top Rated" section | Paginated list of highest-rated published pitches. Shows title, genre, logline, image, rating. The public storefront for the platform. |
| `GET /api/browse/top-rated/stats` | Browse page stats banner | Total rated pitches, average rating, top-rated genre. Gives context above the top-rated list. |

---

## 3. Creator Portal

### Dashboard & Analytics
| Endpoint | Page | User Flow |
|----------|------|-----------|
| `GET /api/creator/dashboard` | `CreatorDashboard.tsx` | Total pitches, views, published/draft counts, followers, unread notifications. The creator's home screen — first thing they see after login. |
| `GET /api/creator/analytics` | `CreatorAnalytics.tsx` | Top pitches (by views, likes, NDAs), audience breakdown (by viewer type), average rating, response rate. Helps creators understand which pitches resonate and who's watching. |
| `GET /api/creator/calendar/events` | `CreatorCalendar.tsx` | Synthesized view: custom calendar events + meetings + deadlines. The creator's schedule at a glance. |
| `POST /api/calendar` | `CreatorCalendar.tsx` | Create new calendar events (meetings, deadlines, milestones). Supports color coding and reminders. |

### Pitch Management
| Endpoint | Page | User Flow |
|----------|------|-----------|
| `GET /api/pitches` | `ManagePitches.tsx` | Lists creator's pitches with status, views, dates. The pitch management hub. |
| `POST /api/pitches` | `CreatePitch.tsx` | Creates a new pitch with title, logline, genre, format, budget range, synopsis. Uses config endpoints for dropdown data. |
| `PUT /api/pitches/:id` | `PitchEdit.tsx` | Edits existing pitch. Auto-saves drafts every 5 seconds via the WebSocket/polling fallback path. |
| `POST /api/analytics/track-view` | `PitchDetail.tsx` | Fires when any user views a pitch. Powers the view counter shown on each pitch card. |

---

## 4. Investor Portal

### Dashboard & Portfolio
| Endpoint | Page | User Flow |
|----------|------|-----------|
| `GET /api/investor/dashboard` | `InvestorDashboard.tsx` | Portfolio value, active investments, pending deals, recent activity. Investor's command center. |
| `GET /api/investor/investments/summary` | `InvestorStats.tsx` | Total portfolio value, ROI percentage, active count. Top-line metrics at a glance. |
| `GET /api/investor/investments` | `InvestorPortfolio.tsx` | Full list of investments with current value, ROI, status. The investor's portfolio view — shows what they've put money into. |

### Analytics & Risk
| Endpoint | Page | User Flow |
|----------|------|-----------|
| `GET /api/investor/performance` | `InvestorPerformance.tsx` | Total return, annualized return, Sharpe ratio, hit rate, volatility, max drawdown. Deep performance analytics with time range filtering. |
| `GET /api/investor/roi/summary` | `InvestorPerformance.tsx` | Investment count, average/best/worst ROI, profitable count. ROI breakdown card. |
| `GET /api/investor/roi/by-category` | `InvestorPerformance.tsx` | ROI by genre: Drama vs Comedy vs Thriller. Powers the genre allocation pie chart and performance-by-genre bar chart. |
| `GET /api/investor/portfolio/risk` | `RiskAssessment.tsx` | Risk score, diversification rating, low/medium/high distribution, risk by genre category. Helps investors balance their portfolio. |
| `GET /api/investor/market-trends` | `MarketTrends.tsx` | Market growth rate, total platform investment, active pitch count, top genres, avg investment by genre. Macro view of where the market is heading. |
| `GET /api/investor/genre-performance` | `InvestorAnalytics.tsx` | Genre-level metrics: pitch count, average views, investment count, avg ROI. Helps investors pick which genres to target. |

### Wallet & Payments
| Endpoint | Page | User Flow |
|----------|------|-----------|
| `GET /api/investor/wallet` | `InvestorWallet.tsx` | Wallet balance and transaction history. Shows available funds for investing. |
| `GET /api/payments/payment-methods` | `InvestorWallet.tsx` | Linked bank accounts and cards. Displayed in the wallet's payment methods section. |
| `GET /api/payments/history` | `InvestorWallet.tsx` | Full payment history with amounts, dates, descriptions. Audit trail for the investor. |

---

## 5. Production Company Portal

| Endpoint | Page | User Flow |
|----------|------|-----------|
| `GET /api/production/dashboard` | `ProductionDashboard.tsx` | Active projects, team size, budget utilization, revenue. The production company's operations center. |
| `GET /api/production/analytics` | `ProductionAnalytics.tsx` | Revenue, project stats, resource utilization, top projects. Operational analytics for production leadership. |

---

## 6. NDA & Legal

| Endpoint | Page | User Flow |
|----------|------|-----------|
| `POST /api/ndas` | `NDAPage.tsx` | Creates an NDA between investor and creator for a specific pitch. Required before viewing confidential pitch details. |
| `GET /api/ndas/:id/download` | `NDAPage.tsx` | Downloads the unsigned NDA document from DB (`document_url`). Returns real URL — no mock PDFs. |
| `GET /api/ndas/:id/signed` | `NDAPage.tsx` | Downloads the signed version (`signed_document_url`). Returns 404 if not yet signed. |

---

## 7. Search & Discovery

| Endpoint | Page | User Flow |
|----------|------|-----------|
| `GET /api/search/history` | `SearchPage.tsx` | Shows user's recent searches. Helps with "recently searched" suggestions. |
| `POST /api/search/track-click` | `SearchPage.tsx` | Logs when a user clicks a search result. Powers search relevance improvement. |

---

## 8. Collaboration & Communication

| Endpoint | Page | User Flow |
|----------|------|-----------|
| `POST /api/meetings/schedule` | Meeting scheduler modal | Creates a calendar event for a meeting between parties. Used when an investor wants to schedule a call with a creator. |
| `GET /api/info-requests` | Deal flow pages | Lists incoming and outgoing information requests. Investors request more info from creators; creators respond. |
| `POST /api/info-requests` | Deal detail page | Creates an info request. "I'd like to see the financial projections for this pitch." |
| `POST /api/info-requests/:id/respond` | Notification inbox | Creator responds to an info request with documents or text. |
| `POST /api/demos/request` | Public landing page | **No auth required.** Anonymous visitors can request a platform demo. Stored for sales team follow-up. |

---

## 9. Analytics & Reporting

| Endpoint | Page | User Flow |
|----------|------|-----------|
| `POST /api/analytics/share` | Share buttons on pitch cards | Logs share events (platform, pitch ID). Tracks which pitches get shared and where. |
| `POST /api/analytics/schedule-report` | Analytics page "Schedule Report" button | Sets up recurring analytics email reports. Investors can get weekly portfolio summaries. |
| `GET /api/analytics/scheduled-reports` | Analytics settings | Lists active scheduled reports so users can manage them. |
| `DELETE /api/analytics/scheduled-reports/:id` | Analytics settings | Cancels a scheduled report. |

---

## 10. Auth & Security

| Endpoint | Page | User Flow |
|----------|------|-----------|
| `POST /api/auth/2fa/setup` | Settings → Security | Alias to MFA setup. Generates TOTP secret + QR code for authenticator app. |
| `POST /api/auth/2fa/verify` | Settings → Security | Verifies 2FA code during setup or login. Completes MFA enrollment. |
| `POST /api/verification/start` | Settings → Verification | Starts identity verification flow. Required for high-value transactions. |
| `GET /api/company/verify` | Settings → Company | Gets current verification status for production companies. |
| `POST /api/company/verify` | Settings → Company | Submits company verification documents. |

---

## 11. Data Export

| Endpoint | Page | User Flow |
|----------|------|-----------|
| `POST /api/export` | Various pages → "Export" button | Generates CSV exports of user data (pitches, investments, analytics). GDPR compliance + user convenience. |

---

## Architecture Flow

```
User Browser
    ↓ (same-origin requests via Pages Functions proxy)
Cloudflare Pages (frontend/dist)
    ↓ /api/* → functions/api/[[path]].ts proxy
Cloudflare Worker (pitchey-api-prod)
    ↓ Raw SQL via Hyperdrive
Neon PostgreSQL
```

All API calls go same-origin through the Pages Functions proxy. Session cookies (`pitchey-session`) are HttpOnly + Secure + SameSite=None. No JWT, no CORS issues.
