# Phase 8: Playwright Workspace (End-to-End Tests)

This optional phase covers end-to-end browser tests.

## Interaction Mode (Agent Prompt)

Ask explicitly:
- "Do you want me to run the commands for you, or just tell you what to run?"

Default to giving commands. Only execute when the user explicitly asks.

## Prerequisites

- Node.js 18+
- pnpm installed

## 1) Install dependencies

```bash
cd nodejs/playwright
pnpm install
```

## 2) Install browsers

```bash
pnpm exec playwright install
```

## 3) Run tests

```bash
pnpm exec playwright test
```

## 4) View report

```bash
pnpm exec playwright show-report
```

## What this workspace is for

- Automated browser tests for critical user flows.
- Catch regressions that unit tests will not cover.
