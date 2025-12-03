# SuNet (Besu QBFT + Blockscout)

Local one-validator QBFT network using Hyperledger Besu with optional Blockscout explorer. Designed to mimic the ritoswap local-blockchain UX: `.env.sunet`-driven scripts, split compose files, and helper scripts in TypeScript.

## Prerequisites
- **Docker Desktop** (Windows/macOS) or **Docker Engine** (Linux)  
  SuNet uses `docker compose` (Compose v2), which is included with Docker Desktop.  
  Make sure Docker is *running* before starting the network.
- **Node 18+** with pnpm (or npm)
- **Git** (required for cloning Blockscout on first setup)

> If you’ve never used Docker before: install Docker Desktop from https://www.docker.com/products/docker-desktop/ and launch it once so the background services are running. All SuNet commands rely on the Docker daemon being active.

## Quickstart

> **Important:** Before running any commands (other than installing Node.js dependencies), make sure the Docker daemon / Docker Desktop is running. SuNet relies on Docker for all network operations.

```bash
# Install workspace deps (from repo root)
pnpm install

# One-time network bootstrap (generates validator key + genesis, clones Blockscout)
pnpm run sunet:setup

# Start Besu only
pnpm run sunet:start:node

# Start Besu + Blockscout
pnpm run sunet:start

# Logs / status
pnpm run sunet:logs
pnpm run sunet:status

# Stop
pnpm run sunet:stop

# Delete all generated files
pnpm run sunet:clean



```

Access:
- RPC: http://localhost:8545
- WS: ws://localhost:8546
- Blockscout: http://localhost:4001 (when started)

## Scripts
- `sunet:setup` — create `.env.sunet` (if missing), generate validator key, write genesis, init Besu data, clone Blockscout repo.
- `sunet:start` — bring up Besu + Blockscout stack (`compose/docker-compose.yml`).
- `sunet:start:node` — Besu only (`compose/docker-compose.besu.yml`).
- `sunet:stop` / `sunet:stop:node` — stop stacks.
- `sunet:clean` — prompt + remove data and docker volumes.
- `sunet:logs`, `sunet:logs:node`, `sunet:logs:blockscout`, `sunet:status` — observability helpers.
- `sunet:generate:genesis` — regenerate genesis from `.env.sunet`.
- `sunet:reveal:address` / `sunet:reveal:key` — print validator info (dev-use only).

## Config
- `.env.sunet.example` holds defaults (Chain ID 1337, 5s blocks, SuNet naming). `sunet:setup` will create `.env.sunet` if missing and fill in validator keys.
- Genesis includes Cancun/Shanghai at time 0, archive-style node (pruning disabled) so Blockscout traces work.
- Data lives in `sunet/data` (bind-mounted). Config and keys live in `sunet/config`.

> Set the `TEST_ACCOUNT` environment variable in `.env.sunet` to the address you want to use for sending transactions. This account will be pre-funded in the genesis file so you can deploy and interact with contracts immediately. Add `TEST_ACCOUNT_PRIVATE_KEY` if you want local scripts to sign as that account; otherwise scripts like `buy.ts` will sign with `VALIDATOR_PRIVATE_KEY`.
>
> Set `VALIDATOR_ACCOUNT_BALANCE` in `.env.sunet` to override the validator's prefund in the genesis file. If left blank, it defaults to 50,000 ETH (in wei).

### Buying tokens with the script

- PowerShell: `$env:BUY_TOKENS="1-10,50"; pnpm --filter smart-contract buy:sunet`
- cmd.exe: `set BUY_TOKENS=1-10,50 && pnpm --filter smart-contract buy:sunet`
- If `BUY_TOKENS` is omitted, the script attempts token `1` only (no brute force). Use range syntax like `5-10,42,100-120` to queue multiple purchases.
- Control burst size with `BUY_CONCURRENCY` (default 5) to avoid overwhelming the RPC (e.g. `BUY_CONCURRENCY=10 BUY_TOKENS="1-50" pnpm --filter smart-contract buy:sunet`).

## Blockscout
- `sunet:setup` clones the Blockscout repo into `sunet/blockscout` at `BLOCKSCOUT_TAG` (default `v9.2.2`).
- Compose files extend the Blockscout docker-compose service definitions; ensure the clone is present before starting the full stack.

## Notes
- Single-validator QBFT is non-fault-tolerant but fine for local dev.
- If you change `VALIDATOR_PRIVATE_KEY` or `LOCAL_CHAIN_ID`, re-run `sunet:setup` (or at least `sunet:generate:genesis` + `sunet:clean`) before starting.***
