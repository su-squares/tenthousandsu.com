# Phase 2: SuNet Deploy and Interact

Open this file alongside the shared guide and keep both open:
- [AGENTS/modes/tour/PHASE-2-MAIN.md](PHASE-2-MAIN.md)

All commands below assume you are in `nodejs/smart-contract` unless noted.

## Prerequisites

- Phase 1 SuNet completed and running
- `pnpm -w install` has been run
- `.env.sunet` exists (from `pnpm run sunet:setup`)

## 1) Deploy Contracts

```bash
pnpm run deploy:sunet:all
```

This deploys both the primary and underlay contracts and writes records to:
- `nodejs/smart-contract/contracts-deployed/primary-sunet.json`
- `nodejs/smart-contract/contracts-deployed/underlay-sunet.json`

### Verification Note

Deployment attempts verification automatically. If Blockscout is down or unreachable, verification may be skipped. You can continue anyway.

## SuNet Signer and Funding

- Scripts use `TEST_ACCOUNT_PRIVATE_KEY` if set.
- Otherwise they fall back to `VALIDATOR_PRIVATE_KEY`.
- The validator is prefunded. If you want to use another wallet, fund it from the validator or set `TEST_ACCOUNT_PRIVATE_KEY` in `.env.sunet`.

## Observability

- Blockscout: http://localhost:4001
- If viewing from another device on the same Wi-Fi, use your LAN IP with the same port (for example, `http://YOUR_LAN_IP:4001`) instead of `localhost`.
- Live node logs: `pnpm run sunet:logs` or `pnpm run sunet:logs:node`
- Logs show tx submissions and errors in real time.

## Explorer Links (SuNet Base)

Base:
```
http://localhost:4001
```

Templates:
```
http://localhost:4001/tx/<TX_HASH>
http://localhost:4001/block/<BLOCK_NUMBER>
http://localhost:4001/address/<ADDRESS>
http://localhost:4001/token/<CONTRACT_ADDRESS>
http://localhost:4001/token/<CONTRACT_ADDRESS>/instance/<TOKEN_ID>
```

If you are on another device, replace `localhost` with your LAN IP.

## Optional: Blockscout REST API (Local)

No API key required for REST calls on the local instance:
```bash
curl http://localhost:4001/api/health
curl "http://localhost:4001/api/v2/internal-transactions?address=<CONTRACT_ADDRESS>"
```

## Continue to Main Guide

Proceed with flows and the checklist:
- [AGENTS/modes/tour/PHASE-2-MAIN.md](PHASE-2-MAIN.md)
