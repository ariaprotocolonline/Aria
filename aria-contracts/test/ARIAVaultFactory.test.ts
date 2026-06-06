import { expect } from "chai";
import { ethers } from "hardhat";
import { ARIAVaultFactory, ARIAVault } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ARIAVaultFactory", function () {
  let factory: ARIAVaultFactory;
  let owner: HardhatEthersSigner;
  let agent: HardhatEthersSigner;
  let feeRecipient: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, agent, feeRecipient, user1, user2] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("ARIAVaultFactory");
    factory = await Factory.deploy(agent.address, feeRecipient.address);
    await factory.waitForDeployment();
  });

  // ─── Deployment ─────────────────────────────────────────────────────────────

  describe("Deployment", () => {
    it("sets defaultAgent and feeRecipient", async () => {
      expect(await factory.defaultAgent()).to.equal(agent.address);
      expect(await factory.feeRecipient()).to.equal(feeRecipient.address);
    });

    it("starts with zero vaults", async () => {
      expect(await factory.totalVaults()).to.equal(0n);
    });

    it("reverts if defaultAgent is zero address", async () => {
      const Factory = await ethers.getContractFactory("ARIAVaultFactory");
      await expect(
        Factory.deploy(ethers.ZeroAddress, feeRecipient.address)
      ).to.be.revertedWith("ARIAVaultFactory: zero agent");
    });
  });

  // ─── createVault() ───────────────────────────────────────────────────────────

  describe("createVault()", () => {
    it("deploys a vault and records it", async () => {
      await expect(factory.connect(user1).createVault())
        .to.emit(factory, "VaultCreated")
        .withArgs(user1.address, (v: string) => ethers.isAddress(v));

      expect(await factory.hasVault(user1.address)).to.be.true;
      expect(await factory.totalVaults()).to.equal(1n);
    });

    it("returns the vault address from createVault", async () => {
      const tx = await factory.connect(user1).createVault();
      const receipt = await tx.wait();
      const vaultAddr = await factory.getVault(user1.address);
      expect(ethers.isAddress(vaultAddr)).to.be.true;
      expect(vaultAddr).to.not.equal(ethers.ZeroAddress);
      expect(receipt).to.not.be.null;
    });

    it("sets msg.sender as vault owner", async () => {
      await factory.connect(user1).createVault();
      const vaultAddr = await factory.getVault(user1.address);
      const vault = await ethers.getContractAt("ARIAVault", vaultAddr) as ARIAVault;
      expect(await vault.owner()).to.equal(user1.address);
    });

    it("sets defaultAgent as vault agent", async () => {
      await factory.connect(user1).createVault();
      const vaultAddr = await factory.getVault(user1.address);
      const vault = await ethers.getContractAt("ARIAVault", vaultAddr) as ARIAVault;
      expect(await vault.agent()).to.equal(agent.address);
    });

    it("sets feeRecipient on the vault", async () => {
      await factory.connect(user1).createVault();
      const vaultAddr = await factory.getVault(user1.address);
      const vault = await ethers.getContractAt("ARIAVault", vaultAddr) as ARIAVault;
      expect(await vault.feeRecipient()).to.equal(feeRecipient.address);
    });

    it("reverts if caller already has a vault", async () => {
      await factory.connect(user1).createVault();
      await expect(
        factory.connect(user1).createVault()
      ).to.be.revertedWith("Vault already exists");
    });

    it("allows multiple users to each create their own vault", async () => {
      await factory.connect(user1).createVault();
      await factory.connect(user2).createVault();

      expect(await factory.hasVault(user1.address)).to.be.true;
      expect(await factory.hasVault(user2.address)).to.be.true;
      expect(await factory.totalVaults()).to.equal(2n);

      const vault1 = await factory.getVault(user1.address);
      const vault2 = await factory.getVault(user2.address);
      expect(vault1).to.not.equal(vault2);
    });
  });

  // ─── getVault() / hasVault() ─────────────────────────────────────────────────

  describe("getVault() / hasVault()", () => {
    it("returns zero address for a user without a vault", async () => {
      expect(await factory.getVault(user1.address)).to.equal(ethers.ZeroAddress);
    });

    it("returns false for hasVault before creation", async () => {
      expect(await factory.hasVault(user1.address)).to.be.false;
    });

    it("getVault matches the address emitted in VaultCreated", async () => {
      const tx = await factory.connect(user1).createVault();
      const receipt = await tx.wait();
      const log = receipt?.logs
        .map(l => { try { return factory.interface.parseLog(l); } catch { return null; } })
        .find(e => e?.name === "VaultCreated");

      const emittedVault = log?.args[1] as string;
      expect(await factory.getVault(user1.address)).to.equal(emittedVault);
    });
  });

  // ─── totalVaults() ───────────────────────────────────────────────────────────

  describe("totalVaults()", () => {
    it("increments with each new vault", async () => {
      expect(await factory.totalVaults()).to.equal(0n);
      await factory.connect(user1).createVault();
      expect(await factory.totalVaults()).to.equal(1n);
      await factory.connect(user2).createVault();
      expect(await factory.totalVaults()).to.equal(2n);
    });
  });
});
