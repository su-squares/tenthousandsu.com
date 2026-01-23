# Phase 3: SuNet Dapp Setup

Open this file alongside the shared guide and keep both open:
- [AGENTS/modes/tour/PHASE-3-MAIN.md](PHASE-3-MAIN.md)

## SuNet Must Be Running

Before configuring the dapp, make sure SuNet is up:
```bash
pnpm run sunet:status
```

If needed, start it:
```bash
pnpm run sunet:start
```

## .env.site Sunet Settings

In `nodejs/smart-contract/.env.site`, verify these match your SuNet config:
- `SUNET_CHAIN_ID` (default 99999991)
- `SUNET_RPC_URL` (default http://127.0.0.1:8545)
- `SUNET_BLOCK_EXPLORER_URL` (default http://localhost:4001)

If you changed the chain id or ports, update these before running `gen:site-config`.

If using another device on the same Wi-Fi, use your LAN IP in `SUNET_RPC_URL` and `SUNET_BLOCK_EXPLORER_URL` instead of localhost/127.0.0.1.

## Wallet Setup (MetaMask Gist)

Add a custom network in your wallet:
- Network name: SuNet
- RPC URL: `SUNET_RPC_URL`
- Chain ID: `SUNET_CHAIN_ID`
- Currency symbol: `SU`
- Block explorer: `SUNET_BLOCK_EXPLORER_URL`

Use an account that has a balance and owns the squares you want to interact with (validator or test account).
