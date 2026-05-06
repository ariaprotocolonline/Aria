import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

const ENV_PATH = path.resolve(__dirname, "../../.env");
dotenv.config({ path: ENV_PATH });

// Mint amounts: 10,000 USDY and 10 mETH to deployer
const USDY_MINT = ethers.parseUnits("10000", 18);
const METH_MINT = ethers.parseUnits("10", 18);

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

  // ── Deploy mock USDY ──────────────────────────────────────────────────────
  console.log("Deploying MockERC20 (USDY)...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");

  const usdy = await MockERC20.deploy("Ondo US Dollar Yield", "USDY");
  await usdy.waitForDeployment();
  const usdyAddress = await usdy.getAddress();
  console.log("  USDY deployed to:", usdyAddress);

  console.log("  Minting 10,000 USDY to deployer...");
  await (await usdy.mint(deployer.address, USDY_MINT)).wait();

  // Also mint to AGENT_ADDRESS if it's a different wallet (e.g. the user's MetaMask)
  const agentAddress = process.env.AGENT_ADDRESS;
  if (agentAddress && agentAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("  Minting 10,000 USDY to agent/user wallet...");
    await (await usdy.mint(agentAddress, USDY_MINT)).wait();
  }

  // ── Deploy mock mETH ──────────────────────────────────────────────────────
  console.log("\nDeploying MockERC20 (mETH)...");
  const meth = await MockERC20.deploy("Mantle Staked Ether", "mETH");
  await meth.waitForDeployment();
  const methAddress = await meth.getAddress();
  console.log("  mETH deployed to:", methAddress);

  console.log("  Minting 10 mETH to deployer...");
  await (await meth.mint(deployer.address, METH_MINT)).wait();

  if (agentAddress && agentAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("  Minting 10 mETH to agent/user wallet...");
    await (await meth.mint(agentAddress, METH_MINT)).wait();
  }

  // ── Patch ARIA/.env ───────────────────────────────────────────────────────
  console.log("\nPatching ARIA/.env...");
  patchEnv("VITE_USDY_ADDRESS_TESTNET", usdyAddress);
  patchEnv("VITE_METH_ADDRESS_TESTNET", methAddress);
  console.log("  VITE_USDY_ADDRESS_TESTNET =", usdyAddress);
  console.log("  VITE_METH_ADDRESS_TESTNET =", methAddress);

  // ── Save deployment receipt ───────────────────────────────────────────────
  const receipt = {
    network: network.name,
    chainId: network.chainId.toString(),
    USDY: usdyAddress,
    mETH: methAddress,
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
