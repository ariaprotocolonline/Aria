import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  const agentAddress = process.env.AGENT_ADDRESS;
  if (!agentAddress) throw new Error("AGENT_ADDRESS is not set in .env");

  const feeRecipient = process.env.FEE_RECIPIENT_ADDRESS;
  if (!feeRecipient) throw new Error("FEE_RECIPIENT_ADDRESS is not set in .env");

  const ZERO = "0x0000000000000000000000000000000000000000";
  if (feeRecipient !== ZERO && feeRecipient.toLowerCase() === agentAddress.toLowerCase()) {
    throw new Error(
      "FEE_RECIPIENT_ADDRESS must not equal AGENT_ADDRESS.\n" +
      "Use a separate cold-storage treasury wallet for fee collection."
    );
  }

  console.log("─────────────────────────────────────────");
  console.log("Deploying ARIAVault");
  console.log("─────────────────────────────────────────");
  console.log("Network:       ", network.name, `(chainId ${network.chainId})`);
  console.log("Deployer:      ", deployer.address);
  console.log("Agent:         ", agentAddress);
  console.log("Fee recipient: ", feeRecipient);
  console.log();

  const ARIAVault = await ethers.getContractFactory("ARIAVault");
  const vault = await ARIAVault.deploy(deployer.address, agentAddress, feeRecipient);

  console.log("Waiting for deployment confirmation...");
  await vault.waitForDeployment();

  const contractAddress = await vault.getAddress();
  console.log("\nARIAVault deployed to:", contractAddress);

  const deployment = {
    network: network.name,
    chainId: network.chainId.toString(),
    ARIAVault: contractAddress,
    deployer: deployer.address,
    agent: agentAddress,
    feeRecipient,
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, "../deployments.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log("Deployment info saved to: deployments.json");
  console.log("\nTo verify on-chain:");
  console.log("  npm run verify:testnet   (or verify:mainnet)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
