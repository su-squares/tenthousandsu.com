import path from 'path';
import fs from 'fs-extra';
import dotenv from 'dotenv';
import chalk from 'chalk';

export const sunetRoot = path.join(__dirname, '..');
export const envPath = path.join(sunetRoot, '.env');
export const configDir = path.join(sunetRoot, 'config');
export const dataDir = path.join(sunetRoot, 'data');
export const keysDir = path.join(configDir, 'keys');
export const genesisPath = path.join(configDir, 'genesis.json');

export function loadEnv() {
  // override true lets us pick up values written earlier in the same run
  dotenv.config({ path: envPath, override: true });
}

export function ensureBaseDirs() {
  fs.ensureDirSync(configDir);
  fs.ensureDirSync(dataDir);
  fs.ensureDirSync(keysDir);
}

export function ensureEnvFile() {
  if (!fs.existsSync(envPath)) {
    const examplePath = path.join(sunetRoot, '.env.example');
    if (!fs.existsSync(examplePath)) {
      console.error(chalk.red('Missing .env.example; cannot bootstrap .env'));
      process.exit(1);
    }
    fs.copyFileSync(examplePath, envPath);
    console.log(chalk.yellow('Created .env from .env.example'));
  }
}

export function to0x(value: string) {
  return value.startsWith('0x') ? value : `0x${value}`;
}

export function strip0x(value: string) {
  return value.replace(/^0x/i, '');
}

export function posixPath(p: string) {
  return p.replace(/\\/g, '/');
}
