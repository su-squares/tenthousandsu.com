## Chain-specific asset build quickstart

These steps wire the site to use chain-specific build outputs (`build-{network}` and `erc721-{network}`) and run the generator.

### 1) Configure env
- Edit `nodejs/smart-contract/.env.site`:
  - `CHAIN=sunet` (or `sepolia`)
  - `ASSET_BASE_SUNET=/build-sunet`, `ASSET_BASE_SEPOLIA=/build-sepolia`
  - Set `{NETWORK}_PRIMARY_ADDRESS` and `{NETWORK}_UNDERLAY_ADDRESS`
- Edit `nodejs/smart-contract/.env.contract`:
  - Set `TOKEN_URI_BASE_{NETWORK}` (e.g. `http://127.0.0.1:4000/erc721-sunet/`)
  - Set RPC/keys as needed for the chosen network

### 2) Generate runtime config
From `nodejs/smart-contract/` (or from `nodejs/` via workspace delegation):
```sh
pnpm run gen:site-config
```

### 3) Start the chain and Blockscout (for sunet)
From `nodejs/smart-contract/`:
```sh
pnpm run sunet:start
```

### 4) Build assets
From `nodejs/` (uses the smart-contract workspace script):
```sh

pnpm:

pnpm run assets:update:sunet      # or assets:update:sepolia
```

Outputs:
- `build-sunet/` or `build-sepolia/` (JSON + `wholeSquare.png`)
- `erc721-sunet/` or `erc721-sepolia/` (metadata + SVGs; gitignored)

### 5) Serve the site
Serve from the repo root (so `/build-{network}` is reachable). With `CHAIN` set in `runtime.generated.js`, the frontend will request assets from the corresponding `ASSET_BASE_*`.

### Notes
- If `assets/Inter-bold-subset.txt` or `assets/empty-board.png` are missing, the builder falls back to a blank base image.
- Redeploy `SuMain` with the env-driven `TOKEN_URI_BASE_{NETWORK}` when targeting a new network.***
