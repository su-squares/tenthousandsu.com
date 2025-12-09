# Personalizing Su Squares

This folder is where you prepare **images + metadata** for on-chain personalizations and then drive them through the Hardhat scripts.

---

## Folder layout

From the repo root:

* `nodejs/smart-contract/personalizing/`

  * `sample-square.png` – sample image you can reuse
  * `personalizations.example.csv` – sample CSV you can reuse
  * `images/` – put your per-token images here
  * `metadata/` – put your `personalizations.csv` here

Target layout:

```text
nodejs/smart-contract/personalizing/
  README.md
  sample-square.png
  personalizations.example.csv
  images/
    1.png
    2.svg
    3.webp
    ...
  metadata/
    personalizations.csv
```

> Windows paths are the same but with backslashes, e.g.
> `nodejs\smart-contract\personalizing\images`

---

## 1. Images: where to put them and how to name them

**Folder:**

* Put all personalization images under:

  ```text
  nodejs/smart-contract/personalizing/images
  ```

**File naming:**

* Each file name must match the token ID you’re personalizing:

  * `1.png` → tokenId `1`
  * `42.svg` → tokenId `42`
  * `10000.webp` → tokenId `10000`
* Valid token IDs: `1` through `10000`.

**Supported extensions & priority**

The loader looks for the first existing file for a token in this order:

1. `.svg`
2. `.webp`
3. `.png`
4. `.jpg`

So if you have both `1.svg` and `1.png`, the `.svg` will be used.

> **Note:** The current loader supports `.svg`, `.webp`, `.png`, `.jpg`.
> If you normally use `.jpeg`, rename the file to `.jpg` or update the helper.

**Image size**

* Images can be any size; they are automatically:

  * resized to **10×10 pixels**
  * converted to **RGB (no alpha)**
* For best results, use **square images** with the artwork centered.

If a token ID has no matching image in `images/`, personalization scripts for that token will fail with a clear error.

---

## 2. Sample assets you can reuse

You already have:

* `nodejs/smart-contract/personalizing/sample-square.png`
* `nodejs/smart-contract/personalizing/personalizations.example.csv`

### 2.1 Sample image

To use the sample image:

1. Copy or move it into the `images` folder:

   ```text
   nodejs/smart-contract/personalizing/images/sample-square.png
   ```
2. Rename it so the file name matches a token ID you own, for example:

   ```text
   nodejs/smart-contract/personalizing/images/1.png
   ```

Now token `1` is ready on the image side.

### 2.2 Sample metadata CSV

Metadata is read from:

```text
nodejs/smart-contract/personalizing/metadata/personalizations.csv
```

To set that up:

1. Create the `metadata` folder if it doesn’t exist:

   ```text
   nodejs/smart-contract/personalizing/metadata
   ```

2. Move/rename the example CSV:

   ```text
   nodejs/smart-contract/personalizing/personalizations.example.csv
   → nodejs/smart-contract/personalizing/metadata/personalizations.csv
   ```

3. Open `personalizations.csv` and add or update rows.

Format:

```csv
tokenId,title,href
1,Example Title,https://example.com
42,Another Square,https://example.com/42
```

* **First column**: `tokenId` (must match the NFT’s token ID, e.g., `1`, `42`, `10000`).
* **Second column**: `title` – short text that will show up as the personalization title.
* **Third column**: `href` – URL associated with this square.

The loader:

* Accepts an optional header row (`tokenId,title,href`).
* Requires every data row to have at least three comma-separated values.
* Requires each `tokenId` to be:

  * a positive integer
  * unique in the file (no duplicates)

If a token in your CSV is malformed or duplicated, the personalization scripts will fail before sending any transaction.

---

## 3. Validation rules (why scripts fail)

The personalization helper enforces a few constraints before touching the blockchain:

* **Metadata must exist for every token you’re personalizing**

  * If a token ID is missing in `personalizations.csv`, you’ll see:

    * `No metadata entry for token X …`
* **Images must exist for every token you’re personalizing**

  * If no supported image is found for a token ID, you’ll see:

    * `No image found for token X in ...personalizing/images/...`
* **Text length limits (UTF-8 bytes)**

  * `title` max: **64 bytes**
  * `href` max: **96 bytes**
  * If exceeded, you’ll see an error like:

    * `Title exceeds 64 bytes (...)`
    * `Href exceeds 96 bytes (...)`

For **batch** scripts:

* The entire batch is validated first.
* If **any** token in the batch is missing metadata, missing an image, or violates length limits, the script will throw and **no transaction will be sent**.
* In other words: if you try to batch personalize with missing or invalid data for *any* token, the batch will fail fast instead of partially minting.

---

## 4. Environment configuration

Personalization scripts read their settings from:

```text
nodejs/smart-contract/.env.contract
```

Start by copying the example:

```text
nodejs/smart-contract/.env.contract.example
→ nodejs/smart-contract/.env.contract
```

At minimum, for personalization-related scripts, pay attention to:

```env
# Personalization helpers
# Metadata lives under personalizing/metadata/personalizations.csv (tokenId,title,href)
# Images live under personalizing/images/<tokenId>.(svg|webp|png|jpg)
PERSONALIZE_TOKEN_ID=
PERSONALIZE_BATCH_TOKENS=1

# Token check helper (scripts/token-check.ts)
TOKEN_ID_CHECK=

# Balance helper (scripts/balance.ts)
OWNER_ADDRESS=
LIST_ALL=false
MAX_TOKENS_TO_LIST=200
```

### 4.1 Per-script env variables

* **Single-token personalization (primary or underlay)**
  Uses: `PERSONALIZE_TOKEN_ID`

  ```env
  PERSONALIZE_TOKEN_ID=1
  ```

* **Batch personalization (underlay batch and similar)**
  Uses: `PERSONALIZE_BATCH_TOKENS`

  Examples:

  ```env
  # Single token
  PERSONALIZE_BATCH_TOKENS=1

  # A range
  PERSONALIZE_BATCH_TOKENS=1-10

  # Ranges and individual IDs
  PERSONALIZE_BATCH_TOKENS=1-10,15,200-300
  ```

* **Token check helper**
  Uses: `TOKEN_ID_CHECK`

  ```env
  TOKEN_ID_CHECK=1
  ```

* **Balance helper**
  Uses: `OWNER_ADDRESS`, `LIST_ALL`, `MAX_TOKENS_TO_LIST`

  ```env
  OWNER_ADDRESS=0xYourWalletAddress
  LIST_ALL=false
  MAX_TOKENS_TO_LIST=200
  ```

If `OWNER_ADDRESS` is empty, the balance helper will fall back to:

* On **SuNet**: whichever key is configured in `sunet/.env.sunet`
* On other networks: Hardhat’s default signer

---

## 5. SuNet keys: validator vs. test account

On the local **SuNet** network, personalization scripts pick a signer from:

```text
nodejs/smart-contract/sunet/.env.sunet
```

The selection logic is:

1. If `TEST_ACCOUNT_PRIVATE_KEY` is set → use that.
2. Otherwise → fall back to `VALIDATOR_PRIVATE_KEY`.

That means:

* If you want to personalize from a **test account**, set `TEST_ACCOUNT_PRIVATE_KEY`.
* If you want to personalize from the **validator** account, omit the test key and rely on `VALIDATOR_PRIVATE_KEY`.

Whichever private key is selected must correspond to the address that **actually owns** the token you’re personalizing; otherwise the transaction will revert.

---

## 6. Checking ownership before personalizing

Before you run personalization, make sure the signer actually owns the token(s).

### 6.1 Check balance for an address

1. In `.env.contract`, set:

   ```env
   OWNER_ADDRESS=0xYourWalletAddress
   LIST_ALL=true
   # or bump MAX_TOKENS_TO_LIST if you prefer
   ```

2. Run the balance script (examples):

   ```bash
   # SuNet
   pnpm hardhat run scripts/balance.ts --network sunet

   # Sepolia
   pnpm hardhat run scripts/balance.ts --network sepolia
   ```

This will print:

* The address being inspected
* Its balance
* A compressed list of token IDs (e.g., `1-3,10,42-50`)

Confirm that the tokens you plan to personalize appear in that list.

### 6.2 Inspect a specific token

1. In `.env.contract`, set:

   ```env
   TOKEN_ID_CHECK=1
   ```

2. Run:

   ```bash
   # SuNet
   pnpm hardhat run scripts/token-check.ts --network sunet

   # Sepolia
   pnpm hardhat run scripts/token-check.ts --network sepolia
   ```

You’ll see:

* Which contract and network you’re hitting
* The current owner address
* Whether the token is personalized on primary and/or underlay
* The current title / href / RGB data status

If the owner address printed here does **not** match the signer you’re using, your personalization transaction will fail.

---

## 7. Running personalization scripts

All personalization scripts share the **same image + metadata pipeline** described above.

### 7.1 Single primary personalization

Environment:

```env
PERSONALIZE_TOKEN_ID=1
```

Command (example):

```bash
pnpm hardhat run scripts/personalizations/personalize-single-primary.ts --network sunet
# or --network sepolia
```

This will:

* Load `tokenId=1` from `personalizing/metadata/personalizations.csv`
* Load image `images/1.(svg|webp|png|jpg)`
* Validate title + href length
* Resize/encode image
* Call `SuMain.personalizeSquare(...)`
* Automatically send payment if the token is past the free personalization version

### 7.2 Single underlay personalization

Environment:

```env
PERSONALIZE_TOKEN_ID=1
```

Command (example):

```bash
pnpm hardhat run scripts/personalizations/personalize-single-underlay.ts --network sunet
# or --network sepolia
```

This will:

* Load the same metadata + image
* Call `SuSquaresUnderlay.personalizeSquareUnderlay(...)`
* Send the required `pricePerSquare` from the underlay contract

### 7.3 Batch underlay personalization

Environment (example):

```env
PERSONALIZE_BATCH_TOKENS=1-10,42,100-120
```

Command (example):

```bash
pnpm hardhat run scripts/personalizations/personalize-batch-underlay.ts --network sunet
# or --network sepolia
```

This will:

* Expand the range into a list of token IDs
* For each ID:

  * Check metadata exists
  * Check image exists
  * Validate title/href length
* If **any** token fails validation, the script throws and the transaction is **not** sent.
* Otherwise, it:

  * Computes the total price (`pricePerSquare × number of tokens`)
  * Calls `personalizeSquareUnderlayBatch(...)` with the full payload

If you try to batch personalize and **any** token is missing metadata, missing an image, or fails length validation, the script will fail fast and **nothing is written on-chain**.

---

## 8. Quick start checklist

1. **Copy env template**

   ```text
   nodejs/smart-contract/.env.contract.example
   → nodejs/smart-contract/.env.contract
   ```

   * Set `PERSONALIZE_TOKEN_ID` or `PERSONALIZE_BATCH_TOKENS`.
   * Set `TOKEN_ID_CHECK` when using `token-check`.
   * Optionally set `OWNER_ADDRESS` for `balance.ts`.

2. **Prepare images**

   * Place files under:

     ```text
     nodejs/smart-contract/personalizing/images
     ```
   * Name them `<tokenId>.svg|webp|png|jpg` (e.g., `1.png`).
   * If you like, start by copying `sample-square.png` into `images` and renaming it.

3. **Prepare metadata**

   * Create `metadata` folder if needed.
   * Move `personalizations.example.csv` to:

     ```text
     nodejs/smart-contract/personalizing/metadata/personalizations.csv
     ```
   * Edit rows: `tokenId,title,href`
   * Make sure every token you personalize has both a row in the CSV and a matching image.

4. **Confirm ownership**

   * Use `scripts/balance.ts` or `scripts/token-check.ts` to confirm:

     * The signer you’re using actually owns the token(s).
   * On SuNet, check whether `TEST_ACCOUNT_PRIVATE_KEY` or `VALIDATOR_PRIVATE_KEY` is being used in `sunet/.env.sunet`.

5. **Run personalization scripts**

   * Single primary: `personalize-single-primary.ts`
   * Single underlay: `personalize-single-underlay.ts`
   * Batch underlay: `personalize-batch-underlay.ts`

Once the folders, env vars, and ownership checks are in place, all the personalization scripts will share the same images + metadata pipeline and validation rules.
