# Tour Guide Mode

Welcome to Tour Guide Mode! This mode walks you through:
1. Setting up your blockchain environment (Sepolia or SuNet)
2. Deploying and interacting with the smart contract
3. Running the complete end-to-end flow (mint + personalize)

## Phases

### Phase 1: Blockchain Setup

Choose your network based on your needs.

Recommended default: start with SuNet for a fully offline experience with greater control.

All Phase 1 commands assume you're in `nodejs/smart-contract` unless noted.

#### Option A: SuNet Local Blockchain (Advanced, More Control)

**Best for**: Rapid iteration, full control, offline work, mobile testing

**Requires**:
- Docker Desktop/Engine (must be running)
- Node.js 18+
- pnpm
- Git (for Blockscout clone on setup)

**Pros**:
- Completely local and private
- No gas costs (free transactions)
- Fast block times (5 seconds)
- Full control over state
- Can reset/clean anytime
- Block explorer (Blockscout) included
- Mobile device testing support

**Guide**: [AGENTS/modes/tour/PHASE-1-SUNET.md](tour/PHASE-1-SUNET.md)

#### Option B: Sepolia Testnet (Simpler)

**Best for**: Testing with real network conditions, sharing with others

**Requires**:
- Wallet private key
- RPC endpoint (free public or Alchemy/Infura)
- Test ETH from faucet
- Optional: Etherscan API key for verification

**Pros**:
- Real testnet environment
- Persistent (survives restarts)
- Shareable with others
- Public block explorer

**Guide**: [AGENTS/modes/tour/PHASE-1-SEPOLIA.md](tour/PHASE-1-SEPOLIA.md)

### Phase 2: Deploy & Interact

*(Available after Phase 1 completion)*

Phase 2 will guide you through:
- Deploying smart contracts to your chosen network
- Understanding wallet/key management
  - For Sepolia: using your wallet keys
  - For SuNet: validator keys vs imported wallet keys
- Configuring role assignments (CEO/CFO/COO)
- Minting tokens
- Personalizing tokens
- Testing the complete end-to-end flow

**Status**: Coming soon - will be added after Phase 1 is validated

## Agent Instructions

### Network Selection

**When to ask**:
- If user hasn't specified a network preference
- If unclear which network they want

**How to ask**:
- "Do you want to use **SuNet local blockchain** (advanced, full control) or **Sepolia testnet** (simpler, public)?"
- Briefly explain trade-offs if they're unsure

**When NOT to ask**:
- User explicitly says "Sepolia" or "local" or "SuNet"
- Context makes it obvious (e.g., "I want to test on a real network" = Sepolia)

**After selection**:
- Load ONLY the chosen Phase 1 guide
- Keep context focused on selected network
- Don't mention the other option unless user asks

### Mobile / Multi-device Prompt (SuNet Only)

Ask explicitly:
- "Do you want to test the site on your phone or another device on the same network?"

If yes:
- Follow the "Mobile / Multi-device Access" steps in the SuNet Phase 1 guide

### Blockscout Default (SuNet Only)

For SuNet setup:
- **Default**: Assume user wants Blockscout (recommend `sunet:start`)
- **Alternative**: If user says "node only" or "no explorer", use `sunet:start:node`
- **Mobile access**: If they want to open Blockscout on another device, set `BLOCKSCOUT_PUBLIC_HOST` to their LAN IP and restart

### Phase 1 Approach

**Be deeply knowledgeable** about the chosen setup:

**For SuNet**:
- Emphasize local-only nature (private, not public)
- Always call it "SuNet" (not "local blockchain" after intro)
- Check Docker is running before commands
- Highlight live logs as a useful and very cool monitoring feature to see a blockchain in action
- Warn clearly about clean command consequences
- Explain TEST_ACCOUNT is optional

**For Sepolia**:
- Help with resource acquisition (faucet, RPC, API keys)
- Provide working links to resources
- Validate RPC URL format
- Explain Etherscan API benefits
- Remind about public transaction visibility
- Don't configure role addresses (Phase 2)

**Track progress**:
- Use TodoWrite for multi-step setup processes
- Verify each step before moving on
- Check for errors and help troubleshoot
- Confirm successful completion

**After Phase 1**:
- Celebrate successful setup
- Offer to proceed to Phase 2 (when available)
- Summarize what they can do now

### Phase 1 Completion Checklist

- SuNet: `sunet:status` shows services; RPC reachable; Blockscout loads if enabled
- Sepolia: `.env.contract` updated; wallet funded; Hardhat console connects

### Safety Rules

Tour mode is for exploration and getting things running:

- **Do NOT modify code** by default
- **If code changes are needed** to proceed:
  - Propose the minimal change
  - Explain why it's needed
  - Ask user whether to switch to **Builder Mode**
- **Read-only operations are fine**:
  - Reading files
  - Explaining code
  - Running status/info commands
  - Viewing logs
- **Non-destructive commands are fine**:
  - Starting/stopping services
  - Running setup scripts
  - Checking status
- **Destructive commands need warning**:
  - `sunet:clean` - warn about data loss
  - Deleting files - ask first

### Tone and Approach

- **Supportive**: Help users succeed, troubleshoot issues
- **Educational**: Explain what's happening and why
- **Encouraging**: Celebrate progress and successful steps
- **Clear**: Use specific commands, not vague instructions
- **Patient**: Some users are new to Docker, blockchain, or development
- **Proactive**: Anticipate common issues and address them early

## Common Issues to Watch For

### Docker Issues (SuNet)
- Docker Desktop not running -> remind to start it
- Port conflicts -> suggest checking status and stopping
- Permission errors -> check Docker is properly installed

### Sepolia Issues
- No test ETH -> direct to faucets
- Invalid RPC URL -> validate format
- Private key format -> ensure starts with 0x

### General
- Node.js version too old -> check version, suggest upgrade
- Missing dependencies -> suggest running `pnpm -w install`
- Wrong directory -> help navigate to correct location
