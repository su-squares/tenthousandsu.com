import chalk from "chalk";
import { deployPrimary } from "./deploy-primary";
import { deployUnderlay } from "./deploy-underlay";

async function main(): Promise<void> {
  console.log(chalk.blueBright("Starting full deployment (primary + underlay)..."));
  const primary = await deployPrimary();
  await deployUnderlay({ primaryAddress: primary.address });
  console.log(chalk.green("Full deployment completed."));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
