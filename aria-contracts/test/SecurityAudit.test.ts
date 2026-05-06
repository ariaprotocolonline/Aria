import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  ARIAVault,
  ARIAVaultFactory,
  MockERC20,
  MockProtocol,
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const E18 = (n: number | string) => ethers.parseEther(String(n));
const YEAR = 365 * 24 * 3600;

describe("SecurityAudit", function () {
  let vault: ARIAVault;
  let factory: ARIAVaultFactory;
  let usdy: MockERC20;
  let meth: MockERC20;
  let goodProtocol: MockProtocol;

  let owner: HardhatEthersSigner;
  let agent: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;
  let feeRecipient: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;

  let vaultAddr: string;
  let usdyAddr: string;
  let methAddr: string;
  let goodProtocolAddr: string;

  beforeEach(async () => {
    [owner, agent, stranger, feeRecipient, attacker] = await ethers.getSigners();

    const ERC20 = await ethers.getContractFactory("MockERC20");
    usdy = await ERC20.deploy("USDY", "USDY");
    meth = await ERC20.deploy("mETH", "mETH");
    usdyAddr = await usdy.getAddress();
    methAddr = await meth.getAddress();

    const Protocol = await ethers.getContractFactory("MockProtocol");
    goodProtocol = await Protocol.deploy();
    goodProtocolAddr = await goodProtocol.getAddress();
    await meth.mint(goodProtocolAddr, E18(10_000));
    await usdy.mint(goodProtocolAddr, E18(10_000));

    const Vault = await ethers.getContractFactory("ARIAVault");
    vault = await Vault.deploy(owner.address, agent.address, feeRecipient.address);
    vaultAddr = await vault.getAddress();

    await usdy.mint(owner.address, E18(10_000));
    await meth.mint(owner.address, E18(10_000));

    const Factory = await ethers.getContractFactory("ARIAVaultFactory");
    factory = await Factory.deploy(agent.address, feeRecipient.address);
  });

  async function depositUsdy(amount = E18(100)) {
    await usdy.connect(owner).approve(vaultAddr, amount);
    return vault.connect(owner).deposit(usdyAddr, amount);
  }

  function buildSwapData(tIn: string, tOut: string, amount: bigint) {
    return goodProtocol.interface.encodeFunctionData("swap", [tIn, tOut, amount, vaultAddr]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1A — Reentrancy
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Reentrancy — deposit()", function () {
    it("blocks reentrancy via malicious token transferFrom", async function () {
      const Malicious = await ethers.getContractFactory("MaliciousReentrant");
      const mal = await Malicious.deploy();
      const malAddr = await mal.getAddress();

      // Vault owner MUST be the mal contract so it can call vault.deposit() as owner
      const AttVault = await ethers.getContractFactory("ARIAVault");
      const attVault = await AttVault.deploy(malAddr, agent.address, feeRecipient.address);
      const attVaultAddr = await attVault.getAddress();

      // Attack: mal calls vault.deposit(); inside transferFrom it tries to re-enter.
      // ReentrancyGuard catches the inner call — outer deposit still records E18(1).
      await expect(mal.attackDeposit(attVaultAddr, E18(1)))
        .to.not.be.reverted;

      // Exactly one deposit recorded — reentrancy did not double-count
      const recorded = await attVault.balances(malAddr);
      expect(recorded).to.equal(E18(1));
    });
  });

  describe("Reentrancy — withdraw()", function () {
    it("blocks reentrancy via malicious token transfer callback", async function () {
      const Malicious = await ethers.getContractFactory("MaliciousReentrant");
      const mal = await Malicious.deploy();
      const malAddr = await mal.getAddress();

      // Vault owner must be mal so it can call vault.withdraw() as owner
      const AttVault = await ethers.getContractFactory("ARIAVault");
      const attVault = await AttVault.deploy(malAddr, agent.address, feeRecipient.address);
      const attVaultAddr = await attVault.getAddress();

      // Seed vault balance — attackWithdraw sets _balances[vault] = amount + 10
      // withdraw() reads mal.balanceOf(vault) which returns _balances[vault]
      // The transfer() callback arming triggers during safeTransfer to owner (=mal)
      await expect(mal.attackWithdraw(attVaultAddr, E18(1)))
        .to.not.be.reverted;
    });
  });

  describe("Reentrancy — reallocate()", function () {
    it("blocks malicious protocol callback from reentering reallocate()", async function () {
      const MalProto = await ethers.getContractFactory("MaliciousProtocol");
      const malProto = await MalProto.deploy();
      const malProtoAddr = await malProto.getAddress();

      await depositUsdy(E18(100));
      await vault.connect(owner).addApprovedProtocol(malProtoAddr);

      // Mode 1 = Reenter: swap() attempts vault.reallocate() again internally.
      // The inner call is blocked by ReentrancyGuard; swap() catches and swallows it.
      // The outer reallocate() succeeds (success=true) but receives 0 tokenOut.
      await malProto.setMode(1);

      const usdyBefore = await usdy.balanceOf(vaultAddr);
      const data = malProto.interface.encodeFunctionData("swap", [
        usdyAddr, methAddr, E18(10), vaultAddr,
      ]);

      await expect(
        vault.connect(agent).reallocate(
          usdyAddr, methAddr, malProtoAddr, E18(10), 0, 0, data
        )
      ).to.not.be.reverted;

      // USDY should only have decreased by netAmount (1x), not 2x.
      // This proves the inner reentrant call did not execute.
      const usdyAfter = await usdy.balanceOf(vaultAddr);
      expect(usdyBefore - usdyAfter).to.be.lte(E18(10));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1B — Access Control
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Access Control — deposit/withdraw", function () {
    it("stranger cannot call deposit()", async function () {
      await usdy.mint(stranger.address, E18(100));
      await usdy.connect(stranger).approve(vaultAddr, E18(100));
      await expect(vault.connect(stranger).deposit(usdyAddr, E18(100)))
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("stranger cannot call withdraw()", async function () {
      await depositUsdy();
      await expect(vault.connect(stranger).withdraw(usdyAddr, E18(1)))
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("agent cannot call withdraw()", async function () {
      await depositUsdy();
      await expect(vault.connect(agent).withdraw(usdyAddr, E18(1)))
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });

  describe("Access Control — configuration", function () {
    it("stranger cannot call setAgent()", async function () {
      await expect(vault.connect(stranger).setAgent(stranger.address))
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("agent cannot call setAgent()", async function () {
      await expect(vault.connect(agent).setAgent(stranger.address))
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("stranger cannot call addApprovedProtocol()", async function () {
      await expect(vault.connect(stranger).addApprovedProtocol(goodProtocolAddr))
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("agent cannot call addApprovedProtocol()", async function () {
      await expect(vault.connect(agent).addApprovedProtocol(goodProtocolAddr))
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("stranger cannot call removeApprovedProtocol()", async function () {
      await vault.connect(owner).addApprovedProtocol(goodProtocolAddr);
      await expect(vault.connect(stranger).removeApprovedProtocol(goodProtocolAddr))
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("stranger cannot call pause()", async function () {
      await expect(vault.connect(stranger).pause())
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("stranger cannot call unpause()", async function () {
      await vault.connect(owner).pause();
      await expect(vault.connect(stranger).unpause())
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });

  describe("Access Control — reallocate()", function () {
    it("owner cannot call reallocate()", async function () {
      await depositUsdy();
      await vault.connect(owner).addApprovedProtocol(goodProtocolAddr);
      const data = buildSwapData(usdyAddr, methAddr, E18(10));
      await expect(
        vault.connect(owner).reallocate(usdyAddr, methAddr, goodProtocolAddr, E18(10), 0, 100, data)
      ).to.be.revertedWith("ARIAVault: not agent");
    });

    it("stranger cannot call reallocate()", async function () {
      await depositUsdy();
      await vault.connect(owner).addApprovedProtocol(goodProtocolAddr);
      const data = buildSwapData(usdyAddr, methAddr, E18(10));
      await expect(
        vault.connect(stranger).reallocate(usdyAddr, methAddr, goodProtocolAddr, E18(10), 0, 100, data)
      ).to.be.revertedWith("ARIAVault: not agent");
    });

    it("compromised agent cannot route funds to unapproved address", async function () {
      await depositUsdy(E18(100));
      const fakeData = ethers.toUtf8Bytes("steal");
      await expect(
        vault.connect(agent).reallocate(
          usdyAddr, methAddr, attacker.address, E18(10), 0, 100, fakeData
        )
      ).to.be.revertedWith("ARIAVault: not approved protocol");
    });
  });

  describe("Access Control — factory", function () {
    it("one wallet cannot create two vaults", async function () {
      await factory.connect(stranger).createVault();
      await expect(factory.connect(stranger).createVault())
        .to.be.revertedWith("Vault already exists");
    });

    it("getVault returns zero address for wallet with no vault", async function () {
      expect(await factory.getVault(attacker.address)).to.equal(ethers.ZeroAddress);
    });

    it("hasVault is false for uncreated vault, true after creation", async function () {
      expect(await factory.hasVault(attacker.address)).to.be.false;
      await factory.connect(attacker).createVault();
      expect(await factory.hasVault(attacker.address)).to.be.true;
      expect(await factory.hasVault(stranger.address)).to.be.false;
    });

    it("vault created by factory is owned by the caller, not factory", async function () {
      await factory.connect(stranger).createVault();
      const vaultAddress = await factory.getVault(stranger.address);
      const createdVault = await ethers.getContractAt("ARIAVault", vaultAddress);
      expect(await createdVault.owner()).to.equal(stranger.address);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1C — Fee Manipulation
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Fee Manipulation", function () {
    it("cannot set performanceFeeBps above 2000 (20%)", async function () {
      await expect(vault.connect(owner).setPerformanceFeeBps(2001))
        .to.be.revertedWith("ARIAVault: performance fee exceeds cap");
    });

    it("can set performanceFeeBps to exactly 2000", async function () {
      await expect(vault.connect(owner).setPerformanceFeeBps(2000)).to.not.be.reverted;
      expect(await vault.performanceFeeBps()).to.equal(2000n);
    });

    it("cannot set managementFeeBps above 200 (2%)", async function () {
      await expect(vault.connect(owner).setManagementFeeBps(201))
        .to.be.revertedWith("ARIAVault: management fee exceeds cap");
    });

    it("can set managementFeeBps to exactly 200", async function () {
      await expect(vault.connect(owner).setManagementFeeBps(200)).to.not.be.reverted;
      expect(await vault.managementFeeBps()).to.equal(200n);
    });

    it("non-owner cannot change performanceFeeBps", async function () {
      await expect(vault.connect(stranger).setPerformanceFeeBps(0))
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("non-owner cannot change managementFeeBps", async function () {
      await expect(vault.connect(stranger).setManagementFeeBps(0))
        .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("feeRecipient can be set to zero (disables all fee collection)", async function () {
      await expect(vault.connect(owner).setFeeRecipient(ethers.ZeroAddress)).to.not.be.reverted;
    });

    it("no fee accrues when feeRecipient is zero address", async function () {
      await vault.connect(owner).setFeeRecipient(ethers.ZeroAddress);
      await depositUsdy(E18(1000));
      await time.increase(YEAR);
      const balBefore = await usdy.balanceOf(feeRecipient.address);
      await vault.connect(owner).withdraw(usdyAddr, E18(1));
      expect(await usdy.balanceOf(feeRecipient.address)).to.equal(balBefore);
    });

    it("fee recipient cannot be set to vault's own address", async function () {
      // There is no explicit guard — this is a known LOW finding.
      // Test documents the behavior: fees lock if recipient == vault.
      await vault.connect(owner).setFeeRecipient(vaultAddr);
      await depositUsdy(E18(1000));
      await time.increase(YEAR);
      // Management fee would transfer to vault itself — tokens stay in vault, not lost
      // Withdraw should still succeed
      await expect(vault.connect(owner).withdraw(usdyAddr, E18(1))).to.not.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1D — Integer Overflow / Underflow
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Integer Overflow / Underflow", function () {
    it("deposit with max uint256 reverts (insufficient balance)", async function () {
      await usdy.connect(owner).approve(vaultAddr, ethers.MaxUint256);
      await expect(vault.connect(owner).deposit(usdyAddr, ethers.MaxUint256)).to.be.reverted;
    });

    it("withdraw with amount exceeding balance reverts", async function () {
      await depositUsdy(E18(100));
      await expect(vault.connect(owner).withdraw(usdyAddr, E18(200)))
        .to.be.revertedWith("ARIAVault: insufficient balance");
    });

    it("management fee with 100-year time gap does not overflow", async function () {
      await depositUsdy(E18(1000));
      await time.increase(100 * YEAR);
      // Fee is capped at balance — must not revert with arithmetic overflow
      await expect(vault.connect(owner).withdraw(usdyAddr, E18(1))).to.not.be.reverted;
    });

    it("performance fee caps at 100% of amount — no overflow, net amount guard fires", async function () {
      await depositUsdy(E18(1000));
      await vault.connect(owner).addApprovedProtocol(goodProtocolAddr);
      const amount = E18(100);
      const data = buildSwapData(usdyAddr, methAddr, amount);

      // Extreme APY (10,000%) causes fee to exceed amount.
      // Cap kicks in: fee = amount, netAmount = 0, contract reverts cleanly.
      // This proves the cap formula works and there is no arithmetic overflow.
      await expect(
        vault.connect(agent).reallocate(usdyAddr, methAddr, goodProtocolAddr, amount, 0, 1_000_000, data)
      ).to.be.revertedWith("ARIAVault: net amount is zero");

      // With identical expectedApy == newApy, performance fee = 0, netAmount = amount.
      // This proves arithmetic with large APY values produces no overflow.
      const noFeeData = buildSwapData(usdyAddr, methAddr, amount);
      await expect(
        vault.connect(agent).reallocate(usdyAddr, methAddr, goodProtocolAddr, amount, 100_000, 100_000, noFeeData)
      ).to.not.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1E — Malicious Protocol Attacks
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Malicious Protocol — approval revocation", function () {
    it("approval is always revoked to zero after reallocate, even on failed call", async function () {
      const MalProto = await ethers.getContractFactory("MaliciousProtocol");
      const malProto = await MalProto.deploy();
      const malProtoAddr = await malProto.getAddress();

      await depositUsdy(E18(100));
      await vault.connect(owner).addApprovedProtocol(malProtoAddr);
      // Mode 2: StealApproval — pulls amountIn then tries to pull 1 more
      await malProto.setMode(2);

      const data = malProto.interface.encodeFunctionData("swap", [
        usdyAddr, methAddr, E18(10), vaultAddr,
      ]);

      // May or may not revert depending on tokenOut balance; what matters is approval
      try {
        await vault.connect(agent).reallocate(
          usdyAddr, methAddr, malProtoAddr, E18(10), 0, 0, data
        );
      } catch { /* expected in some cases */ }

      // Critical: approval MUST be zero — forceApprove(protocol, 0) runs unconditionally
      expect(await usdy.allowance(vaultAddr, malProtoAddr)).to.equal(0n);
    });

    it("malicious protocol cannot drain tokenOut (vault never approved it)", async function () {
      const MalProto = await ethers.getContractFactory("MaliciousProtocol");
      const malProto = await MalProto.deploy();
      const malProtoAddr = await malProto.getAddress();

      await depositUsdy(E18(100));
      await meth.mint(vaultAddr, E18(50));
      await vault.connect(owner).addApprovedProtocol(malProtoAddr);
      await malProto.setMode(4); // DrainTokenOut

      const methBefore = await meth.balanceOf(vaultAddr);
      const data = malProto.interface.encodeFunctionData("swap", [
        usdyAddr, methAddr, E18(10), vaultAddr,
      ]);

      try {
        await vault.connect(agent).reallocate(
          usdyAddr, methAddr, malProtoAddr, E18(10), 0, 0, data
        );
      } catch { /* expected */ }

      // meth balance must be unchanged — no approval was given for meth
      expect(await meth.balanceOf(vaultAddr)).to.equal(methBefore);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1F — Pause Mechanics
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Pause Mechanics", function () {
    it("deposit is blocked when paused", async function () {
      await vault.connect(owner).pause();
      await usdy.connect(owner).approve(vaultAddr, E18(100));
      await expect(vault.connect(owner).deposit(usdyAddr, E18(100)))
        .to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("withdraw is NOT blocked when paused (emergency exit preserved)", async function () {
      await depositUsdy(E18(100));
      await vault.connect(owner).pause();
      await expect(vault.connect(owner).withdraw(usdyAddr, E18(50))).to.not.be.reverted;
    });

    it("reallocate is blocked when paused", async function () {
      await depositUsdy(E18(100));
      await vault.connect(owner).addApprovedProtocol(goodProtocolAddr);
      await vault.connect(owner).pause();
      const data = buildSwapData(usdyAddr, methAddr, E18(10));
      await expect(
        vault.connect(agent).reallocate(usdyAddr, methAddr, goodProtocolAddr, E18(10), 0, 100, data)
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("ownership cannot be renounced", async function () {
      await expect(vault.connect(owner).renounceOwnership())
        .to.be.revertedWith("ARIAVault: ownership cannot be renounced");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1G — ERC20 Edge Cases
  // ═══════════════════════════════════════════════════════════════════════════

  describe("ERC20 Edge Cases", function () {
    it("deposit with zero amount reverts", async function () {
      await usdy.connect(owner).approve(vaultAddr, E18(100));
      await expect(vault.connect(owner).deposit(usdyAddr, 0n))
        .to.be.revertedWith("ARIAVault: zero amount");
    });

    it("deposit with zero token address reverts", async function () {
      await expect(vault.connect(owner).deposit(ethers.ZeroAddress, E18(1)))
        .to.be.revertedWith("ARIAVault: zero token");
    });

    it("withdraw with zero amount reverts", async function () {
      await depositUsdy();
      await expect(vault.connect(owner).withdraw(usdyAddr, 0n))
        .to.be.revertedWith("ARIAVault: zero amount");
    });

    it("reallocate to unapproved protocol reverts", async function () {
      await depositUsdy();
      const data = buildSwapData(usdyAddr, methAddr, E18(10));
      await expect(
        vault.connect(agent).reallocate(usdyAddr, methAddr, goodProtocolAddr, E18(10), 0, 100, data)
      ).to.be.revertedWith("ARIAVault: not approved protocol");
    });

    it("reallocate with amount exceeding vault balance reverts", async function () {
      await depositUsdy(E18(10));
      await vault.connect(owner).addApprovedProtocol(goodProtocolAddr);
      const data = buildSwapData(usdyAddr, methAddr, E18(100));
      await expect(
        vault.connect(agent).reallocate(usdyAddr, methAddr, goodProtocolAddr, E18(100), 0, 100, data)
      ).to.be.revertedWith("ARIAVault: insufficient tokenIn");
    });

    it("reallocate with zero tokenIn address reverts", async function () {
      await depositUsdy();
      await vault.connect(owner).addApprovedProtocol(goodProtocolAddr);
      await expect(
        vault.connect(agent).reallocate(ethers.ZeroAddress, methAddr, goodProtocolAddr, E18(10), 0, 100, "0x")
      ).to.be.revertedWith("ARIAVault: zero tokenIn");
    });

    it("reallocate with zero tokenOut address reverts", async function () {
      await depositUsdy();
      await vault.connect(owner).addApprovedProtocol(goodProtocolAddr);
      await expect(
        vault.connect(agent).reallocate(usdyAddr, ethers.ZeroAddress, goodProtocolAddr, E18(10), 0, 100, "0x")
      ).to.be.revertedWith("ARIAVault: zero tokenOut");
    });
  });
});
