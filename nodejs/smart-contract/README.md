# Smart Contract Workspace

## Environment
- Copy `.env.contract.example` to `.env.contract` and fill the values before running Hardhat commands.
- Required keys: `SEPOLIA_RPC_URL`, `SEPOLIA_PRIVATE_KEY`, `CEO_ADDRESS`, `CFO_ADDRESS`, `COO_ADDRESS`. Add your `ETHERSCAN_API_KEY` if you want verification, and keep optional helpers like `BUY_TOKENS`, `PROMO_*`, and `REPORT_GAS` as needed.
- Local SuNet uses `sunet/.env.sunet`; see `nodejs/smart-contract/sunet/README.md` for that setup.

## Role assignment scripts
- CEO (current executive officer signer) can assign roles with:
  - `pnpm run assign:sunet:ceo` / `pnpm run assign:sepolia:ceo`
  - `pnpm run assign:sunet:cfo` / `pnpm run assign:sepolia:cfo`
  - `pnpm run assign:sunet:coo` / `pnpm run assign:sepolia:coo`
- Scripts read target addresses from `.env.contract` (`CEO_ADDRESS`, `CFO_ADDRESS`, `COO_ADDRESS`) and require the signer to be the current CEO on-chain.
- Read role assignments: `pnpm run assign:sunet:read` / `pnpm run assign:sepolia:read` prints current CEO/CFO/COO with coloring.
- COO promo transfer: `pnpm run promo:sunet:transfer` / `pnpm run promo:sepolia:transfer` reads `PROMO_TOKENID` and `PROMO_RECIPIENT_ADDRESS` from `.env.contract`, requires the signer to be the current COO on-chain, and fails fast if values are missing or COO is unset.
- CFO withdraw: `pnpm run withdraw:sunet` / `pnpm run withdraw:sepolia` requires the signer to be the current CFO on-chain and exits early if no CFO is set or the contract balance is zero.
