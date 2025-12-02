import fs from 'fs-extra';
import chalk from 'chalk';
import { ethers } from 'ethers';
import { ensureBaseDirs, loadEnv, genesisPath, strip0x, to0x } from './utils';

function qbftExtraData(validators: string[]) {
  const vanity = new Uint8Array(32);
  const validatorsBytes = validators.map((v) => ethers.getBytes(ethers.getAddress(v)));
  
  // QBFT extra data format: [vanity, [validators], votes, round, seals]
  const votes: string[] = [];
  const round = new Uint8Array(0);
  const seals: string[] = [];
  
  return ethers.encodeRlp([vanity, validatorsBytes, votes, round, seals]);
}

export function generateGenesis() {
  loadEnv();
  ensureBaseDirs();

  const chainId = parseInt(process.env.LOCAL_CHAIN_ID || '1337', 10);
  const blockTime = parseInt(process.env.BLOCK_TIME || '5', 10);
  const genesisTimestamp = parseInt(process.env.GENESIS_TIMESTAMP || '0', 10);

  const validatorAddress = process.env.VALIDATOR_ADDRESS;
  if (!validatorAddress) {
    console.error(chalk.red('VALIDATOR_ADDRESS missing; run sunet:setup to create one.'));
    process.exit(1);
  }

  const validators = [validatorAddress];
  const extraData = qbftExtraData(validators);

  const alloc: Record<string, { balance: string }> = {};
  const validatorBalance = '10000000000000000000000'; // 10,000 ETH
  alloc[to0x(strip0x(validatorAddress).toLowerCase())] = { balance: validatorBalance };

  const testAccount = process.env.TEST_ACCOUNT;
  const testBalance = process.env.TEST_ACCOUNT_BALANCE || validatorBalance;
  if (testAccount) {
    alloc[to0x(strip0x(testAccount).toLowerCase())] = { balance: testBalance };
  }

  const requestTimeout = Math.max(blockTime * 3, 10);

  // Pre-merge genesis for QBFT consensus (no terminalTotalDifficulty, no shanghaiTime/cancunTime)
  // This lets QBFT drive block production without needing an external consensus client
  const genesis = {
    config: {
      chainId,
      homesteadBlock: 0,
      eip150Block: 0,
      eip155Block: 0,
      eip158Block: 0,
      byzantiumBlock: 0,
      constantinopleBlock: 0,
      petersburgBlock: 0,
      istanbulBlock: 0,
      berlinBlock: 0,
      londonBlock: 0,
      zeroBaseFee: true,
      qbft: {
        blockperiodseconds: blockTime,
        epochlength: 30000,
        requesttimeoutseconds: requestTimeout,
        blockreward: '0x0',
        miningbeneficiary: validatorAddress
      }
    },
    nonce: '0x0',
    timestamp: `0x${genesisTimestamp.toString(16)}`,
    gasLimit: '0x1c9c380',
    difficulty: '0x1',
    mixHash: '0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365',
    coinbase: '0x0000000000000000000000000000000000000000',
    alloc,
    extraData
  };

  fs.writeFileSync(genesisPath, JSON.stringify(genesis, null, 2));
  console.log(chalk.green('✓ Generated genesis.json'));
  console.log(chalk.gray(`  Chain ID: ${chainId}`));
  console.log(chalk.gray(`  Validator: ${validatorAddress}`));
  console.log(chalk.gray(`  Block time: ${blockTime}s`));
}

if (require.main === module) {
  generateGenesis();
}