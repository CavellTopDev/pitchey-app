# Frontend Testing Suite

This directory contains the comprehensive testing setup for the Pitchey frontend application.

## Testing Stack

- **Vitest**: Fast unit test framework with native ESM support
- **React Testing Library**: Component testing utilities focused on user interactions
- **@testing-library/user-event**: Enhanced user interaction simulation
- **MSW (Mock Service Worker)**: API mocking for realistic integration tests
- **@testing-library/jest-dom**: Custom Jest DOM matchers

## Test Structure

```
src/test/
├── setup.ts              # Global test configuration
├── utils.tsx              # Custom render function and test utilities
├── mocks/
│   ├── server.ts          # MSW server setup
│   └── handlers.ts        # API request handlers
└── README.md              # This file
```

## Test Files

### Component Tests
- `CreatorDashboard.test.tsx` - Dashboard functionality, stats, navigation
- `PitchForm.test.tsx` - Pitch creation form validation and submission
- `LoginForm.test.tsx` - Multi-portal login forms (Creator, Investor, Production)
- `NDARequestModal.test.tsx` - NDA request workflow and file uploads
- `PitchCard.test.tsx` - Pitch display component with formatting

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests once
npm run test:run

# Generate coverage report
npm run test:coverage

# Run tests with UI (optional)
npm run test:ui

# CI mode with verbose reporting
npm run test:ci
```

## Test Coverage Goals

- **Minimum Coverage**: 95% lines, functions, branches, statements
- **Focus Areas**: User interactions, form validation, error handling, accessibility

## Test Patterns

### Component Testing
```typescript
describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<ComponentName />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })

  it('should handle user interactions', async () => {
    const user = userEvent.setup()
    render(<ComponentName />)
    await user.click(screen.getByRole('button'))
    expect(/* assertion */).toBe(true)
  })
})
```

### API Mocking
```typescript
// Override MSW handlers for specific tests
server.use(
  http.get('/api/endpoint', () => {
    return HttpResponse.json({ data: 'mock response' })
  })
)
```

### Custom Render
```typescript
// Use custom render with providers
import { render } from '../test/utils'

render(<Component />)
```

## Accessibility Testing

All components are tested for:
- Proper ARIA labels and roles
- Keyboard navigation
- Screen reader compatibility
- Focus management
- Color contrast (manual verification)

## Mock Data

Test utilities provide factory functions for creating mock data:
- `createMockUser(overrides)`
- `createMockPitch(overrides)`
- `createMockNDARequest(overrides)`
- `createMockCharacter(overrides)`

## Environment Setup

The test environment automatically:
- Mocks WebSocket connections
- Provides localStorage/sessionStorage mocks
- Sets up IntersectionObserver and ResizeObserver mocks
- Configures proper API endpoints

## Debugging Tests

1. Use `screen.debug()` to see component structure
2. Add `--reporter=verbose` for detailed output
3. Use VS Code Jest extension for debugging
4. Check MSW network tab for API call verification

## Writing New Tests

1. Create test file next to component: `Component.test.tsx`
2. Import from `../../test/utils` for custom render
3. Follow existing patterns for consistency
4. Test user interactions, not implementation details
5. Include accessibility checks
6. Add error scenarios and edge cases

## CI Integration

The test suite is configured for CI environments:
- Runs in headless mode
- Generates coverage reports
- Fails on coverage threshold violations
- Provides verbose output for debugging