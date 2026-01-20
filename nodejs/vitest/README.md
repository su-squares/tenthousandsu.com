# Vitest Testing Workspace

This workspace contains comprehensive tests for the web3 files in `assets/web3/`, particularly the transaction UI components and balance management.

## Setup

Install dependencies:

```bash
cd nodejs/vitest
pnpm install
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run with UI
pnpm test:ui

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test view

# Run tests matching pattern
pnpm test balance
```

## Directory Structure

```
nodejs/vitest/
├── setup/              # Global test setup
│   ├── setup.ts        # Global beforeEach/afterEach hooks
│   └── localStorage-shim.ts  # localStorage mock
├── src/
│   ├── mocks/          # Mock implementations
│   │   ├── wagmi.ts    # Wagmi bundle mock
│   │   └── events.ts   # Custom event helpers
│   ├── helpers/        # Test utilities
│   │   ├── balance.ts  # Balance test utilities
│   │   └── dom.ts      # DOM manipulation helpers
│   ├── fixtures/       # Test data
│   │   ├── addresses.ts  # Standard test addresses
│   │   └── state.ts    # Mock state factories
│   └── tests/          # Test files
│       └── tx/         # Transaction UI tests
```

## Key Features

- **happy-dom**: Fast, lightweight DOM environment
- **TypeScript**: Type-safe test code
- **Global setup**: Automatic localStorage and DOM cleanup
- **Comprehensive mocks**: Wagmi, localStorage, custom events
- **Test helpers**: DOM manipulation, balance utilities, fixtures
- **Coverage goals**: 80% lines/functions, 75% branches

## Writing Tests

### Import Aliases

- `@web3/*` - Assets web3 files
- `@test-helpers/*` - Helper utilities
- `@mocks/*` - Mock implementations
- `@fixtures/*` - Test fixtures

### Example Test

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockTxState } from '@fixtures/state';
import { createTestContainer, cleanupTestContainer } from '@test-helpers/dom';

describe('my test', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createTestContainer();
  });

  afterEach(() => {
    cleanupTestContainer(container);
  });

  it('should work', () => {
    const state = createMockTxState();
    expect(state.status).toBe('idle');
  });
});
```

## Mocking Strategy

### Wagmi Bundle

```typescript
import { getMockWagmiClient } from '@mocks/wagmi';

const wagmi = getMockWagmiClient();
wagmi.fetchBalance.mockResolvedValue({
  decimals: 18,
  formatted: '1.5',
  symbol: 'ETH',
  value: BigInt('1500000000000000000')
});
```

### localStorage

Automatically mocked globally. Use normally:

```typescript
localStorage.setItem('key', 'value');
expect(localStorage.getItem('key')).toBe('value');
```

### Custom Events

```typescript
import { spyOnEvent } from '@mocks/events';

const eventSpy = spyOnEvent('WALLET_CONTEXT_CHANGE_EVENT');
// Trigger event...
const event = await eventSpy.waitFor();
expect(event.detail).toMatchObject({ address: '0x123' });
eventSpy.cleanup();
```

## Coverage

Coverage reports are generated in `coverage/` directory.

```bash
pnpm test:coverage
```

Open `coverage/index.html` in a browser to view detailed coverage report.

## Troubleshooting

### Import Errors

Make sure path aliases are working:
- Check `vitest.config.ts` resolve.alias
- Check `tsconfig.json` paths

### Dynamic Import Mocks

Use `vi.mock()` at the top level:

```typescript
vi.mock('@web3/wallet/balance-store.js', () => ({
  getBalance: vi.fn(),
  subscribeBalance: vi.fn()
}));
```

### Timer Issues

Use fake timers:

```typescript
vi.useFakeTimers();
await vi.advanceTimersByTimeAsync(60000);
vi.useRealTimers();
```
