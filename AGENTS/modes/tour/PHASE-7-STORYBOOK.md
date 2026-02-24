# Phase 7: Storybook Workspace (Component Docs)

This optional phase shows how to run the UI component documentation sandbox.

## Interaction Mode (Agent Prompt)

Ask explicitly:
- "Do you want me to run the commands for you, or just tell you what to run?"

Default to giving commands. Only execute when the user explicitly asks.

## Prerequisites

- Node.js 18+
- pnpm installed

## 1) Install dependencies

```bash
cd nodejs/storybook
pnpm install
```

## 2) Run Storybook

```bash
pnpm storybook
```

Open: `http://localhost:6006`

Optional build:
```bash
pnpm build-storybook
```

## What this workspace is for

- Browse and review UI components in isolation.
- Useful for visual QA or onboarding to the UI system.
