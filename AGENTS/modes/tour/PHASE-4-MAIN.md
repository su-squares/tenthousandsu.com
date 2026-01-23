# Phase 4: Dapp Walkthrough (Local)

This phase guides you through the live dapp once the site is running.

## Prerequisites

- Phase 3 complete (listener or update:assets running, runtime config generated).
- Wallet on the correct network with funds and any squares you plan to use.
- Mandatory for local dev: uncomment `- erc721/` in `_config.yml` under `exclude:` to avoid very slow Jekyll builds. This is not needed for SuNet or Sepolia development.

## Interaction Mode (Agent Prompt)

Ask explicitly:
- "Do you want a complete walkthrough (step-by-step), or do you want to pick specific parts to explore?"

If they choose a complete walkthrough, run the activities in order.
If they want specific parts, present the activities list below and ask which one(s).

## Agent Instructions

### Context-first guidance

- Always ask what they want to do next before jumping ahead.
- If they want to personalize but do not own any squares, route them to Buy first.
- If they want to buy in bulk, recommend the Phase 2 CLI scripts and then return to the dapp to personalize.
- If they cannot see their updates, route to Troubleshooting before repeating steps.

### Activities list (offer this when they want a custom path)

1) Open the site
2) Homepage billboard tour
3) Connect wallet
4) Buy flow
5) Personalize flow (modern + legacy overview)
6) Return to homepage + latest feeds
7) Square lookup + stats
8) Troubleshooting

## 0) Open the site

- Local: `http://localhost:4000`
- LAN (other devices): `http://LAN_IP:4000`
- If another device cannot connect, re-run Jekyll without `--livereload`.

## 1) Homepage billboard tour (`/`)

- This is the full 10,000-square billboard (hover for tooltips, click to open links).
- Empty squares are mintable; minted squares show their tooltip title.
- If you already personalized squares, they should appear here.
- Secondary note: some squares and links are blocklisted and will show a blocked tooltip or modal.

## 2) Connect wallet (before buy/personalize)

- Make sure your wallet is on the correct network (SuNet or Sepolia).
- Some wallets hide Sepolia by default; enable testnets if needed.
- WalletConnect: switch to the correct network before connecting (important).

## 3) Buy flow (`/buy`)

- Choose a square from the list or billboard, then select it and mint.
- The dapp only mints one square at a time.
- Bulk buys: use the Phase 2 CLI scripts, then come back to personalize here.

## 4) Personalize flow

- Recommended: `/personalize-modern` (billboard + table workflow).
  - Use "Show my Squares" to load holdings, select squares on the billboard, and fill the table.
  - Use the Instructions accordion for CSV and image batch tools.
- Legacy (historical): `/personalize` (single) and `/personalize-batch` (rectangular batch).

## 5) Return to homepage + latest feeds

- Go back to `/` to see your updates.
- At the bottom, check "Newly minted" and "Latest personalized" and click any item to open `/square#<id>`.

## 6) Square lookup (`/square`)

- Use the "Square look up" block on the homepage or the narrow version on `/square`.
- Enter an ID or use "Choose from list" / "Choose from billboard", then click "Look up".
- The square details page shows:
  - Minted and personalized block numbers
  - Title and link
  - Explorer link (Etherscan or Blockscout)
  - Location on the full billboard
  - Emojified view with a copy button

## Troubleshooting

### The billboard does not show my purchases or personalizations

1) Confirm the runtime config exists and matches your chain:
   - `assets/web3/config/runtime.generated.js`
   - If it is missing, the site defaults to mainnet.
2) Re-generate runtime config:
   - `pnpm run gen:site-config`
3) Ensure data is current:
   - Listener: `pnpm run listen:<network>`
   - One-time: `pnpm run update:assets:<network>`
4) Refresh the browser and check the console for missing assets or config.

### I cannot see SuNet or Sepolia in my wallet

- SuNet: add a custom network (see Phase 3 SuNet wallet setup).
- Sepolia: enable testnets or switch to a wallet that supports Sepolia.
- WalletConnect: always switch networks before connecting.

### Another device cannot load the site

- Use `bundle exec jekyll serve --host 0.0.0.0` and open `http://LAN_IP:4000`.
- If it still fails, restart without `--livereload`.
