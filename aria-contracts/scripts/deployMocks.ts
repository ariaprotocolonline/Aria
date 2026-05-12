import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

const ENV_PATH = path.resolve(__dirname, "../../.env");
dotenv.config({ path: ENV_PATH });

// Mint amounts: 10 WETH and 10,000 USDC to deployer
const WETH_MINT = ethers.parseUnits("10", 18);
const USDC_MINT = ethers.parseUnits("10000", 6);

function patchEnv(key: string, value: string) {
  let content = fs.readFileSync(ENV_PATH, "utf8");
  const regex = new RegExp(`^(${key}=).*`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `$1${value}`);
  } else {
    content += `\n${key}=${value}`;
  }
  fs.writeFileSync(ENV_PATH, content);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("─────────────────────────────────────────");
  console.log("Deploying Mock Tokens (USDY + mETH)");
  console.log("─────────────────────────────────────────");
  console.log("Network:  ", network.name, `(chainId ${network.chainId})`);
  console.log("Deployer: ", deployer.address);
  console.log("Balance:  ", ethers.formatEther(balance), "MNT");
  console.log();

  if (balance === 0n) {
    throw new Error(
      "Deployer wallet has 0 MNT. Fund it at https://faucet.testnet.mantle.xyz before deploying."
    );
  }

  // ── Deploy mock WETH ──────────────────────────────────────────────────────
  console.log("Deploying MockERC20 (WETH)...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");

  const weth = await MockERC20.deploy("Wrapped Ether", "WETH");
  await weth.waitForDeployment();
  const wethAddress = await weth.getAddress();
  console.log("  WETH deployed to:", wethAddress);

  console.log("  Minting 10 WETH to deployer...");
  await (await weth.mint(deployer.address, WETH_MINT)).wait();

  const agentAddress = process.env.AGENT_ADDRESS;
  if (agentAddress && agentAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("  Minting 10 WETH to agent/user wallet...");
    await (await weth.mint(agentAddress, WETH_MINT)).wait();
  }

  // ── Deploy mock USDC ──────────────────────────────────────────────────────
  console.log("\nDeploying MockERC20 (USDC)...");
  const usdc = await MockERC20.deploy("USD Coin", "USDC");
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("  USDC deployed to:", usdcAddress);

  console.log("  Minting 10,000 USDC to deployer...");
  await (await usdc.mint(deployer.address, USDC_MINT)).wait();

  if (agentAddress && agentAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("  Minting 10,000 USDC to agent/user wallet...");
    await (await usdc.mint(agentAddress, USDC_MINT)).wait();
  }

  // ── Patch ARIA/.env ───────────────────────────────────────────────────────
  console.log("\nPatching ARIA/.env...");
  patchEnv("VITE_WETH_ADDRESS_TESTNET", wethAddress);
  patchEnv("VITE_USDC_ADDRESS_TESTNET", usdcAddress);
  console.log("  VITE_WETH_ADDRESS_TESTNET =", wethAddress);
  console.log("  VITE_USDC_ADDRESS_TESTNET =", usdcAddress);

  // ── Save deployment receipt ───────────────────────────────────────────────
  const receipt = {
    network: network.name,
    chainId: network.chainId.toString(),
    WETH: wethAddress,
    USDC: usdcAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  const outPath = path.join(__dirname, "../mocks-deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(receipt, null, 2));

  console.log("\n─────────────────────────────────────────");
  console.log("Done! Restart the Vite dev server to pick up the new addresses.");
  console.log("─────────────────────────────────────────");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
