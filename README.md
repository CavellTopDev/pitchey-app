# Pitchey

A comprehensive movie pitch platform connecting creators, investors, and production companies through secure pitch sharing, NDA management, and real-time collaboration.

## Quick Start

```bash
# Backend (Terminal 1) - MUST use port 8001
PORT=8001 deno run --allow-all working-server.ts

# Frontend (Terminal 2)
cd frontend && npm run dev
```

Visit http://localhost:5173

## Documentation Index

| Document | Description |
|----------|-------------|
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | System architecture, design decisions, and infrastructure |
| **[docs/API_REFERENCE.md](docs/API_REFERENCE.md)** | Complete API endpoints documentation (117+ endpoints) |
| **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** | Production deployment guide for Cloudflare Workers + Pages |
| **[CLAUDE.md](CLAUDE.md)** | Developer context and project-specific instructions |

## Production URLs

- **Frontend**: https://pitchey-5o8.pages.dev
- **API**: https://pitchey-api-prod.ndlovucavelle.workers.dev

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Deno + Oak + Better Auth (session-based)
- **Database**: Neon PostgreSQL with Hyperdrive pooling
- **Edge**: Cloudflare Workers + Pages + R2 + Durable Objects
- **Cache**: Upstash Redis (global distributed)
- **Real-time**: WebSockets via Durable Objects

## Demo Accounts

All accounts use password: **Demo123**

| Portal | Email |
|--------|-------|
| Creator | alex.creator@demo.com |
| Investor | sarah.investor@demo.com |
| Production | stellar.production@demo.com |

## Support & Issues

- **Known Issues**: See [CLIENT_REQUIREMENTS_UPDATE_DEC10.md](CLIENT_REQUIREMENTS_UPDATE_DEC10.md)
- **Architecture Questions**: Refer to [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **API Integration**: Check [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
- **Deployment Help**: Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## License

Copyright © 2025 Pitchey. All rights reserved.