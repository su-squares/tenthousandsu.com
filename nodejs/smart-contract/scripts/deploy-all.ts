import { deployPrimary } from "./deploy-primary";
import { deployUnderlay } from "./deploy-underlay";

async function main(): Promise<void> {
  const primary = await deployPrimary();
  await deployUnderlay({ primaryAddress: primary.address });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
