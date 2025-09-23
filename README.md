# Pitchey Platform

## Overview

Pitchey is a comprehensive entertainment industry platform that connects creators, production companies, and investors. The platform facilitates secure pitch sharing, deal-making, and collaboration with built-in legal frameworks and business workflows.

## Current Version: 0.2 (Beta Ready)

### Key Features

- **Multi-Portal System**: Separate experiences for Creators, Production Companies, and Investors
- **Secure NDA Management**: Multi-tier NDA system with digital signatures and access control
- **Real-time Messaging**: WebSocket-based chat with file sharing and encryption
- **Email Notifications**: Comprehensive notification system with user preferences
- **Security Framework**: Rate limiting, input validation, JWT authentication, CORS protection
- **Legal Compliance**: Terms of Service, Privacy Policy, and NDA templates
- **Analytics Dashboard**: Real-time metrics and engagement tracking
- **Payment Infrastructure**: Stripe integration for subscriptions and transactions (UI ready)

## Platform Status

### Implementation Progress

| Component | Status | Details |
|-----------|--------|----------|
| **Security** | ✅ Complete | Rate limiting, JWT, validation, CORS |
| **Legal Framework** | ✅ Complete | ToS, Privacy Policy, NDAs |
| **Messaging System** | ✅ Complete | WebSocket, encryption, file sharing |
| **Email Notifications** | ✅ Complete | Multi-provider, templates, queue system |
| **Production Portal** | 85% Complete | Full dashboard, NDAs, following, analytics |
| **Creator Portal** | 40% Complete | Basic dashboard, pitch creation |
| **Investor Portal** | 30% Complete | Basic dashboard only |
| **Marketplace** | 60% Complete | Browse, search, view |
| **Payment System** | ⚠️ UI Only | Stripe integration pending |
| **File Storage** | ⚠️ Local Only | AWS S3 integration pending |

## Quick Start

### Prerequisites

- [Deno](https://deno.land/) (v1.37+)
- [Node.js](https://nodejs.org/) (v18+ for frontend)
- [PostgreSQL](https://www.postgresql.org/) (v14+)
- [Git](https://git-scm.com/)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/pitchey.git
   cd pitchey/pitchey_v0.2
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Set up the database**
   ```bash
   # Create database
   createdb pitchey_dev
   
   # Run migrations
   deno run --allow-all src/db/migrate.ts
   
   # Seed with sample data (optional)
   deno run --allow-all src/db/seed.ts
   ```

4. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

5. **Start the development servers**
   
   Backend (in one terminal):
   ```bash
   deno run --allow-all multi-portal-server.ts
   # Server runs on http://localhost:8000
   ```
   
   Frontend (in another terminal):
   ```bash
   cd frontend
   npm run dev
   # Frontend runs on http://localhost:5173
   ```

## Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pitchey_dev

# Security
JWT_SECRET=your-64-character-secure-random-string
JWT_REFRESH_SECRET=different-64-character-secure-random-string
SESSION_SECRET=48-character-secure-random-string

# Email Service (choose one provider)
EMAIL_PROVIDER=sendgrid  # or 'ses', 'smtp'
SENDGRID_API_KEY=your_sendgrid_api_key
# OR for AWS SES:
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=your_key
# AWS_SECRET_ACCESS_KEY=your_secret
# OR for SMTP:
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your_email
# SMTP_PASS=your_password

# Email Configuration
EMAIL_FROM=noreply@pitchey.com
EMAIL_FROM_NAME=Pitchey
BASE_URL=http://localhost:8000

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Storage (future)
AWS_S3_BUCKET=pitchey-uploads
AWS_S3_REGION=us-east-1

# Environment
DENO_ENV=development  # or 'production'
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:8000
```

## Project Structure

```
pitchey_v0.2/
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/       # Portal-specific pages
│   │   ├── services/    # API and notification services
│   │   ├── store/       # State management
│   │   └── lib/         # API clients and utilities
│   └── package.json
├── src/
│   ├── config/          # Configuration files
│   ├── db/              # Database schema and migrations
│   ├── middleware/      # Express/Deno middleware
│   ├── services/        # Business logic services
│   ├── schemas/         # Validation schemas
│   └── utils/           # Utility functions
├── routes/
│   └── api/             # API endpoint handlers
├── legal/               # Legal documents
├── beta-testing/        # Beta testing documentation
├── drizzle/             # Database migrations
├── static/              # Static assets
├── tests/               # Test files
├── multi-portal-server.ts  # Main server file
├── deno.json            # Deno configuration
└── docker-compose.yml   # Docker configuration
```

## API Documentation

The platform provides a comprehensive REST API with WebSocket support for real-time features.

### Key API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - User logout

#### Pitches
- `GET /api/pitches` - List pitches
- `POST /api/pitches` - Create pitch
- `GET /api/pitches/:id` - Get pitch details
- `PUT /api/pitches/:id` - Update pitch
- `DELETE /api/pitches/:id` - Delete pitch

#### NDAs
- `POST /api/ndas/request` - Request NDA access
- `GET /api/ndas/signed` - Get signed NDAs
- `POST /api/ndas/:requestId/approve` - Approve NDA request
- `POST /api/ndas/:requestId/reject` - Reject NDA request

#### Messaging
- `GET /api/messages/ws` - WebSocket connection
- `POST /api/messages/send` - Send message
- `GET /api/messages/conversations` - List conversations
- `POST /api/messages/mark-read` - Mark as read

#### Payments
- `POST /api/payments/subscribe` - Create subscription
- `POST /api/payments/credits/purchase` - Purchase credits
- `GET /api/payments/history` - Payment history

For complete API documentation, see [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

## Development

### Running Tests

```bash
# Run all tests
deno test --allow-all

# Run specific test file
deno test --allow-all tests/security.test.ts

# Test security features
deno run --allow-all test-security-features.ts
```

### Database Management

```bash
# Generate migration
deno run --allow-all drizzle-kit generate:pg

# Run migrations
deno run --allow-all src/db/migrate.ts

# Reset database
deno run --allow-all src/db/reset.ts
```

### Code Quality

```bash
# Format code
deno fmt

# Lint code
deno lint

# Type check
deno check multi-portal-server.ts
```

## Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Run in production mode
docker-compose -f docker-compose.prod.yml up -d
```

## Security

The platform implements comprehensive security measures:

- **Authentication**: JWT with refresh tokens
- **Authorization**: Role-based access control
- **Input Validation**: All inputs sanitized and validated
- **Rate Limiting**: Protection against abuse
- **CORS**: Configured for specific origins
- **Headers**: Security headers (HSTS, CSP, etc.)
- **Encryption**: Password hashing with bcrypt
- **SQL Injection**: Protected with parameterized queries
- **XSS Protection**: Content sanitization

See [SECURITY.md](SECURITY.md) for detailed security documentation.

## Beta Testing

The platform is ready for beta testing with a phased approach:

1. **Closed Alpha**: 50 internal users (6 weeks)
2. **Limited Beta**: 250 external users (8 weeks)  
3. **Open Beta**: 1000 users (6 weeks)

See [beta-testing/docs/](beta-testing/docs/) for testing documentation.

## Contributing

We welcome contributions! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting PRs.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

- **Documentation**: See `/docs` folder
- **Issues**: GitHub Issues
- **Email**: support@pitchey.com
- **Security**: security@pitchey.com (for vulnerabilities)

## License

Copyright © 2025 Pitchey. All rights reserved.

## Acknowledgments

- Built with [Deno](https://deno.land/) and [Fresh](https://fresh.deno.dev/)
- Frontend powered by [React](https://reactjs.org/) and [Vite](https://vitejs.dev/)
- Database with [PostgreSQL](https://www.postgresql.org/) and [Drizzle ORM](https://orm.drizzle.team/)
- UI components from [Tailwind CSS](https://tailwindcss.com/) and [Lucide Icons](https://lucide.dev/)
