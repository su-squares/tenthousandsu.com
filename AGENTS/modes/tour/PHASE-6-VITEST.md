# Phase 6: Vitest Workspace (Unit Tests)

This optional phase covers unit tests for the web3 and UI helper code.

## Interaction Mode (Agent Prompt)

Ask explicitly:
- "Do you want me to run the commands for you, or just tell you what to run?"

Default to giving commands. Only execute when the user explicitly asks.

## Prerequisites

- Node.js 18+
- pnpm installed

## 1) Install dependencies

```bash
cd nodejs/vitest
pnpm install
```

## 2) Run tests

```bash
pnpm test
```

Optional:
```bash
pnpm test --watch
pnpm test:ui
pnpm test:coverage
```

Coverage reports (if enabled):
- `nodejs/vitest/coverage/index.html`

## What this workspace is for

- Unit tests for `assets/web3/` logic and transaction UI behavior.
- Fast feedback on web3 utilities with a lightweight DOM environment.
