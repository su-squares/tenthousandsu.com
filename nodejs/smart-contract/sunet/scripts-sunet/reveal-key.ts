import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { loadEnv, strip0x, to0x, configDir } from './utils';

function revealKey() {
  loadEnv();
  const envKey = process.env.VALIDATOR_PRIVATE_KEY;
  if (envKey) {
    console.log(chalk.yellow('⚠️  Development key - do not use on public networks.'));
    console.log(chalk.green(`Private key (from .env): ${to0x(strip0x(envKey))}`));
    return;
  }

  const keyPath = path.join(configDir, 'keys', 'validator.key');
  if (!fs.existsSync(keyPath)) {
    console.error(chalk.red('No validator key found. Run sunet:setup first.'));
    process.exit(1);
  }

  const fileKey = fs.readFileSync(keyPath, 'utf8').trim();
  console.log(chalk.yellow('⚠️  Development key - do not use on public networks.'));
  console.log(chalk.green(`Private key (from key file): ${to0x(strip0x(fileKey))}`));
}

if (require.main === module) {
  revealKey();
}
