import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const USDY_MINT = ethers.parseUnits("10000", 18);
const METH_MINT = ethers.parseUnits("10", 18);

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);

  const agentAddress = process.env.AGENT_ADDRESS;
  if (!agentAddress) throw new Error("AGENT_ADDRESS is not set in .env");

  const feeRecipient = process.env.FEE_RECIPIENT_ADDRESS ?? deployer.address;

  console.log("═══════════════════════════════════════════");
  console.log("  ARIA Full Deployment (Mocks + Vault + Factory)");
  console.log("═══════════════════════════════════════════");
  console.log("Network:       ", network.name, `(chainId ${network.chainId})`);
  console.log("Deployer:      ", deployer.address);
  console.log("Agent:         ", agentAddress);
  console.log("Fee recipient: ", feeRecipient);
  console.log("Balance:       ", ethers.formatEther(balance), "MNT\n");

  if (balance === 0n) {
    throw new Error(
      "Deployer wallet has 0 MNT. Fund it at https://faucet.testnet.mantle.xyz"
    );
  }

  // ── 1. Deploy MockERC20 (USDY) ─────────────────────────────────────────────
  console.log("[1/3] Deploying MockERC20 (USDY)...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const usdy = await MockERC20.deploy("Ondo US Dollar Yield", "USDY");
  await usdy.waitForDeployment();
  const usdyAddress = await usdy.getAddress();
  console.log("      USDY:", usdyAddress);

  await (await usdy.mint(deployer.address, USDY_MINT)).wait();
  if (agentAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    await (await usdy.mint(agentAddress, USDY_MINT)).wait();
  }

  // ── 2. Deploy MockERC20 (mETH) ─────────────────────────────────────────────
  console.log("[2/3] Deploying MockERC20 (mETH)...");
  const meth = await MockERC20.deploy("Mantle Staked Ether", "mETH");
  await meth.waitForDeployment();
  const methAddress = await meth.getAddress();
  console.log("      mETH:", methAddress);

  await (await meth.mint(deployer.address, METH_MINT)).wait();
  if (agentAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    await (await meth.mint(agentAddress, METH_MINT)).wait();
  }

  // ── 3. Deploy ARIAVault (deployer's own vault) ────────────────────────────
  console.log("[3/4] Deploying ARIAVault...");
  const ARIAVault = await ethers.getContractFactory("ARIAVault");
  const vault = await ARIAVault.deploy(deployer.address, agentAddress, feeRecipient);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("      ARIAVault:", vaultAddress);

  // ── 4. Deploy ARIAVaultFactory ────────────────────────────────────────────
  console.log("[4/4] Deploying ARIAVaultFactory...");
  const ARIAVaultFactory = await ethers.getContractFactory("ARIAVaultFactory");
  const factory = await ARIAVaultFactory.deploy(agentAddress, feeRecipient);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("      ARIAVaultFactory:", factoryAddress);

  // ── Save deployment JSON ───────────────────────────────────────────────────
  const deployment = {
    network: network.name,
    chainId: network.chainId.toString(),
    USDY: usdyAddress,
    mETH: methAddress,
    ARIAVault: vaultAddress,
    ARIAVaultFactory: factoryAddress,
    deployer: deployer.address,
    agent: agentAddress,
    feeRecipient,
    deployedAt: new Date().toISOString(),
  };
  const outPath = path.join(__dirname, "../full-deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));

  // ── Print paste-ready .env block ───────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  console.log("  Paste into ARIA/.env:");
  console.log("═══════════════════════════════════════════");
  console.log(`VAULT_ADDRESS=${vaultAddress}`);
  console.log(`VITE_VAULT_ADDRESS_TESTNET=${vaultAddress}`);
  console.log(`VITE_USDY_ADDRESS_TESTNET=${usdyAddress}`);
  console.log(`VITE_METH_ADDRESS_TESTNET=${methAddress}`);
  console.log(`VITE_FACTORY_ADDRESS_TESTNET=${factoryAddress}`);
  console.log(`FACTORY_ADDRESS=${factoryAddress}`);
  console.log("═══════════════════════════════════════════\n");
  console.log("Deployment saved to full-deployment.json");
  console.log("Restart the Vite dev server to pick up new addresses.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
