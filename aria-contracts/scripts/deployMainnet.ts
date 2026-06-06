import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);

  if (network.chainId !== 5000n) {
    throw new Error(`Expected Mantle Mainnet (5000), got chainId ${network.chainId}. Run with --network mantleMainnet`);
  }

  const agentAddress = process.env.AGENT_ADDRESS;
  if (!agentAddress) throw new Error("AGENT_ADDRESS is not set in .env");

  const feeRecipient = process.env.FEE_RECIPIENT_ADDRESS;
  if (!feeRecipient) throw new Error("FEE_RECIPIENT_ADDRESS is not set in .env");

  const ZERO = "0x0000000000000000000000000000000000000000";
  if (feeRecipient !== ZERO && feeRecipient.toLowerCase() === agentAddress.toLowerCase()) {
    throw new Error(
      "FEE_RECIPIENT_ADDRESS must not equal AGENT_ADDRESS.\n" +
      "The agent is a hot wallet — fees sent there are exposed if the key is compromised.\n" +
      "Use a separate cold-storage treasury wallet for FEE_RECIPIENT_ADDRESS."
    );
  }

  if (balance === 0n) {
    throw new Error("Deployer wallet has 0 MNT. Fund it before deploying to mainnet.");
  }

  console.log("═══════════════════════════════════════════");
  console.log("  ARIA Mainnet Deployment (Vault + Factory)");
  console.log("═══════════════════════════════════════════");
  console.log("Network:       ", network.name, `(chainId ${network.chainId})`);
  console.log("Deployer:      ", deployer.address);
  console.log("Agent:         ", agentAddress);
  console.log("Fee recipient: ", feeRecipient);
  console.log("Balance:       ", ethers.formatEther(balance), "MNT\n");

  console.log("[1/2] Deploying ARIAVault...");
  const ARIAVault = await ethers.getContractFactory("ARIAVault");
  const vault = await ARIAVault.deploy(deployer.address, agentAddress, feeRecipient);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("      ARIAVault:", vaultAddress);

  console.log("[2/2] Deploying ARIAVaultFactory...");
  const ARIAVaultFactory = await ethers.getContractFactory("ARIAVaultFactory");
  const factory = await ARIAVaultFactory.deploy(agentAddress, feeRecipient);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("      ARIAVaultFactory:", factoryAddress);

  const envPath = path.resolve(__dirname, "../../.env");
  function patchEnv(key: string, value: string) {
    let content = fs.readFileSync(envPath, "utf8");
    const regex = new RegExp(`^(${key}=).*`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `$1${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
    fs.writeFileSync(envPath, content);
  }

  patchEnv("VAULT_ADDRESS",               vaultAddress);
  patchEnv("VITE_VAULT_ADDRESS_MAINNET",  vaultAddress);
  patchEnv("FACTORY_ADDRESS",             factoryAddress);
  patchEnv("VITE_FACTORY_ADDRESS_MAINNET", factoryAddress);
  patchEnv("MANTLE_NETWORK",              "mainnet");
  patchEnv("MANTLE_MAINNET_RPC",           "https://rpc.mantle.xyz");

  const deployment = {
    network:         network.name,
    chainId:         network.chainId.toString(),
    ARIAVault:       vaultAddress,
    ARIAVaultFactory: factoryAddress,
    deployer:        deployer.address,
    agent:           agentAddress,
    feeRecipient,
    deployedAt:      new Date().toISOString(),
  };
  const outPath = path.join(__dirname, "../mainnet-deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));

  console.log("\n═══════════════════════════════════════════");
  console.log("  Deployed — ARIA/.env auto-patched:");
  console.log("═══════════════════════════════════════════");
  console.log(`ARIAVault:        ${vaultAddress}`);
  console.log(`ARIAVaultFactory: ${factoryAddress}`);
  console.log("═══════════════════════════════════════════\n");
  console.log("Deployment saved to mainnet-deployment.json");
  console.log("Next: rebuild aria-dashboard and aria-agent, then restart PM2.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
