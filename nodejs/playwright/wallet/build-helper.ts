// dapp/e2e/playwright/wallet/build-helper.ts
import fs from 'fs';
import path from 'path';
import { build } from 'esbuild';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Ensure the injected bundle exists and is up-to-date.
 * - builds if missing or if source is newer than output.
 * - writes to a tmp file then renames for atomicity.
 */
export async function ensureInjectedBuilt() {
  const src = path.join(__dirname, 'injected', 'provider.ts');
  const out = path.join(__dirname, 'injected', 'provider.js');

  // quick cheap check: if out exists and is newer than src, skip build
  try {
    const sSrc = fs.statSync(src);
    const sOut = fs.statSync(out);
    if (sOut.mtimeMs >= sSrc.mtimeMs) return;
  } catch {
    // either file missing or stat failed -> build
  }

  const tmpOut = out + `.tmp.${Date.now()}`;
  try {
    await build({
      entryPoints: [src],
      bundle: true,
      outfile: tmpOut,
      platform: 'browser',
      target: 'es2019',
      format: 'iife',
      sourcemap: true,
      minify: false,
    });

    // atomically replace
    fs.renameSync(tmpOut, out);
    // keep maps if produced: esbuild will produce tmp + .map; rename .map too if exists
    const tmpMap = tmpOut + '.map';
    const outMap = out + '.map';
    if (fs.existsSync(tmpMap)) {
      fs.renameSync(tmpMap, outMap);
    }
  } catch (err) {
    // cleanup tmp if present
    try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch {}
    try { const tmpMap = tmpOut + '.map'; if (fs.existsSync(tmpMap)) fs.unlinkSync(tmpMap); } catch {}
    throw err;
  }
}
