import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { Wallet } from 'ethers';
import {
  configDir,
  dataDir,
  ensureBaseDirs,
  ensureEnvFile,
  envPath,
  loadEnv,
  strip0x,
  sunetRoot,
  to0x
} from './utils';
import { generateGenesis } from './generate-genesis';

const validatorKeyPath = path.join(configDir, 'keys', 'validator.key');

function updateEnvValue(key: string, value: string) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split(/\r?\n/);
  let found = false;
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) {
    next.push(`${key}=${value}`);
  }
  fs.writeFileSync(envPath, next.join('\n'));
}

function ensureValidatorKey() {
  const hasKeyFile = fs.existsSync(validatorKeyPath);
  loadEnv();
  let pk = process.env.VALIDATOR_PRIVATE_KEY;

  if (!hasKeyFile && !pk) {
    console.log(chalk.gray('Generating validator key...'));
    const wallet = Wallet.createRandom();
    pk = wallet.privateKey;
    fs.writeFileSync(validatorKeyPath, strip0x(pk), { mode: 0o600 });
    updateEnvValue('VALIDATOR_PRIVATE_KEY', pk);
    updateEnvValue('VALIDATOR_ADDRESS', wallet.address);
    process.env.VALIDATOR_PRIVATE_KEY = pk;
    process.env.VALIDATOR_ADDRESS = wallet.address;
    console.log(chalk.green(`✓ Created validator ${wallet.address}`));
  }

  if (!hasKeyFile && pk) {
    fs.writeFileSync(validatorKeyPath, strip0x(pk), { mode: 0o600 });
    process.env.VALIDATOR_PRIVATE_KEY = pk;
    console.log(chalk.green('✓ Wrote validator key from .env to config/keys/validator.key'));
  }

  if (hasKeyFile && !pk) {
    const fileKey = fs.readFileSync(validatorKeyPath, 'utf8').trim();
    const wallet = new Wallet(to0x(fileKey));
    updateEnvValue('VALIDATOR_PRIVATE_KEY', wallet.privateKey);
    updateEnvValue('VALIDATOR_ADDRESS', wallet.address);
    process.env.VALIDATOR_PRIVATE_KEY = wallet.privateKey;
    process.env.VALIDATOR_ADDRESS = wallet.address;
    console.log(chalk.green(`✓ Synced validator from key file: ${wallet.address}`));
  }
}

function cloneBlockscoutIfMissing() {
  const blockscoutDir = path.join(sunetRoot, 'blockscout');
  if (fs.existsSync(blockscoutDir)) {
    console.log(chalk.gray('Blockscout repo already present.'));
    return;
  }

  const tag = process.env.BLOCKSCOUT_TAG || 'v9.2.2';
  console.log(chalk.gray(`Cloning Blockscout (${tag})...`));
  execSync(
    `git clone --branch ${tag} --depth 1 https://github.com/blockscout/blockscout.git blockscout`,
    { cwd: sunetRoot, stdio: 'inherit' }
  );
}

function initGenesis() {
  // Besu initializes the data directory automatically on first start when
  // provided a genesis file, so no explicit init command is required.
  const besuDataDir = path.join(dataDir, 'besu');
  fs.ensureDirSync(besuDataDir);
}

async function init() {
  console.log(chalk.blue('🚀 Setting up SuNet (Besu QBFT)...'));
  ensureEnvFile();
  loadEnv();
  ensureBaseDirs();
  ensureValidatorKey();
  loadEnv(); // refresh env with any updates we just wrote

  generateGenesis();
  initGenesis();
  cloneBlockscoutIfMissing();

  console.log(chalk.green('\n✅ SuNet setup complete.'));
  console.log(chalk.cyan('\nNext steps:'));
  console.log(chalk.white('  pnpm run sunet:start:node      # start Besu only'));
  console.log(chalk.white('  pnpm run sunet:start           # start Besu + Blockscout'));
  console.log(chalk.white('  pnpm run sunet:logs            # tail logs'));
}

init().catch((err) => {
  console.error(chalk.red('Setup failed:'), err);
  process.exit(1);
});
