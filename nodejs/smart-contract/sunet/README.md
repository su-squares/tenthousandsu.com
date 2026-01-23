# SuNet (Besu QBFT + Blockscout)

Local one-validator QBFT network using Hyperledger Besu with Blockscout explorer by default. Designed to mimic the ritoswap local-blockchain UX: `.env.sunet`-driven scripts, split compose files, and helper scripts in TypeScript.

## Prerequisites
- **Docker Desktop** (Windows/macOS) or **Docker Engine** (Linux)  
  SuNet uses `docker compose` (Compose v2), which is included with Docker Desktop.  
  Make sure Docker is *running* before starting the network.
- **Node 18+** with pnpm
- **Git** (required for cloning Blockscout on first setup)

> If you’ve never used Docker before: install Docker Desktop from https://www.docker.com/products/docker-desktop/ and launch it once so the background services are running. All SuNet commands rely on the Docker daemon being active.

## Quickstart

> **Important:** Before running any commands (other than installing Node.js dependencies), make sure the Docker daemon / Docker Desktop is running. SuNet relies on Docker for all network operations.

```bash
# From repo root
cd nodejs/smart-contract

# Install workspace deps (first time only)
pnpm -w install

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

### Mobile / Multi-device Access (Optional)

If you want to view Blockscout or hit the RPC from a phone or another device:

1) Find your LAN IP:
- Windows (PowerShell): `ipconfig` (look for IPv4 Address)
- macOS: `ipconfig getifaddr en0`
- Linux: `hostname -I`

2) Set `BLOCKSCOUT_PUBLIC_HOST` in `.env.sunet`:
```
BLOCKSCOUT_PUBLIC_HOST=YOUR_LAN_IP
```

3) Restart SuNet:
```
pnpm run sunet:stop
pnpm run sunet:start
```

4) Use these URLs from the other device:
- Blockscout: `http://YOUR_LAN_IP:4001`
- RPC: `http://YOUR_LAN_IP:8545`

Notes:
- Devices must be on the same network.
- Do not use `localhost` on the phone.
- If it won't load, check firewall prompts.

## Scripts
- `sunet:setup` - create `.env.sunet` (if missing), generate validator key, write genesis, init Besu data, clone Blockscout repo.
- `sunet:start` - bring up Besu + Blockscout stack (`compose/docker-compose.yml`).
- `sunet:start:node` - Besu only (`compose/docker-compose.besu.yml`).
- `sunet:stop` / `sunet:stop:node` - stop stacks.
- `sunet:clean` - prompt + remove data and docker volumes.
- `sunet:logs`, `sunet:logs:node`, `sunet:logs:blockscout`, `sunet:status` - observability helpers.
- `sunet:generate:genesis` - regenerate genesis from `.env.sunet`.

## Contract Control (Scripts + Env)

- Contract commands live in `nodejs/smart-contract/package.json` and are grouped by network suffix (`:sunet`, `:sepolia`).
- Control the behavior via `nodejs/smart-contract/.env.contract` (token ranges, recipients, role addresses, personalization ids).
- SuNet keys and ports live in `nodejs/smart-contract/sunet/.env.sunet`.

## Observability

- Blockscout: http://localhost:4001
- Live node logs: `pnpm run sunet:logs` or `pnpm run sunet:logs:node`
- Use logs to see tx submissions and errors in real time.

## Batch Range Syntax

Many commands accept token ranges in `.env.contract`:
- Single: `1`
- Range: `1-10`
- Mixed: `1-10,15,200-300`

This applies to `BUY_TOKENS`, `TRANSFER_TOKENID`, and `PERSONALIZE_BATCH_TOKENS`.

## Config
- `.env.sunet.example` holds defaults (Chain ID 99999991, 5s blocks, SuNet naming). `sunet:setup` will create `.env.sunet` if missing and fill in validator keys.
- Genesis includes Cancun/Shanghai at time 0, archive-style node (pruning disabled) so Blockscout traces work.
- Data lives in `sunet/data` (bind-mounted). Config and keys live in `sunet/config`.

> Set the `TEST_ACCOUNT` environment variable in `.env.sunet` to the address you want to use for sending transactions. This account will be pre-funded in the genesis file so you can deploy and interact with contracts immediately. Add `TEST_ACCOUNT_PRIVATE_KEY` if you want local scripts to sign as that account; otherwise scripts like `buy.ts` will sign with `VALIDATOR_PRIVATE_KEY`.
>
> Set `VALIDATOR_ACCOUNT_BALANCE` in `.env.sunet` to override the validator's prefund in the genesis file. If left blank, it defaults to 50,000 ETH (in wei).

### Buying tokens with the script

- PowerShell: `$env:BUY_TOKENS="1-10,50"; pnpm run buy:sunet`
- cmd.exe: `set BUY_TOKENS=1-10,50 && pnpm run buy:sunet`
- If `BUY_TOKENS` is omitted, the script attempts token `1` only (no brute force). Use range syntax like `5-10,42,100-120` to queue multiple purchases.
- Control burst size with `BUY_CONCURRENCY` (default 5) to avoid overwhelming the RPC (e.g. `BUY_CONCURRENCY=10 BUY_TOKENS="1-50" pnpm run buy:sunet`).
- Large buys can take a few minutes but will let you personalize immediately once complete.

## Personalization Workflow

Personalization scripts require both metadata and images:

- CSV: `nodejs/smart-contract/personalizing/metadata/personalizations.csv`
- Images: `nodejs/smart-contract/personalizing/images/<tokenId>.(svg|webp|png|jpg)`

Commands:
- Primary: `pnpm run personalize:sunet:primary` (single token, uses `PERSONALIZE_TOKEN_ID`)
- Underlay: `pnpm run personalize:sunet:underlay` (single) or `pnpm run personalize:sunet:underlay-batch` (uses `PERSONALIZE_BATCH_TOKENS`)

## Blockscout
- `sunet:setup` clones the Blockscout repo into `sunet/blockscout` at `BLOCKSCOUT_TAG` (default `v9.2.2`).
- Compose files extend the Blockscout docker-compose service definitions; ensure the clone is present before starting the full stack.
- To access Blockscout from another device, set `BLOCKSCOUT_PUBLIC_HOST` in `.env.sunet` to your LAN IP and restart.

## Notes
- Single-validator QBFT is non-fault-tolerant but fine for local dev.
- If you change `VALIDATOR_PRIVATE_KEY`, `LOCAL_CHAIN_ID`, or `BLOCK_TIME`, re-run `sunet:setup` (or at least `sunet:generate:genesis` + `sunet:clean`) before starting.

### Block Time

- Default is 5 seconds.
- Set `BLOCK_TIME=2` for faster feedback on capable machines.
- Set `BLOCK_TIME=10` on older hardware to reduce resource usage.
- Changing `BLOCK_TIME` requires regenerating the genesis and cleaning the chain.
