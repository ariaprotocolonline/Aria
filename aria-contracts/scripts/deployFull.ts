import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const WETH_MINT = ethers.parseUnits("10", 18);
const USDC_MINT = ethers.parseUnits("10000", 6);

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

  // ── 1. Deploy MockERC20 (WETH) ─────────────────────────────────────────────
  console.log("[1/4] Deploying MockERC20 (WETH)...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const weth = await MockERC20.deploy("Wrapped Ether", "WETH");
  await weth.waitForDeployment();
  const wethAddress = await weth.getAddress();
  console.log("      WETH:", wethAddress);

  await (await weth.mint(deployer.address, WETH_MINT)).wait();
  if (agentAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    await (await weth.mint(agentAddress, WETH_MINT)).wait();
  }

  // ── 2. Deploy MockERC20 (USDC) ─────────────────────────────────────────────
  console.log("[2/4] Deploying MockERC20 (USDC)...");
  const usdc = await MockERC20.deploy("USD Coin", "USDC");
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("      USDC:", usdcAddress);

  await (await usdc.mint(deployer.address, USDC_MINT)).wait();
  if (agentAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    await (await usdc.mint(agentAddress, USDC_MINT)).wait();
  }

  // ── 3. Deploy ARIAVault ────────────────────────────────────────────────────
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

  // ── Patch ARIA/.env ───────────────────────────────────────────────────────
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
  patchEnv("VAULT_ADDRESS", vaultAddress);
  patchEnv("VITE_VAULT_ADDRESS_TESTNET", vaultAddress);
  patchEnv("VITE_WETH_ADDRESS_TESTNET", wethAddress);
  patchEnv("VITE_USDC_ADDRESS_TESTNET", usdcAddress);
  patchEnv("VITE_FACTORY_ADDRESS_TESTNET", factoryAddress);
  patchEnv("FACTORY_ADDRESS", factoryAddress);

  // ── Save deployment JSON ───────────────────────────────────────────────────
  const deployment = {
    network: network.name,
    chainId: network.chainId.toString(),
    WETH: wethAddress,
    USDC: usdcAddress,
    ARIAVault: vaultAddress,
    ARIAVaultFactory: factoryAddress,
    deployer: deployer.address,
    agent: agentAddress,
    feeRecipient,
    deployedAt: new Date().toISOString(),
  };
  const outPath = path.join(__dirname, "../full-deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  console.log("  Deployed — ARIA/.env auto-patched:");
  console.log("═══════════════════════════════════════════");
  console.log(`WETH:               ${wethAddress}`);
  console.log(`USDC:               ${usdcAddress}`);
  console.log(`ARIAVault:          ${vaultAddress}`);
  console.log(`ARIAVaultFactory:   ${factoryAddress}`);
  console.log("═══════════════════════════════════════════\n");
  console.log("Deployment saved to full-deployment.json");
  console.log("Restart the Vite dev server to pick up new addresses.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
