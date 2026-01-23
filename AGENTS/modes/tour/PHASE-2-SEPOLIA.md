# Phase 2: Sepolia Deploy and Interact

Open this file alongside the shared guide and keep both open:
- [AGENTS/modes/tour/PHASE-2-MAIN.md](PHASE-2-MAIN.md)

All commands below assume you are in `nodejs/smart-contract` unless noted.

## Prerequisites

- Phase 1 Sepolia completed
- `pnpm -w install` has been run
- `.env.contract` set with `SEPOLIA_RPC_URL` and `SEPOLIA_PRIVATE_KEY`

## 1) Deploy Contracts

```bash
pnpm run deploy:sepolia:all
```

This deploys both the primary and underlay contracts and writes records to:
- `nodejs/smart-contract/contracts-deployed/primary-sepolia.json`
- `nodejs/smart-contract/contracts-deployed/underlay-sepolia.json`

### Verification Note

Deployment attempts verification automatically. If Etherscan is flaky or the API key is missing, verification may be skipped. You can continue anyway.

## Sepolia Signer and Funding

- Default signer uses `SEPOLIA_PRIVATE_KEY` from `.env.contract`.
- Overrides: `BUYER_PRIVATE_KEY` (buy) and `TRANSFER_PRIVATE_KEY` (transfer).

## Observability

- Etherscan: https://sepolia.etherscan.io

## Explorer Links (Sepolia Base)

Base:
```
https://sepolia.etherscan.io
```

Templates:
```
https://sepolia.etherscan.io/tx/<TX_HASH>
https://sepolia.etherscan.io/block/<BLOCK_NUMBER>
https://sepolia.etherscan.io/address/<ADDRESS>
https://sepolia.etherscan.io/token/<CONTRACT_ADDRESS>
https://sepolia.etherscan.io/token/<CONTRACT_ADDRESS>?a=<TOKEN_ID>
```

If a direct link does not load, paste the hash or address into the Etherscan search bar.

## Continue to Main Guide

Proceed with flows and the checklist:
- [AGENTS/modes/tour/PHASE-2-MAIN.md](PHASE-2-MAIN.md)
