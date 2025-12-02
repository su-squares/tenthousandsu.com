import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { Wallet } from 'ethers';
import { envPath, loadEnv, strip0x, to0x, configDir } from './utils';

function revealAddress() {
  loadEnv();
  const envAddress = process.env.VALIDATOR_ADDRESS;

  if (envAddress) {
    console.log(chalk.green(`Validator address (from .env): ${envAddress}`));
    return;
  }

  const keyPath = path.join(configDir, 'keys', 'validator.key');
  if (!fs.existsSync(keyPath)) {
    console.error(chalk.red('No validator key found. Run sunet:setup first.'));
    process.exit(1);
  }

  const pk = fs.readFileSync(keyPath, 'utf8').trim();
  const wallet = new Wallet(to0x(strip0x(pk)));
  console.log(chalk.green(`Validator address (from key file): ${wallet.address}`));
  console.log(chalk.yellow('Consider adding this to .env as VALIDATOR_ADDRESS.'));
}

if (require.main === module) {
  revealAddress();
}
