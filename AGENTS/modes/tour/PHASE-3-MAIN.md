# Phase 3: Dapp Setup and Run (Main Guide)

This guide covers the shared Phase 3 flow for both SuNet and Sepolia.
Open this file alongside the network-specific Phase 3 file and keep both open.

## Prerequisites

- Phase 2 completed and contracts deployed
- `nodejs/smart-contract/contracts-deployed/` contains your deployment JSONs
- Node.js 18+ and pnpm installed
- Ruby + Bundler installed (see `Gemfile`)

## Interaction Mode (Agent Prompt)

Ask explicitly:
- "Do you want me to run the commands for you, or just tell you what to run?"

Default to giving commands. Only execute when the user explicitly asks.

## 1) Configure the Dapp Runtime

Copy the example and edit values:
```bash
Copy-Item nodejs/smart-contract/.env.site.example nodejs/smart-contract/.env.site
```

Set `CHAIN` to `sunet` or `sepolia`.

Address handling:
- If contract addresses are blank, the dapp falls back to `contracts-deployed/primary-<network>.json` and `underlay-<network>.json`.
- Only fill address overrides if you need to point at a specific deployment.

Pricing display (UI only):
- If you changed contract pricing before deploy, update:
  - `MINT_PRICE_ETH`
  - `PERSONALIZE_PRICE_ETH`

## 2) Start the Data Pipeline (Listener Recommended)

Default: run the event listener in a new terminal (requires deployed contracts).
```bash
pnpm run listen:<network>
```

Fallback (one-time sync):
```bash
pnpm run update:assets:<network>
```

## 3) Generate Runtime Config

This writes `assets/web3/config/runtime.generated.js` from `.env.site`.
```bash
pnpm run gen:site-config
```

## 4) Run the Dapp (Jekyll)

From the repo root:
```bash
bundle install
bundle exec jekyll serve --host 0.0.0.0 --incremental --livereload
```

Note: `--livereload` can interfere with access from other devices. If that happens, remove `--livereload` and refresh manually.

## Next

Once the dapp is running, move to Phase 4 for live usage inside the dapp.
