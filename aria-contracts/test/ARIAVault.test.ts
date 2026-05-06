import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { ARIAVault, MockERC20, MockProtocol } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const E18 = (n: number) => ethers.parseEther(String(n));
const YEAR = 365 * 24 * 3600;

describe("ARIAVault", function () {
  let vault: ARIAVault;
  let usdy: MockERC20;
  let meth: MockERC20;
  let mockProtocol: MockProtocol;

  let owner: HardhatEthersSigner;
  let agent: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;
  let feeRecipient: HardhatEthersSigner;

  let vaultAddr: string;
  let usdyAddr: string;
  let methAddr: string;
  let mockProtocolAddr: string;

  beforeEach(async () => {
    [owner, agent, stranger, feeRecipient] = await ethers.getSigners();

    // Deploy tokens
    const ERC20 = await ethers.getContractFactory("MockERC20");
    usdy = await ERC20.deploy("USDY", "USDY");
    meth = await ERC20.deploy("mETH", "mETH");
    usdyAddr = await usdy.getAddress();
    methAddr = await meth.getAddress();

    // Deploy mock protocol
    const Protocol = await ethers.getContractFactory("MockProtocol");
    mockProtocol = await Protocol.deploy();
    mockProtocolAddr = await mockProtocol.getAddress();

    // Deploy vault (with fee recipient)
    const Vault = await ethers.getContractFactory("ARIAVault");
    vault = await Vault.deploy(owner.address, agent.address, feeRecipient.address);
    vaultAddr = await vault.getAddress();

    // Mint tokens to owner for deposits
    await usdy.mint(owner.address, E18(10_000));
    await meth.mint(owner.address, E18(10_000));

    // Fund the mock protocol so it can pay out tokenOut on swaps
    await meth.mint(mockProtocolAddr, E18(10_000));
    await usdy.mint(mockProtocolAddr, E18(10_000));
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Approve vault and deposit `amount` of USDY as owner. */
  async function depositUsdy(amount = E18(100)) {
    await usdy.connect(owner).approve(vaultAddr, amount);
    return vault.connect(owner).deposit(usdyAddr, amount);
  }

  /** Build the calldata for MockProtocol.swap() targeted at vaultAddr. */
  function buildSwapData(tIn: string, tOut: string, amount: bigint) {
    return mockProtocol.interface.encodeFunctionData("swap", [
      tIn,
      tOut,
      amount,
      vaultAddr,
    ]);
  }

  // ─── Deployment ─────────────────────────────────────────────────────────────

  describe("Deployment", () => {
    it("sets owner, agent, and feeRecipient", async () => {
      expect(await vault.owner()).to.equal(owner.address);
      expect(await vault.agent()).to.equal(agent.address);
      expect(await vault.feeRecipient()).to.equal(feeRecipient.address);
    });

    it("sets default fee parameters", async () => {
      expect(await vault.performanceFeeBps()).to.equal(1000n);
      expect(await vault.managementFeeBps()).to.equal(50n);
    });

    it("reverts if agent address is zero", async () => {
      const Vault = await ethers.getContractFactory("ARIAVault");
      await expect(
        Vault.deploy(owner.address, ethers.ZeroAddress, feeRecipient.address)
      ).to.be.revertedWith("ARIAVault: zero agent");
    });

    it("emits AgentUpdated on construction", async () => {
      const Vault = await ethers.getContractFactory("ARIAVault");
      const deployed = await Vault.deploy(owner.address, agent.address, feeRecipient.address);
      const receipt = await deployed.deploymentTransaction()?.wait();

      const event = receipt?.logs
        .map((log) => {
          try { return deployed.interface.parseLog(log); } catch { return null; }
        })
        .find((e) => e?.name === "AgentUpdated");

      expect(event).to.not.be.undefined;
      expect(event?.args[0]).to.equal(ethers.ZeroAddress);
      expect(event?.args[1]).to.equal(agent.address);
    });

    it("emits FeeRecipientUpdated on construction", async () => {
      const Vault = await ethers.getContractFactory("ARIAVault");
      const deployed = await Vault.deploy(owner.address, agent.address, feeRecipient.address);
      const receipt = await deployed.deploymentTransaction()?.wait();

      const event = receipt?.logs
        .map((log) => {
          try { return deployed.interface.parseLog(log); } catch { return null; }
        })
        .find((e) => e?.name === "FeeRecipientUpdated");

      expect(event).to.not.be.undefined;
      expect(event?.args[0]).to.equal(feeRecipient.address);
    });
  });

  // ─── deposit() ──────────────────────────────────────────────────────────────

  describe("deposit()", () => {
    it("allows the owner to deposit tokens", async () => {
      await expect(depositUsdy(E18(100)))
        .to.emit(vault, "Deposited")
        .withArgs(usdyAddr, E18(100));

      expect(await vault.getBalance(usdyAddr)).to.equal(E18(100));
      expect(await vault.balances(usdyAddr)).to.equal(E18(100));
    });

    it("increases internal balance on each deposit", async () => {
      await depositUsdy(E18(100));
      await depositUsdy(E18(50));
      expect(await vault.balances(usdyAddr)).to.equal(E18(150));
    });

    it("rejects deposit from non-owner", async () => {
      await usdy.mint(stranger.address, E18(100));
      await usdy.connect(stranger).approve(vaultAddr, E18(100));
      await expect(
        vault.connect(stranger).deposit(usdyAddr, E18(100))
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("rejects zero amount", async () => {
      await expect(
        vault.connect(owner).deposit(usdyAddr, 0)
      ).to.be.revertedWith("ARIAVault: zero amount");
    });

    it("reverts if owner did not approve the vault", async () => {
      await expect(
        vault.connect(owner).deposit(usdyAddr, E18(100))
      ).to.be.reverted;
    });
  });

  // ─── withdraw() ─────────────────────────────────────────────────────────────

  describe("withdraw()", () => {
    beforeEach(() => depositUsdy(E18(100)));

    it("allows the owner to withdraw deposited tokens", async () => {
      const before = await usdy.balanceOf(owner.address);
      await expect(vault.connect(owner).withdraw(usdyAddr, E18(100)))
        .to.emit(vault, "Withdrawn")
        .withArgs(usdyAddr, E18(100));

      expect(await usdy.balanceOf(owner.address)).to.equal(before + E18(100));
      expect(await vault.getBalance(usdyAddr)).to.equal(0n);
    });

    it("allows partial withdrawal", async () => {
      await vault.connect(owner).withdraw(usdyAddr, E18(40));
      expect(await vault.getBalance(usdyAddr)).to.equal(E18(60));
    });

    it("rejects withdrawal exceeding vault balance", async () => {
      await expect(
        vault.connect(owner).withdraw(usdyAddr, E18(200))
      ).to.be.revertedWith("ARIAVault: insufficient balance");
    });

    it("rejects withdrawal from non-owner", async () => {
      await expect(
        vault.connect(stranger).withdraw(usdyAddr, E18(100))
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("allows withdrawal even when the vault is paused", async () => {
      await vault.connect(owner).pause();
      await expect(vault.connect(owner).withdraw(usdyAddr, E18(100)))
        .to.emit(vault, "Withdrawn")
        .withArgs(usdyAddr, E18(100));
    });
  });

  // ─── reallocate() ───────────────────────────────────────────────────────────

  describe("reallocate()", () => {
    const AMOUNT = E18(100);

    beforeEach(async () => {
      await depositUsdy(AMOUNT);
      await vault.connect(owner).addApprovedProtocol(mockProtocolAddr);
    });

    it("allows the agent to reallocate to an approved protocol", async () => {
      const data = buildSwapData(usdyAddr, methAddr, AMOUNT);

      await expect(
        vault
          .connect(agent)
          .reallocate(usdyAddr, methAddr, mockProtocolAddr, AMOUNT, 0n, 0n, data)
      )
        .to.emit(vault, "Reallocated")
        .withArgs(usdyAddr, methAddr, mockProtocolAddr, AMOUNT, AMOUNT);

      expect(await vault.getBalance(usdyAddr)).to.equal(0n);
      expect(await vault.getBalance(methAddr)).to.equal(AMOUNT);
    });

    it("updates internal balances correctly after reallocate", async () => {
      const data = buildSwapData(usdyAddr, methAddr, AMOUNT);
      await vault
        .connect(agent)
        .reallocate(usdyAddr, methAddr, mockProtocolAddr, AMOUNT, 0n, 0n, data);

      expect(await vault.balances(usdyAddr)).to.equal(0n);
      expect(await vault.balances(methAddr)).to.equal(AMOUNT);
    });

    it("rejects reallocation to an unapproved address", async () => {
      const data = buildSwapData(usdyAddr, methAddr, AMOUNT);
      await expect(
        vault
          .connect(agent)
          .reallocate(usdyAddr, methAddr, stranger.address, AMOUNT, 0n, 0n, data)
      ).to.be.revertedWith("ARIAVault: not approved protocol");
    });

    it("rejects reallocation from the owner (not agent)", async () => {
      const data = buildSwapData(usdyAddr, methAddr, AMOUNT);
      await expect(
        vault
          .connect(owner)
          .reallocate(usdyAddr, methAddr, mockProtocolAddr, AMOUNT, 0n, 0n, data)
      ).to.be.revertedWith("ARIAVault: not agent");
    });

    it("rejects reallocation from a stranger", async () => {
      const data = buildSwapData(usdyAddr, methAddr, AMOUNT);
      await expect(
        vault
          .connect(stranger)
          .reallocate(usdyAddr, methAddr, mockProtocolAddr, AMOUNT, 0n, 0n, data)
      ).to.be.revertedWith("ARIAVault: not agent");
    });

    it("rejects reallocation when vault has insufficient tokenIn balance", async () => {
      const data = buildSwapData(usdyAddr, methAddr, E18(200));
      await expect(
        vault
          .connect(agent)
          .reallocate(usdyAddr, methAddr, mockProtocolAddr, E18(200), 0n, 0n, data)
      ).to.be.revertedWith("ARIAVault: insufficient tokenIn");
    });

    it("revokes approval from the protocol after the call", async () => {
      const data = buildSwapData(usdyAddr, methAddr, AMOUNT);
      await vault
        .connect(agent)
        .reallocate(usdyAddr, methAddr, mockProtocolAddr, AMOUNT, 0n, 0n, data);

      const allowance = await usdy.allowance(vaultAddr, mockProtocolAddr);
      expect(allowance).to.equal(0n);
    });
  });

  // ─── pause() / unpause() ────────────────────────────────────────────────────

  describe("pause()", () => {
    it("allows the owner to pause and unpause", async () => {
      await expect(vault.connect(owner).pause()).to.emit(vault, "Paused");
      expect(await vault.paused()).to.be.true;

      await expect(vault.connect(owner).unpause()).to.emit(vault, "Unpaused");
      expect(await vault.paused()).to.be.false;
    });

    it("blocks deposit when paused", async () => {
      await vault.connect(owner).pause();
      await usdy.connect(owner).approve(vaultAddr, E18(100));
      await expect(
        vault.connect(owner).deposit(usdyAddr, E18(100))
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("blocks reallocate when paused", async () => {
      await depositUsdy(E18(100));
      await vault.connect(owner).addApprovedProtocol(mockProtocolAddr);
      await vault.connect(owner).pause();

      const data = buildSwapData(usdyAddr, methAddr, E18(100));
      await expect(
        vault
          .connect(agent)
          .reallocate(usdyAddr, methAddr, mockProtocolAddr, E18(100), 0n, 0n, data)
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("rejects pause from non-owner", async () => {
      await expect(
        vault.connect(stranger).pause()
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("rejects unpause from non-owner", async () => {
      await vault.connect(owner).pause();
      await expect(
        vault.connect(stranger).unpause()
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });

  // ─── Owner-only configuration ────────────────────────────────────────────────

  describe("setAgent()", () => {
    it("allows the owner to update the agent", async () => {
      await expect(vault.connect(owner).setAgent(stranger.address))
        .to.emit(vault, "AgentUpdated")
        .withArgs(agent.address, stranger.address);

      expect(await vault.agent()).to.equal(stranger.address);
    });

    it("rejects setAgent from non-owner", async () => {
      await expect(
        vault.connect(stranger).setAgent(stranger.address)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("rejects zero address as new agent", async () => {
      await expect(
        vault.connect(owner).setAgent(ethers.ZeroAddress)
      ).to.be.revertedWith("ARIAVault: zero agent");
    });
  });

  describe("addApprovedProtocol() / removeApprovedProtocol()", () => {
    it("allows the owner to add a protocol", async () => {
      await expect(vault.connect(owner).addApprovedProtocol(mockProtocolAddr))
        .to.emit(vault, "ProtocolAdded")
        .withArgs(mockProtocolAddr);

      expect(await vault.approvedProtocols(mockProtocolAddr)).to.be.true;
    });

    it("rejects adding the same protocol twice", async () => {
      await vault.connect(owner).addApprovedProtocol(mockProtocolAddr);
      await expect(
        vault.connect(owner).addApprovedProtocol(mockProtocolAddr)
      ).to.be.revertedWith("ARIAVault: already approved");
    });

    it("allows the owner to remove an approved protocol", async () => {
      await vault.connect(owner).addApprovedProtocol(mockProtocolAddr);
      await expect(
        vault.connect(owner).removeApprovedProtocol(mockProtocolAddr)
      )
        .to.emit(vault, "ProtocolRemoved")
        .withArgs(mockProtocolAddr);

      expect(await vault.approvedProtocols(mockProtocolAddr)).to.be.false;
    });

    it("rejects removing a protocol that is not approved", async () => {
      await expect(
        vault.connect(owner).removeApprovedProtocol(mockProtocolAddr)
      ).to.be.revertedWith("ARIAVault: not approved");
    });

    it("rejects addApprovedProtocol from non-owner", async () => {
      await expect(
        vault.connect(stranger).addApprovedProtocol(mockProtocolAddr)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("rejects removeApprovedProtocol from non-owner", async () => {
      await vault.connect(owner).addApprovedProtocol(mockProtocolAddr);
      await expect(
        vault.connect(stranger).removeApprovedProtocol(mockProtocolAddr)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });

  // ─── renounceOwnership() ────────────────────────────────────────────────────

  describe("renounceOwnership()", () => {
    it("reverts — ownership cannot be renounced", async () => {
      await expect(
        vault.connect(owner).renounceOwnership()
      ).to.be.revertedWith("ARIAVault: ownership cannot be renounced");
    });
  });

  // ─── getBalance() ────────────────────────────────────────────────────────────

  describe("getBalance()", () => {
    it("returns 0 for a token that has never been deposited", async () => {
      expect(await vault.getBalance(usdyAddr)).to.equal(0n);
    });

    it("reflects the actual on-chain ERC20 balance", async () => {
      await depositUsdy(E18(500));
      expect(await vault.getBalance(usdyAddr)).to.equal(E18(500));
    });
  });

  // ─── Fee Mechanism ───────────────────────────────────────────────────────────

  describe("Fee Mechanism", () => {

    // ── Management fee ────────────────────────────────────────────────────────

    describe("Management fee", () => {
      it("accrues correctly over 1 year on withdraw", async () => {
        await depositUsdy(E18(100));
        await time.increase(YEAR);

        const recipientBefore = await usdy.balanceOf(feeRecipient.address);
        // Withdraw 50 — leaves ample room so balance check passes after fee accrual
        await vault.connect(owner).withdraw(usdyAddr, E18(50));
        const recipientAfter = await usdy.balanceOf(feeRecipient.address);

        // Expected fee: 100 USDY × 0.5% × 1 year = 0.5 USDY
        const charged = recipientAfter - recipientBefore;
        const expected = E18(100) * 50n / 10_000n; // 0.5e18
        const tolerance = E18(1) / 100n;            // 0.01 USDY
        expect(charged).to.be.gte(expected - tolerance);
        expect(charged).to.be.lte(expected + tolerance);
      });

      it("accrues correctly over 1 year on reallocate", async () => {
        await depositUsdy(E18(200));
        await vault.connect(owner).addApprovedProtocol(mockProtocolAddr);
        await time.increase(YEAR);

        const recipientBefore = await usdy.balanceOf(feeRecipient.address);
        // Reallocate 100 — leaves 100 USDY buffer to cover the ~1 USDY management fee
        const data = buildSwapData(usdyAddr, methAddr, E18(100));
        await vault
          .connect(agent)
          .reallocate(usdyAddr, methAddr, mockProtocolAddr, E18(100), 0n, 0n, data);
        const recipientAfter = await usdy.balanceOf(feeRecipient.address);

        // Expected fee: 200 USDY × 0.5% × 1 year = 1 USDY
        const charged = recipientAfter - recipientBefore;
        const expected = E18(200) * 50n / 10_000n; // 1e18
        const tolerance = E18(1) / 100n;
        expect(charged).to.be.gte(expected - tolerance);
        expect(charged).to.be.lte(expected + tolerance);
      });

      it("emits ManagementFeeCharged with correct recipient", async () => {
        await depositUsdy(E18(100));
        await time.increase(YEAR);

        await expect(vault.connect(owner).withdraw(usdyAddr, E18(50)))
          .to.emit(vault, "ManagementFeeCharged")
          .withArgs(usdyAddr, anyValue, feeRecipient.address);
      });

      it("is zero when feeRecipient is zero address", async () => {
        await vault.connect(owner).setFeeRecipient(ethers.ZeroAddress);
        await depositUsdy(E18(100));
        await time.increase(YEAR);

        const recipientBefore = await usdy.balanceOf(feeRecipient.address);
        // Can withdraw full balance since no fee is taken
        await vault.connect(owner).withdraw(usdyAddr, E18(100));
        const recipientAfter = await usdy.balanceOf(feeRecipient.address);

        expect(recipientAfter).to.equal(recipientBefore); // no fee charged
      });

      it("is zero when managementFeeBps is 0", async () => {
        await vault.connect(owner).setManagementFeeBps(0);
        await depositUsdy(E18(100));
        await time.increase(YEAR);

        const recipientBefore = await usdy.balanceOf(feeRecipient.address);
        await vault.connect(owner).withdraw(usdyAddr, E18(100));
        const recipientAfter = await usdy.balanceOf(feeRecipient.address);

        expect(recipientAfter).to.equal(recipientBefore);
      });

      it("does not charge within the minimum fee interval (< 1 hour)", async () => {
        await depositUsdy(E18(100));
        // Advance only 30 minutes — below MIN_FEE_INTERVAL of 1 hour
        await time.increase(30 * 60);

        const recipientBefore = await usdy.balanceOf(feeRecipient.address);
        await vault.connect(owner).withdraw(usdyAddr, E18(100));
        const recipientAfter = await usdy.balanceOf(feeRecipient.address);

        expect(recipientAfter).to.equal(recipientBefore);
      });
    });

    // ── Performance fee ───────────────────────────────────────────────────────

    describe("Performance fee", () => {
      const AMOUNT = E18(100);
      const expectedApyBps = 500n;  // 5%
      const newApyBps      = 800n;  // 8%

      // Precompute expected fee:
      // yieldDelta = 100e18 * (800-500) / 10000 = 3e18
      // perfFee    = 3e18 * 1000 / 10000 = 0.3e18
      const yieldDelta = AMOUNT * (newApyBps - expectedApyBps) / 10_000n;
      const perfFee    = yieldDelta * 1000n / 10_000n; // 1000 = default performanceFeeBps
      const netAmount  = AMOUNT - perfFee;

      beforeEach(async () => {
        await depositUsdy(AMOUNT);
        await vault.connect(owner).addApprovedProtocol(mockProtocolAddr);
      });

      it("charges fee when newApyBps > expectedApyBps", async () => {
        const data = buildSwapData(usdyAddr, methAddr, netAmount);
        const recipientBefore = await usdy.balanceOf(feeRecipient.address);

        await vault
          .connect(agent)
          .reallocate(usdyAddr, methAddr, mockProtocolAddr, AMOUNT, expectedApyBps, newApyBps, data);

        const recipientAfter = await usdy.balanceOf(feeRecipient.address);
        expect(recipientAfter - recipientBefore).to.equal(perfFee);
      });

      it("fee recipient receives exactly the computed performance fee", async () => {
        const data = buildSwapData(usdyAddr, methAddr, netAmount);
        const recipientBefore = await usdy.balanceOf(feeRecipient.address);

        await vault
          .connect(agent)
          .reallocate(usdyAddr, methAddr, mockProtocolAddr, AMOUNT, expectedApyBps, newApyBps, data);

        expect(await usdy.balanceOf(feeRecipient.address) - recipientBefore).to.equal(perfFee);
        // Protocol received net amount and sent back netAmount of mETH
        expect(await vault.getBalance(methAddr)).to.equal(netAmount);
        expect(await vault.getBalance(usdyAddr)).to.equal(0n);
      });

      it("emits PerformanceFeeCharged event", async () => {
        const data = buildSwapData(usdyAddr, methAddr, netAmount);

        await expect(
          vault
            .connect(agent)
            .reallocate(usdyAddr, methAddr, mockProtocolAddr, AMOUNT, expectedApyBps, newApyBps, data)
        )
          .to.emit(vault, "PerformanceFeeCharged")
          .withArgs(usdyAddr, perfFee, feeRecipient.address);
      });

      it("Reallocated event uses netAmount (after performance fee)", async () => {
        const data = buildSwapData(usdyAddr, methAddr, netAmount);

        await expect(
          vault
            .connect(agent)
            .reallocate(usdyAddr, methAddr, mockProtocolAddr, AMOUNT, expectedApyBps, newApyBps, data)
        )
          .to.emit(vault, "Reallocated")
          .withArgs(usdyAddr, methAddr, mockProtocolAddr, netAmount, netAmount);
      });

      it("is zero when newApyBps <= expectedApyBps", async () => {
        const data = buildSwapData(usdyAddr, methAddr, AMOUNT);
        const recipientBefore = await usdy.balanceOf(feeRecipient.address);

        // same APY → no fee
        await vault
          .connect(agent)
          .reallocate(usdyAddr, methAddr, mockProtocolAddr, AMOUNT, 800n, 800n, data);

        const recipientAfter = await usdy.balanceOf(feeRecipient.address);
        expect(recipientAfter).to.equal(recipientBefore);
      });

      it("is zero when feeRecipient is zero address", async () => {
        await vault.connect(owner).setFeeRecipient(ethers.ZeroAddress);
        const data = buildSwapData(usdyAddr, methAddr, AMOUNT);
        const recipientBefore = await usdy.balanceOf(feeRecipient.address);

        // Even with positive APY delta, no fee when feeRecipient is zero
        await vault
          .connect(agent)
          .reallocate(usdyAddr, methAddr, mockProtocolAddr, AMOUNT, expectedApyBps, newApyBps, data);

        expect(await usdy.balanceOf(feeRecipient.address)).to.equal(recipientBefore);
        expect(await vault.getBalance(methAddr)).to.equal(AMOUNT); // full amount swapped
      });

      it("is zero when performanceFeeBps is 0", async () => {
        await vault.connect(owner).setPerformanceFeeBps(0);
        const data = buildSwapData(usdyAddr, methAddr, AMOUNT);
        const recipientBefore = await usdy.balanceOf(feeRecipient.address);

        await vault
          .connect(agent)
          .reallocate(usdyAddr, methAddr, mockProtocolAddr, AMOUNT, expectedApyBps, newApyBps, data);

        expect(await usdy.balanceOf(feeRecipient.address)).to.equal(recipientBefore);
      });
    });

    // ── Fee parameter setters ─────────────────────────────────────────────────

    describe("setFeeRecipient()", () => {
      it("allows the owner to update the fee recipient", async () => {
        await expect(vault.connect(owner).setFeeRecipient(stranger.address))
          .to.emit(vault, "FeeRecipientUpdated")
          .withArgs(stranger.address);

        expect(await vault.feeRecipient()).to.equal(stranger.address);
      });

      it("allows setting feeRecipient to zero (disables fees)", async () => {
        await vault.connect(owner).setFeeRecipient(ethers.ZeroAddress);
        expect(await vault.feeRecipient()).to.equal(ethers.ZeroAddress);
      });

      it("rejects setFeeRecipient from non-owner", async () => {
        await expect(
          vault.connect(stranger).setFeeRecipient(stranger.address)
        ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
      });
    });

    describe("setPerformanceFeeBps()", () => {
      it("allows the owner to update the performance fee", async () => {
        await expect(vault.connect(owner).setPerformanceFeeBps(500))
          .to.emit(vault, "PerformanceFeeBpsUpdated")
          .withArgs(500n);

        expect(await vault.performanceFeeBps()).to.equal(500n);
      });

      it("allows setting performance fee to 0", async () => {
        await vault.connect(owner).setPerformanceFeeBps(0);
        expect(await vault.performanceFeeBps()).to.equal(0n);
      });

      it("allows setting performance fee to the hard cap (2000)", async () => {
        await vault.connect(owner).setPerformanceFeeBps(2000);
        expect(await vault.performanceFeeBps()).to.equal(2000n);
      });

      it("rejects performance fee above 2000 bps (hard cap)", async () => {
        await expect(
          vault.connect(owner).setPerformanceFeeBps(2001)
        ).to.be.revertedWith("ARIAVault: performance fee exceeds cap");
      });

      it("rejects setPerformanceFeeBps from non-owner", async () => {
        await expect(
          vault.connect(stranger).setPerformanceFeeBps(500)
        ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
      });
    });

    describe("setManagementFeeBps()", () => {
      it("allows the owner to update the management fee", async () => {
        await expect(vault.connect(owner).setManagementFeeBps(100))
          .to.emit(vault, "ManagementFeeBpsUpdated")
          .withArgs(100n);

        expect(await vault.managementFeeBps()).to.equal(100n);
      });

      it("allows setting management fee to 0", async () => {
        await vault.connect(owner).setManagementFeeBps(0);
        expect(await vault.managementFeeBps()).to.equal(0n);
      });

      it("allows setting management fee to the hard cap (200)", async () => {
        await vault.connect(owner).setManagementFeeBps(200);
        expect(await vault.managementFeeBps()).to.equal(200n);
      });

      it("rejects management fee above 200 bps (hard cap)", async () => {
        await expect(
          vault.connect(owner).setManagementFeeBps(201)
        ).to.be.revertedWith("ARIAVault: management fee exceeds cap");
      });

      it("rejects setManagementFeeBps from non-owner", async () => {
        await expect(
          vault.connect(stranger).setManagementFeeBps(100)
        ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
      });
    });
  });
});
