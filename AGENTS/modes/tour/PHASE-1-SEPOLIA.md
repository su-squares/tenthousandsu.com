# Phase 1: Sepolia Testnet Setup

## Introduction

Sepolia is a public Ethereum testnet used for testing smart contracts before deploying to mainnet. Transactions on Sepolia are public and visible to anyone, but use test ETH with no real-world value.

## Prerequisites

- **Node.js 18+**: Required for running Hardhat scripts
- **pnpm**: Required for running commands
- **Ethereum wallet with private key**: You'll need a wallet address and its private key for deploying contracts
- **Important**: All transactions on Sepolia are PUBLIC and permanently visible on the blockchain

## Resources You'll Need

### 1. Sepolia Test ETH

You need Sepolia ETH to pay for gas when deploying contracts. Get it from a faucet:

- **Sepolia Faucet**: https://sepoliafaucet.com
- **Google Search**: "Sepolia faucet" for additional options (Alchemy, Infura, etc.)
- Most faucets require social verification (Twitter/GitHub) to prevent abuse

### 2. RPC Endpoint

You need an RPC endpoint to connect to the Sepolia network. Options:

**Free Public Endpoint** (easiest, but rate-limited):
- `https://rpc.sepolia.org`

**Dedicated Providers** (recommended for reliability):
- **Alchemy**: https://www.alchemy.com
  - Sign up for free tier
  - Create a new app, select "Ethereum" and "Sepolia"
  - Copy the HTTP endpoint URL
- **Infura**: https://www.infura.io
  - Sign up for free tier
  - Create a new project
  - Copy the Sepolia endpoint URL

### 3. Etherscan API Key (Optional but Recommended)

Etherscan API key allows automatic contract verification, making your contract source code publicly viewable:

- Sign up at https://etherscan.io
- Navigate to **API Keys** section in your account
- Create a new API key
- Copy the key for configuration

## Configuration Steps

All commands below assume you are in `nodejs/smart-contract` unless noted.

### 1. Navigate to Smart Contract Directory

```bash
cd nodejs/smart-contract
```

### 2. Install Workspace Dependencies (First Time Only)

```bash
pnpm -w install
```

### 3. Create Environment File

Copy the example file:

```bash
# Windows PowerShell
copy .env.contract.example .env.contract

# macOS/Linux/Git Bash
cp .env.contract.example .env.contract
```

### 4. Fill Required Fields

Open `.env.contract` in your editor and fill these required fields:

```bash
# Required: Your wallet private key (starts with 0x)
SEPOLIA_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# Required: Your RPC endpoint
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY

# Optional but recommended: Etherscan API key for contract verification
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
```

**Note**: `SEPOLIA_WS_URL` is optional for Phase 1 and can be set later in Phase 2 if you want listeners.

**Security Note**: Never commit `.env.contract` to version control. It's already in `.gitignore`.

### 5. Skip Role Addresses (For Now)

The fields `CEO_ADDRESS`, `CFO_ADDRESS`, `COO_ADDRESS` are for Phase 2 (after deployment). Leave them empty for now.

## Verification

### 1. Check Your Balance

Verify you have Sepolia ETH:
- Visit https://sepolia.etherscan.io
- Search for your wallet address
- Confirm you have a non-zero balance

### 2. Test RPC Connection

You can test your RPC connection with this quick check:

```bash
# From nodejs/smart-contract directory
pnpm run hardhat console --network sepolia
```

If successful, you'll see a Hardhat console. Type `.exit` to quit.

## Completion Checklist

- `.env.contract` updated with `SEPOLIA_PRIVATE_KEY` and `SEPOLIA_RPC_URL`
- Wallet address funded with Sepolia ETH
- Hardhat console connects on Sepolia

## What's Next?

You're ready for **Phase 2: Deploy & Interact**!

Phase 2 will cover:
- Deploying your smart contract to Sepolia
- Configuring role assignments (CEO/CFO/COO)
- Minting tokens and testing the full flow

## Agent Instructions

When guiding users through Sepolia setup:

- **Ask if they need help** getting testnet ETH from faucets
- **Validate RPC URL format** (should start with `http://` or `https://`)
- **Explain Etherscan API key benefits**: Makes contract source code publicly viewable and verifiable
- **Remind about public visibility**: All transactions are permanently visible on Sepolia
- **Don't configure role addresses yet**: These are for Phase 2 after deployment
- **Verify prerequisites**: Confirm Node.js 18+ is installed before proceeding
