# Phase 1: SuNet Local Blockchain Setup

## What is SuNet?

**SuNet** (Su Network) is our local blockchain for development. It's a private network that runs entirely on your machine via Docker.

**Important**: SuNet is NOT a public network. It's a local development environment with:
- Your own private blockchain
- Instant block times (5 seconds)
- No gas costs (free transactions)
- Full control over accounts and state
- Block explorer (Blockscout, default)

SuNet uses Hyperledger Besu with QBFT consensus and includes a Blockscout explorer for browsing blocks and transactions.

## Prerequisites

### Docker Desktop (Required)

**Windows/macOS**: Install Docker Desktop
- Download: https://www.docker.com/products/docker-desktop/
- Launch Docker Desktop after installation
- Make sure it's running (check system tray/menu bar)

**Linux**: Install Docker Engine
- Follow official Docker installation for your distro
- Ensure Docker daemon is running: `sudo systemctl status docker`

**New to Docker?**
Docker is a tool that runs applications in containers. For SuNet, you just need to:
1. Install Docker Desktop
2. Launch it once so the background services start
3. Keep it running when using SuNet

All SuNet commands require the Docker daemon to be active.

### Node.js and Package Manager

- **Node.js 18+**: Required for running scripts
- **pnpm**: Required for running commands

### Git (Required)

- **Git**: Required for cloning Blockscout during `sunet:setup`

Check your versions:
```bash
node --version  # Should be v18 or higher
pnpm --version
```

## Setup Walkthrough

All commands below assume you are in `nodejs/smart-contract` unless noted.

### 1. Go to the Smart Contract Directory

From the repository root:

```bash
cd nodejs/smart-contract
```

### 2. Install Workspace Dependencies (First Time Only)

```bash
pnpm -w install
```

This installs all dependencies for the workspace, including SuNet scripts.

### 3. One-Time Network Bootstrap

Run the setup command:

```bash
pnpm run sunet:setup
```

**What this does**:
- Creates `.env.sunet` configuration file (if it doesn't exist)
- Generates a validator private key and address
- Creates the genesis block with prefunded accounts
- Initializes Besu data directory
- Clones the Blockscout repository (for the block explorer)

**Generated Configuration**:
- **Chain ID**: 99999991 (default, configurable)
- **Block Time**: 5 seconds
- **Validator Account**: Auto-generated with 50,000 ETH prefund
- **Test Account**: Optional separate funded account

### 4. Optional: Configure Test Account

Open `nodejs/smart-contract/sunet/.env.sunet` and optionally set:

```bash
# Optional: separate funded account for testing
TEST_ACCOUNT=0xYOUR_ADDRESS_HERE
TEST_ACCOUNT_BALANCE=10000000000000000000000  # 10,000 ETH in wei

# Optional: if you want scripts to use this account
TEST_ACCOUNT_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```

If not set, you'll use the auto-generated validator account for everything.

## Starting SuNet

### Recommended: With Blockscout Explorer

```bash
pnpm run sunet:start
```

This starts:
- Besu blockchain node
- Blockscout backend (indexer and API)
- Blockscout frontend (web UI)

**Access Blockscout**: http://localhost:4001

**Why Port 4001?**
- Avoids conflict with Jekyll dev server (port 4000)
- For mobile access, set `BLOCKSCOUT_PUBLIC_HOST` in `.env.sunet` to your LAN IP, then restart
- Example: from your phone, visit `http://YOUR_COMPUTER_IP:4001`

### Alternative: Node Only (No Explorer)

```bash
pnpm run sunet:start:node
```

This starts just the blockchain node without the block explorer. Use this if you don't need the UI or want to reduce resource usage.

## Mobile / Multi-device Access (Optional)

Want to view Blockscout or hit the RPC from a phone or another device?

### 1. Find your LAN IP

- Windows (PowerShell): `ipconfig` (look for IPv4 Address)
- macOS: `ipconfig getifaddr en0`
- Linux: `hostname -I`

### 2. Set Blockscout host

Edit `nodejs/smart-contract/sunet/.env.sunet`:

```bash
BLOCKSCOUT_PUBLIC_HOST=YOUR_LAN_IP
```

### 3. Restart SuNet

```bash
pnpm run sunet:stop
pnpm run sunet:start
```

### 4. Use these URLs on the other device

- Blockscout: `http://YOUR_LAN_IP:4001`
- RPC: `http://YOUR_LAN_IP:8545`

**Notes**:
- Devices must be on the same network.
- Do not use `localhost` on the phone.
- If it won't load, check firewall prompts.

## Watching SuNet Work (This is Cool!)

### View Live Logs

Watch blocks being mined and transactions being processed in real-time:

```bash
pnpm run sunet:logs
```

**What you'll see**:
- Blocks being created every 5 seconds
- Transactions being included in blocks
- Contract deployments and interactions
- Real-time blockchain activity

**This is great for**:
- Monitoring your transactions as they happen
- Debugging smart contract interactions
- Understanding blockchain behavior
- Feeling like a blockchain wizard

### Specific Logs

View only node logs:
```bash
pnpm run sunet:logs:node
```

View only Blockscout logs:
```bash
pnpm run sunet:logs:blockscout
```

### Check Status

See what's running:
```bash
pnpm run sunet:status
```

## Stopping SuNet

### Stop Everything

```bash
pnpm run sunet:stop
```

Stops both Besu and Blockscout (if running).

### Stop Node Only

```bash
pnpm run sunet:stop:node
```

Stops just the Besu node.

## Starting Over: The Clean Command

### Clean All Data

```bash
pnpm run sunet:clean
```

**WARNING**: This removes ALL data including:
- All deployed smart contracts
- All transactions and blocks
- All account balances (except genesis prefunds)
- Complete blockchain state

**Use this when**:
- You want a completely fresh blockchain
- You've messed up state and want to reset
- You're starting a new development phase

**After cleaning**:
- Re-run `pnpm run sunet:setup` to reinitialize
- You'll need to redeploy all contracts
- All previous data is permanently lost

The clean command will prompt for confirmation before deleting anything.

## Network Access

Once SuNet is running, access it at:

- **RPC**: http://localhost:8545
- **WebSocket**: ws://localhost:8546
- **Blockscout** (when started): http://localhost:4001

Use these URLs in:
- Hardhat configuration (already configured for you)
- MetaMask or other wallets (add custom network)
- Web3 scripts and dApps

## Configuration Notes

Default SuNet configuration (in `.env.sunet`):

| Setting | Value | Description |
|---------|-------|-------------|
| Chain ID | 99999991 | Network identifier |
| Block Time | 5 seconds | Time between blocks |
| RPC Port | 8545 | HTTP RPC endpoint |
| WS Port | 8546 | WebSocket endpoint |
| Blockscout Port | 4001 | Block explorer UI |
| Validator Balance | 50,000 ETH | Auto-generated validator prefund |
| Test Account | Optional | Additional funded account |

You can modify these in `.env.sunet`, but you'll need to re-run `sunet:setup` (or at least `sunet:generate:genesis`) and `sunet:clean` to apply changes.

**Block Time tips**:
- Default is 5 seconds.
- Use `BLOCK_TIME=2` for faster feedback on capable machines.
- Use `BLOCK_TIME=10` on older hardware to reduce resource usage.
- Changing `BLOCK_TIME` requires regenerating the genesis and cleaning the chain.

## Common Commands Reference

| Command | Description |
|---------|-------------|
| `pnpm run sunet:setup` | One-time bootstrap (generate keys, genesis, clone Blockscout) |
| `pnpm run sunet:start` | Start Besu + Blockscout |
| `pnpm run sunet:start:node` | Start Besu only (no explorer) |
| `pnpm run sunet:stop` | Stop everything |
| `pnpm run sunet:stop:node` | Stop node only |
| `pnpm run sunet:logs` | View live logs (all services) |
| `pnpm run sunet:logs:node` | View node logs only |
| `pnpm run sunet:logs:blockscout` | View Blockscout logs only |
| `pnpm run sunet:status` | Check what's running |
| `pnpm run sunet:clean` | Delete all data (with confirmation) |

## Troubleshooting

### Docker not running
**Error**: `Cannot connect to the Docker daemon`
**Solution**: Launch Docker Desktop and wait for it to fully start

### Port already in use
**Error**: `port is already allocated`
**Solution**:
- Check if SuNet is already running: `pnpm run sunet:status`
- Stop it: `pnpm run sunet:stop`
- Or check for other services using ports 8545, 8546, or 4001

### Blockscout not loading
**Issue**: http://localhost:4001 doesn't load
**Solution**:
- Check logs: `pnpm run sunet:logs:blockscout`
- Blockscout takes 30-60 seconds to fully start
- Ensure you ran `sunet:start` (not `sunet:start:node`)

## Completion Checklist

- `pnpm run sunet:status` shows running services
- RPC responds at http://localhost:8545
- Blockscout loads at http://localhost:4001 (if started)

## What's Next?

You're ready for **Phase 2: Deploy & Interact**!

Phase 2 will cover:
- Deploying your smart contract to SuNet
- Managing validator vs imported wallet keys
- Configuring role assignments (CEO/CFO/COO)
- Minting tokens and testing the full flow
- Using Blockscout to explore your contracts

## Agent Instructions

When guiding users through SuNet setup:

- **Always call it "SuNet"** after the introduction (not "local blockchain")
- **Check Docker is running** before suggesting any commands
- **Emphasize live logs** as a cool feature for monitoring blockchain activity
- **Default to Blockscout** (full stack) unless user prefers node-only
- **Warn about clean command** - make consequences very clear before running
- **Explain TEST_ACCOUNT is optional** - validator key works fine for development
- **Phase 2 covers key management** - don't dive into validator vs wallet keys yet
- **Verify prerequisites** before starting (Docker running, Node.js 18+)
- **Monitor setup progress** - setup command takes a minute, watch for errors
