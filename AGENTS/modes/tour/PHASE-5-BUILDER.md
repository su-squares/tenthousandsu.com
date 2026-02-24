# Phase 5: Builder Workspace (Vendor Bundles)

This optional phase shows how the builder workspace bundles browser ESM files used by the site.

## Interaction Mode (Agent Prompt)

Ask explicitly:
- "Do you want me to run the commands for you, or just tell you what to run?"

Default to giving commands. Only execute when the user explicitly asks.

## Prerequisites

- Node.js 20.x LTS recommended
- pnpm installed

## 1) Install dependencies

```bash
cd nodejs/builder
pnpm install
```

## 2) Build bundles

```bash
pnpm build-wagmi
pnpm build-qr
pnpm build-all
```

Outputs:
- `nodejs/builder/dist/wagmi-bundle.js` (+ `.map`)
- `nodejs/builder/dist/qr-creator-bundle.js` (+ `.map`)

## 3) (Optional) Copy bundles into the site

This updates files in `assets/web3/vendor/` (code change). Confirm before doing this step.

PowerShell (Windows):
```powershell
Copy-Item dist/wagmi-bundle.js, dist/wagmi-bundle.js.map, dist/qr-creator-bundle.js, dist/qr-creator-bundle.js.map ../../assets/web3/vendor/
```

macOS/Linux:
```bash
cp dist/wagmi-bundle.js dist/wagmi-bundle.js.map dist/qr-creator-bundle.js dist/qr-creator-bundle.js.map ../../assets/web3/vendor/
```

## What this workspace is for

- Bundles long-lived vendor libs for the browser without CDN drift.
- Use it when you need to update wagmi/viem or QR bundles.
