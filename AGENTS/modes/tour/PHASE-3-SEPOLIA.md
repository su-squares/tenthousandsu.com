# Phase 3: Sepolia Dapp Setup

Open this file alongside the shared guide and keep both open:
- [AGENTS/modes/tour/PHASE-3-MAIN.md](PHASE-3-MAIN.md)

## .env.site Sepolia Settings

In `nodejs/smart-contract/.env.site`:
- Set `CHAIN=sepolia`
- Set `SEPOLIA_RPC_URL` if you want an explicit RPC provider
- Leave contract addresses blank unless you need overrides (the dapp reads from `contracts-deployed/`)

## Wallet Setup (Sepolia)

Enable Sepolia in your wallet (MetaMask is recommended).
Some wallets do not support Sepolia; if your wallet cannot enable it, you will need a different wallet.

Make sure the wallet account has Sepolia ETH and owns the squares you want to use in the dapp.
