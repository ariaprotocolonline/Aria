import { run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const deploymentsPath = path.join(__dirname, "../deployments.json");

  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(
      "deployments.json not found — run the deploy script first:\n  npm run deploy:testnet"
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
