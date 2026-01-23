# Phase 2: Deploy and Interact (Main Guide)

This guide covers the shared Phase 2 flow for both SuNet and Sepolia.
Open this file alongside the network-specific Phase 2 file and keep both handy.

Replace `<network>` in commands with `sunet` or `sepolia`.

## Interaction Mode (Agent Prompt)

Ask explicitly:
- "Do you want me to run the commands for you, or just tell you what to run?"

Default to giving commands. Only execute when the user explicitly asks.

If a command is destructive (for example, `sunet:clean`), warn and confirm first.

## Choose Your Path

- **Explore contracts via scripts**: follow the checklist and flows below.
- **Skip to Phase 3**: open Phase 3 guides (main + network) and continue there.

## Pricing (Optional, Before Deploy)

Ask explicitly before deployment:
- "Do you want to customize pricing (mint, personalization, promo limit) or use defaults?"

If yes, update these in `nodejs/smart-contract/.env.contract` before deploying:
- `SALE_PRICE_ETH`
- `PERSONALIZATION_PRICE_ETH`
- `PROMO_CREATION_LIMIT`

## Guided Flows (Optional)

Offer a flow and then execute or provide the commands.

### Flow A: Quick Demo (Buy + Underlay Batch)

1) Set in `.env.contract`:
   - `BUY_TOKENS`
   - `PERSONALIZE_BATCH_TOKENS`
2) Ensure CSV + images exist for those tokens.
3) Run:
   - `pnpm run buy:<network>`
   - `pnpm run personalize:<network>:underlay-batch`
   - `pnpm run token-check:<network>`

### Flow B: Admin + Promo

1) Set role addresses in `.env.contract` (`CEO_ADDRESS`, `CFO_ADDRESS`, `COO_ADDRESS`).
2) Assign roles:
   - `pnpm run assign:<network>:ceo`
   - `pnpm run assign:<network>:cfo`
   - `pnpm run assign:<network>:coo`
3) Set `PROMO_TOKENID` + `PROMO_RECIPIENT_ADDRESS` and run:
   - `pnpm run promo:<network>:transfer`
4) Verify ownership:
   - `pnpm run balance:<network>`

### Flow C: Buy + Transfer

1) Set `BUY_TOKENS`, `TRANSFER_TOKENID`, `RECIPIENT_ADDRESS` in `.env.contract`.
2) Run:
   - `pnpm run buy:<network>`
   - `pnpm run transfer:<network>`
3) Verify:
   - `pnpm run balance:<network>`

### Flow D: Primary Personalize (Single)

1) Set `PERSONALIZE_TOKEN_ID` in `.env.contract`.
2) Ensure CSV + image exist for that token.
3) Run:
   - `pnpm run personalize:<network>:primary`
   - `pnpm run token-check:<network>`

## How Control Works

- Scripts are in `nodejs/smart-contract/package.json` with `:sunet` or `:sepolia` suffixes.
- Behavior is controlled via `nodejs/smart-contract/.env.contract`.
- For SuNet keys and ports, use `nodejs/smart-contract/sunet/.env.sunet`.

## Finding Deployment Records

The deployment files live in `nodejs/smart-contract/contracts-deployed/`.

You can either open the folder in your file explorer or run:
```bash
Get-Content contracts-deployed/primary-<network>.json
Get-Content contracts-deployed/underlay-<network>.json
```

## Explorer Links (Templates)

Use the explorer base for your network and paste in the values:
```
{BASE}/tx/{TX_HASH}
{BASE}/block/{BLOCK_NUMBER}
{BASE}/address/{ADDRESS}
{BASE}/token/{CONTRACT_ADDRESS}
{BASE}/token/{CONTRACT_ADDRESS}/instance/{TOKEN_ID}
```

If a direct link does not load, paste the hash or address into the explorer search bar.

## Batch Range Syntax

Many commands accept range syntax in `.env.contract`:
- Single: `1`
- Range: `1-10`
- Mixed: `1-10,15,200-300`

Applies to `BUY_TOKENS`, `TRANSFER_TOKENID`, and `PERSONALIZE_BATCH_TOKENS`.

## State Snapshot (Recommended)

```bash
pnpm run supply:<network>
pnpm run assign:<network>:read
pnpm run balance:<network>
pnpm run token-check:<network>
```

Set these in `.env.contract` as needed:
- `OWNER_ADDRESS` (for balance)
- `TOKEN_ID_CHECK` (for token-check)

## Roles and Admin Controls

- Read roles: `pnpm run assign:<network>:read`
- Assign roles (requires current CEO key):
  - `pnpm run assign:<network>:ceo`
  - `pnpm run assign:<network>:cfo`
  - `pnpm run assign:<network>:coo`
- Underlay roles (no COO on underlay):
  - `pnpm run assign:<network>:ceo:underlay`
  - `pnpm run assign:<network>:cfo:underlay`

Role targets come from `.env.contract` (`CEO_ADDRESS`, `CFO_ADDRESS`, `COO_ADDRESS`).

## Buy Tokens

```bash
pnpm run buy:<network>
```

Set `BUY_TOKENS` in `.env.contract`. Large buys can take a few minutes but let you personalize immediately once complete.

## Transfer Tokens

```bash
pnpm run transfer:<network>
```

Requires `TRANSFER_TOKENID` and `RECIPIENT_ADDRESS` in `.env.contract`.

## Promo Grants (COO Only)

```bash
pnpm run promo:<network>:transfer
```

Requires `PROMO_TOKENID` and `PROMO_RECIPIENT_ADDRESS` in `.env.contract`.

## Withdrawals (CFO Only)

```bash
pnpm run withdraw-check:<network>
pnpm run withdraw:<network>
```

## Personalization (CSV + Images)

Personalization requires:
- CSV: `nodejs/smart-contract/personalizing/metadata/personalizations.csv`
- Images: `nodejs/smart-contract/personalizing/images/<tokenId>.(svg|webp|png|jpg)`

Commands:
- Primary: `pnpm run personalize:<network>:primary` (uses `PERSONALIZE_TOKEN_ID`)
- Underlay (single): `pnpm run personalize:<network>:underlay`
- Underlay (batch): `pnpm run personalize:<network>:underlay-batch` (uses `PERSONALIZE_BATCH_TOKENS`)

Underlay personalization requires that the signer owns the token.

## If State Is Messy

If your on-chain state is confusing, redeploy for a clean slate:
- Re-deploy contracts: `pnpm run deploy:<network>:all`
- Full chain reset (SuNet only, destructive): `pnpm run sunet:clean` and re-run `pnpm run sunet:setup`
