# Builder workspace

One-time Node.js workspace to bundle browser-ready ESM files for:

* **wagmi + connectors + viem (and deps)** → `wagmi-bundle.js`
* **qr-creator** → `qr-creator-bundle.js`

Both bundles are intended to be served from the main site at:

* `assets/web3/vendor/`

Given the bundles are not intended to change frequently and the sizes are miniscule, the build process here does **not** automatically output them there. Add / update the files manually as needed from the local `/dist` folder here.

> **Why this exists:** This workspace is designed for long-lived, infrequently changing browser bundles. It avoids CDN dependency drift and ensures you only package exactly what the site needs.


---

## Prerequisites

* Node.js 20.x LTS (recommended minimum).
* `pnpm` installed globally (`npm i -g pnpm`) or use `npm` if you prefer.

---

## Install dependencies

From the repo root:

```sh
cd nodejs/builder
pnpm install
```

(If using npm instead of pnpm, run `npm install` here.)

---

## Build bundles

### Build wagmi bundle only

```sh
pnpm build-wagmi
```

Outputs:

* `nodejs/builder/dist/wagmi-bundle.js`
* `nodejs/builder/dist/wagmi-bundle.js.map`

### Build QR bundle only

```sh
pnpm build-qr
```

Outputs:

* `nodejs/builder/dist/qr-creator-bundle.js`
* `nodejs/builder/dist/qr-creator-bundle.js.map`

### Build both (recommended)

```sh
pnpm build-all
```

Runs `build-wagmi` and `build-qr` in sequence.

---

## Deploy into the site

From `nodejs/builder` after running the builds:

```sh
cp dist/wagmi-bundle.js dist/wagmi-bundle.js.map dist/qr-creator-bundle.js dist/qr-creator-bundle.js.map ../../assets/web3/vendor/
```

Resulting files in the repo:

```text
assets/web3/vendor/wagmi-bundle.js
assets/web3/vendor/wagmi-bundle.js.map
assets/web3/vendor/qr-creator-bundle.js
assets/web3/vendor/qr-creator-bundle.js.map
```

Then update (or confirm) site imports:

* wagmi client loader uses: `/assets/web3/vendor/wagmi-bundle.js`
* QR generator uses: `/assets/web3/vendor/qr-creator-bundle.js`

---

## Adding additional bundles

To vendor another browser library as a standalone ESM bundle (similar to wagmi or qr-creator), follow this pattern.

### 1. Add the dependency to `package.json`

From `nodejs/builder`:

```sh
pnpm add some-lib-name
# or, with npm:
# npm install some-lib-name --save
```

This updates `nodejs/builder/package.json` and the lockfile.

Alternatively, you can edit `nodejs/builder/package.json` directly to pin an exact version, then run `pnpm install` or `npm install` to sync the lockfile.

### 2. Create an entry file in `src/`

Create a new entry file that imports the library and re-exports what the browser needs:

```js
// nodejs/builder/src/some-lib-entry.js
import SomeLib from "some-lib-name";

export default SomeLib;
// or export specific APIs as needed:
// export { something, somethingElse } from "some-lib-name";
```

### 3. Add a build script to `package.json`

In `nodejs/builder/package.json`, add a new script that bundles this entry into `dist/`:

```json
{
  "scripts": {
    "build-wagmi": "esbuild src/wagmi-entry.js --bundle --format=esm --platform=browser --minify --sourcemap --outfile=dist/wagmi-bundle.js",
    "build-qr": "esbuild src/qr-entry.js --bundle --format=esm --platform=browser --minify --sourcemap --outfile=dist/qr-creator-bundle.js",
    "build-some-lib": "esbuild src/some-lib-entry.js --bundle --format=esm --platform=browser --minify --sourcemap --outfile=dist/some-lib-bundle.js",
    "build-all": "pnpm build-wagmi && pnpm build-qr && pnpm build-some-lib"
  }
}
```

If you prefer not to include the new bundle in `build-all`, you can keep `build-all` as-is and run `build-some-lib` manually.

### 4. Build and deploy the new bundle

Build the new bundle:

```sh
pnpm build-some-lib
```

Outputs:

* `nodejs/builder/dist/some-lib-bundle.js`
* `nodejs/builder/dist/some-lib-bundle.js.map`

Copy the new bundle into the site vendor directory:

```sh
cp dist/some-lib-bundle.js dist/some-lib-bundle.js.map ../../assets/web3/vendor/
```

Then update your site code to import or dynamically load `/assets/web3/vendor/some-lib-bundle.js` as needed.

---

## Notes

* Versions pinned in `nodejs/builder/package.json`:

  * `@wagmi/core` `1.4.13`
  * `@wagmi/connectors` `3.1.11`
  * `viem` `1.21.4`
  * `@noble/hashes` `1.3.3`
  * `@walletconnect/ethereum-provider` `2.10.0`
  * `qr-creator` `1.0.0`
* To expose more wagmi/viem APIs, add exports to `src/wagmi-entry.js` and rebuild.
* To change QR behavior, update `src/qr-entry.js` or the consumer module in `assets/web3/wallet/qr.js` and rebuild.
* You can swap `pnpm` for `npm` (use `npm run build-wagmi`, `npm run build-qr`, `npm run build-all`, `npm run build-some-lib`); the scripts themselves remain the same.
