# Phase 8: Playwright Workspace (End-to-End Tests)

This optional phase covers end-to-end browser tests.

## Interaction Mode (Agent Prompt)

Ask explicitly:
- "Do you want me to run the commands for you, or just tell you what to run?"

Default to giving commands. Only execute when the user explicitly asks.

## Workspace overview (tell the user)

- This workspace runs Playwright E2E tests for critical user flows (buy, personalize, wallet, billboard).
- It can run in **mock mode** (fast, easy) or against a **real blockchain** (higher fidelity).

## Choose runtime (Agent Prompt)

Ask explicitly:
- "Do you want to use **mock RPC** (fast, low fidelity) or a **real chain** (SuNet or Sepolia)?"

Clarify:
- **Mock RPC** is much faster and easier to run, but it is not high fidelity.
- **Real chain** is slower but closer to production behavior.

## Prerequisites

- Node.js 18+
- pnpm installed

## 1) Configure environment (.env)

Copy the template:

```bash
cd nodejs/playwright
cp .env.example .env
```

Explain the key fields:

- `PRIVATE_KEY` is required (used by the wallet stub + transaction flow).
- `E2E_MOCK_RPC=true` for mock mode; `false` for real chain.
- `NETWORK`, `RPC_URL`, and `CHAIN_ID` must match your chain when not mocking.
- `BUY_SQUARE_ID` and `PERSONALIZE_SQUARE_ID` control the squares used in tests.
  - `PERSONALIZE_SQUARE_ID` accepts ranges like `1,5-60,400-600`.
- `BASE_URL` if the site runs somewhere other than `http://127.0.0.1:4000`.

Recommend key usage:
- **SuNet**: use the validator/test account key you already used in `nodejs/smart-contract`.
- **Sepolia**: use a funded test account key.

## 2) Install dependencies

```bash
cd nodejs/playwright
pnpm install
```

## 3) Install browsers

```bash
pnpm exec playwright install
```

## 4) Run tests

```bash
pnpm exec playwright test
```

## 5) View report

```bash
pnpm exec playwright show-report
```

## What this workspace is for

- Automated browser tests for critical user flows.
- Catch regressions that unit tests will not cover.
