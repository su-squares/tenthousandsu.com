import chalk from "chalk";
import { network } from "hardhat";
import {
  readDeployment,
  verifyContractIfPossible,
} from "@script-utils/deployments";
import {
  loadContractPricingEnv,
  loadSunetEnv,
  resolveTokenUriBase,
} from "@script-utils/env";

function safeResolveTokenUriBase(networkName: string): string | null {
  try {
    return resolveTokenUriBase(networkName);
  } catch (error) {
    console.warn(
      `Token URI base is missing for ${networkName}. Set TOKEN_URI_BASE_${networkName.toUpperCase()} or TOKEN_URI_BASE in nodejs/smart-contract/.env.contract.`,
    );
    return null;
  }
}

function safeLoadPricing() {
  try {
    return loadContractPricingEnv();
  } catch (error) {
    console.warn(
      `Pricing env is missing or invalid in nodejs/smart-contract/.env.contract. ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

async function main(): Promise<void> {
  const networkName = network.name;
  const primary = readDeployment("primary", networkName);
  const underlay = readDeployment("underlay", networkName);
  const sunetEnv = networkName === "sunet" ? loadSunetEnv({ required: false }) : null;

  if (!primary && !underlay) {
    console.warn(`No deployment records found for ${networkName}.`);
    return;
  }

  const pricing = safeLoadPricing();
  const tokenUriBase = safeResolveTokenUriBase(networkName);

  if (primary && pricing && tokenUriBase) {
    console.log(chalk.cyan(`Verifying SuMain on ${networkName}...`));
    await verifyContractIfPossible({
      contractName: "SuMain",
      address: primary.address,
      constructorArguments: [
        tokenUriBase,
        pricing.salePriceWei,
        pricing.promoCreationLimit,
        pricing.personalizationPriceWei,
      ],
      networkName,
      explorerHint: networkName === "sunet" ? sunetEnv?.blockscoutBrowserUrl : undefined,
      isBlockscout: networkName === "sunet",
    });
  } else if (primary) {
    console.warn(`Skipping SuMain verification on ${networkName} (missing pricing or tokenUriBase).`);
  }

  if (underlay && pricing) {
    const primaryAddress = underlay.primaryAddress || primary?.address;
    if (!primaryAddress) {
      console.warn(`Skipping underlay verification on ${networkName} (missing primary address).`);
      return;
    }

    console.log(chalk.cyan(`Verifying SuSquaresUnderlay on ${networkName}...`));
    await verifyContractIfPossible({
      contractName: "SuSquaresUnderlay",
      address: underlay.address,
      constructorArguments: [primaryAddress, pricing.underlayPersonalizationPriceWei],
      networkName,
      explorerHint: networkName === "sunet" ? sunetEnv?.blockscoutBrowserUrl : undefined,
      isBlockscout: networkName === "sunet",
    });
  } else if (underlay) {
    console.warn(`Skipping underlay verification on ${networkName} (missing pricing).`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    // Verification should not fail the overall command.
    process.exit(0);
  });
}
