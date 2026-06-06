import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // deployMainnet.ts writes to mainnet-deployment.json; fall back to the
  // testnet output (deployments.json) for testnet verification runs.
  const mainnetPath = path.join(__dirname, "../mainnet-deployment.json");
  const testnetPath = path.join(__dirname, "../deployments.json");
  const deploymentsPath = fs.existsSync(mainnetPath) ? mainnetPath : testnetPath;

  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(
      "No deployment file found. Run the deploy script first:\n" +
      "  Mainnet: npx hardhat run scripts/deployMainnet.ts --network mantleMainnet\n" +
      "  Testnet: npx hardhat run scripts/deploy.ts --network mantleTestnet"
    );
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8")) as {
    ARIAVault: string;
    deployer: string;
    agent: string;
    feeRecipient: string;
    network: string;
    chainId: string;
  };

  const { ARIAVault: address, deployer, agent, feeRecipient } = deployment;

  console.log("─────────────────────────────────────────");
  console.log("Verifying ARIAVault");
  console.log("─────────────────────────────────────────");
  console.log("Address:       ", address);
  console.log("Network:       ", deployment.network, `(chainId ${deployment.chainId})`);
  console.log("Fee recipient: ", feeRecipient);
  console.log();

  await run("verify:verify", {
    address,
    constructorArguments: [deployer, agent, feeRecipient],
  });

  console.log("\nVerification complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
