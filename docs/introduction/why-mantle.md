# Why Mantle?

ARIA is built exclusively on Mantle, a high-performance Ethereum Layer 2 network optimized for DeFi applications. The choice of Mantle is deliberate and central to ARIA's design.

---

## Low Gas Costs Enable Frequent Reallocation

ARIA's value comes from its ability to act quickly and frequently. The agent scans every 5 minutes and is designed to reallocate whenever a meaningful yield improvement is available. On Ethereum mainnet, gas costs would make frequent small reallocations economically unviable. On Mantle, gas costs are low enough that even modest yield improvements justify the transaction cost.

---

## Native DeFi Ecosystem

Mantle hosts two major Uniswap V3 fork protocols, Agni Finance and FusionX, that together provide deep WETH and USDC liquidity. Both protocols use the Uniswap V3 `exactInputSingle` interface, which means ARIA's executor can construct identical calldata for both using the same code path. New Mantle-native protocols can be added to the whitelist as the ecosystem grows.

---

## EVM Compatibility

Mantle is EVM-compatible. ARIA's smart contracts are written in Solidity using standard OpenZeppelin libraries. Deployment, verification, and interaction all use familiar Ethereum tooling including Hardhat, viem, and ethers.js. No custom toolchains or SDK dependencies.

---

## MNT as Gas

The Mantle native token MNT is used to pay transaction fees. ARIA's agent wallet holds a small MNT balance for gas. The fee separation between MNT (gas) and WETH/USDC (yield assets) keeps the agent's operational overhead clearly separated from user funds. The agent wallet holds MNT for gas only. It never holds user assets.

---

## xStocks on Mantle

Mantle is the home of the xStocks ecosystem, a partnership between Mantle, Bybit, BackedFi, and Flowdesk that brings tokenized US equities on-chain. Assets like TSLAx, NVDAx, AAPLx, and seven others are 1:1 backed by real securities and compliant with the Swiss DLT Act. ARIA's Aggressive profile can allocate into xStocks positions via Fluxion DEX, giving users exposure to equity yield on the same chain as their DeFi positions.
