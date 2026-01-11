# Testing Checklist for Pitchey Platform

## Overview
This document provides comprehensive testing checklists for various development scenarios, with a focus on maintaining mock data consistency and ensuring all platform features work correctly.

## Table of Contents
1. [Mock Data Update Checklist](#mock-data-update-checklist)
2. [Pre-Deployment Testing](#pre-deployment-testing)
3. [Portal-Specific Testing](#portal-specific-testing)
4. [Integration Testing](#integration-testing)
5. [Performance Testing](#performance-testing)
6. [Security Testing](#security-testing)

---

## Mock Data Update Checklist

When updating mock data for testing, follow this checklist to ensure consistency across the platform:

### Frontend Mock Data
- [ ] Update `frontend/e2e/fixtures/test-data.ts`
  - [ ] Verify all IDs are unique and consistent
  - [ ] Check relationships between entities (users, pitches, NDAs)
  - [ ] Ensure date fields use consistent format
  - [ ] Validate enum values match database schema

### Backend Mock Responses
- [ ] Update service mocks in relevant handlers
  - [ ] `src/services/pitch.service.ts` - Pitch data
  - [ ] `src/services/user.service.ts` - User profiles
  - [ ] `src/services/nda.service.ts` - NDA workflows
  - [ ] `src/services/investment.service.ts` - Investment data

### Database Seeds
- [ ] Update seed scripts if needed
  - [ ] `scripts/seed-demo-users.ts`
  - [ ] `scripts/populate-production-data.ts`
  - [ ] Ensure password hashes are correct for demo accounts

### E2E Test Updates
- [ ] Update test assertions in `frontend/e2e/`
  - [ ] `auth.spec.ts` - Authentication flows
  - [ ] `pitch-creation.spec.ts` - Pitch workflows
  - [ ] `nda-workflow.spec.ts` - NDA processes
  - [ ] `portal-navigation.spec.ts` - Portal routing

### Verification Steps
- [ ] Run mock synchronization check: `npm run test:mock-sync`
- [ ] Execute E2E test suite: `npm run test:e2e`
- [ ] Verify WebSocket mock events align with new data
- [ ] Check API response types match TypeScript interfaces

---

## Pre-Deployment Testing

### Build Verification
- [ ] Frontend builds without errors: `npm run build`
- [ ] Worker compiles successfully: `wrangler deploy --dry-run`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] ESLint passes: `npm run lint`

### Functionality Testing
- [ ] All three portals load correctly
  - [ ] Creator portal at `/creator`
  - [ ] Investor portal at `/investor`
  - [ ] Production portal at `/production`
- [ ] Authentication works for each portal type
- [ ] Dashboard metrics display correctly
- [ ] Navigation between sections works
- [ ] Forms submit without errors

### API Endpoint Testing
- [ ] Health check endpoint responds: `/api/health`
- [ ] Authentication endpoints work
  - [ ] `/api/auth/sign-in`
  - [ ] `/api/auth/sign-out`
  - [ ] `/api/auth/session`
- [ ] CRUD operations for main entities
  - [ ] Pitches: Create, Read, Update, Delete
  - [ ] NDAs: Request, Sign, View, Approve
  - [ ] Messages: Send, Receive, Mark as read
  - [ ] Investments: Track, Update status

---

## Portal-Specific Testing

### Creator Portal
- [ ] **Authentication**
  - [ ] Login with demo account: `alex.creator@demo.com`
  - [ ] Session persists across page refreshes
  - [ ] Logout clears session properly

- [ ] **Pitch Management**
  - [ ] Create new pitch with all required fields
  - [ ] Upload documents (PDFs, images)
  - [ ] Save as draft
  - [ ] Publish pitch
  - [ ] Edit existing pitch
  - [ ] Delete pitch (with confirmation)

- [ ] **Analytics**
  - [ ] View count increments correctly
  - [ ] Engagement metrics display
  - [ ] Charts render without errors

- [ ] **Team Management**
  - [ ] Invite team members
  - [ ] Assign roles
  - [ ] Remove members

### Investor Portal
- [ ] **Authentication**
  - [ ] Login with demo account: `sarah.investor@demo.com`
  - [ ] Portfolio access restricted to investor role

- [ ] **Pitch Discovery**
  - [ ] Browse marketplace
  - [ ] Filter by genre, budget, status
  - [ ] Search functionality works
  - [ ] Saved searches persist

- [ ] **NDA Workflow**
  - [ ] Request NDA for protected content
  - [ ] Sign NDA electronically
  - [ ] View NDA history
  - [ ] Access protected content after approval

- [ ] **Investment Tracking**
  - [ ] View portfolio
  - [ ] Track investment status
  - [ ] Financial overview displays correctly

### Production Company Portal
- [ ] **Authentication**
  - [ ] Login with demo account: `stellar.production@demo.com`
  - [ ] Production-specific features accessible

- [ ] **Project Pipeline**
  - [ ] View submissions
  - [ ] Move projects through stages
  - [ ] Assign team members to projects

- [ ] **Analytics Dashboard**
  - [ ] Revenue tracking
  - [ ] Project status overview
  - [ ] Team performance metrics

---

## Integration Testing

### Frontend-Backend Integration
- [ ] API calls include proper authentication cookies
- [ ] Error responses handled gracefully
- [ ] Loading states display during async operations
- [ ] Optimistic updates work correctly
- [ ] Cache invalidation triggers on mutations

### WebSocket Integration
- [ ] Connection establishes on login
- [ ] Real-time notifications appear
- [ ] Presence status updates
- [ ] Draft auto-save works
- [ ] Connection reconnects after interruption

### Third-Party Services
- [ ] Cloudflare R2 uploads work
- [ ] Redis caching functions properly
- [ ] Email notifications send (if configured)
- [ ] Sentry error tracking captures issues

---

## Performance Testing

### Page Load Times
- [ ] Homepage loads in < 3 seconds
- [ ] Dashboard renders in < 2 seconds
- [ ] Large lists virtualize properly
- [ ] Images lazy load

### API Response Times
- [ ] Health check < 100ms
- [ ] Authentication < 500ms
- [ ] Data fetching < 1 second
- [ ] File uploads show progress

### Resource Usage
- [ ] Bundle size < 1MB (gzipped)
- [ ] No memory leaks in long sessions
- [ ] WebSocket connections clean up properly

---

## Security Testing

### Authentication & Authorization
- [ ] Cannot access protected routes without login
- [ ] Role-based access control enforced
- [ ] Session timeout works
- [ ] CSRF protection active

### Data Protection
- [ ] Sensitive data not exposed in responses
- [ ] File uploads validated for type/size
- [ ] SQL injection prevented
- [ ] XSS attacks blocked

### Infrastructure Security
- [ ] HTTPS enforced
- [ ] CORS configured correctly
- [ ] Rate limiting active
- [ ] Security headers present

---

## Testing Commands Reference

```bash
# Unit Tests
npm run test

# E2E Tests
npm run test:e2e

# Specific E2E test
npm run test:e2e -- --spec=auth.spec.ts

# Mock Data Synchronization
npm run test:mock-sync

# API Endpoint Testing
npm run test:api

# Performance Testing
npm run test:performance

# Security Audit
npm audit

# Full Test Suite
npm run test:all
```

---

## Continuous Testing Strategy

### Daily
- Run unit tests before commits
- Verify build passes

### Before PR/Merge
- Full E2E test suite
- Mock data synchronization check
- API endpoint verification

### Before Deployment
- Complete this entire checklist
- Performance benchmarking
- Security audit
- Cross-browser testing

### After Deployment
- Smoke tests on production
- Monitor error rates
- Check performance metrics
- Verify critical user journeys

---

## Troubleshooting Common Test Issues

### Mock Data Mismatches
- Check IDs are consistent across frontend and backend
- Verify date formats match
- Ensure relationships are properly defined

### E2E Test Failures
- Clear browser cache and cookies
- Reset database to known state
- Check for timing issues (add appropriate waits)
- Verify test environment variables

### API Test Failures
- Confirm authentication cookies are sent
- Check request/response types match
- Verify mock data is properly seeded
- Ensure rate limits aren't triggered

### WebSocket Test Issues
- Check connection URL is correct
- Verify authentication happens before WS connection
- Ensure mock events are properly formatted
- Add reconnection logic for flaky connections

---

## Contact & Support

For testing-related questions or issues:
- Check existing test documentation in `/frontend/e2e/README.md`
- Review CI/CD pipeline logs for automated test results
- Consult the architecture documentation for system design context