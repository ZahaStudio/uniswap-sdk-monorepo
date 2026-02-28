# Recipes — Complete Code Examples

## Recipe 1: Get a Swap Quote (Core SDK)

```ts
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { UniswapSDK } from "@zahastudio/uniswap-sdk";

const client = createPublicClient({ chain: mainnet, transport: http() });
const sdk = UniswapSDK.create(client, 1);

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const ZERO_HOOKS = "0x0000000000000000000000000000000000000000";

const quote = await sdk.getQuote({
  poolKey: {
    currency0: USDC, // currency0 < currency1 (sorted by address)
    currency1: WETH,
    fee: 3000,
    tickSpacing: 60,
    hooks: ZERO_HOOKS,
  },
  zeroForOne: false, // WETH → USDC (WETH is currency1)
  amountIn: 1000000000000000000n, // 1 WETH
});

console.log(`Output: ${quote.amountOut} USDC (raw)`);
```

---

## Recipe 2: Execute a Swap (Core SDK + viem wallet)

Full swap flow with Permit2.

```ts
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { UniswapSDK, calculateMinimumOutput, sortTokens } from "@zahastudio/uniswap-sdk";

// Setup
const account = privateKeyToAccount("0x...");
const client = createPublicClient({ chain: mainnet, transport: http() });
const wallet = createWalletClient({ account, chain: mainnet, transport: http() });
const sdk = UniswapSDK.create(client, 1);

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const [currency0, currency1] = sortTokens(WETH, USDC);
const ZERO_HOOKS = "0x0000000000000000000000000000000000000000";

const poolKey = {
  currency0,
  currency1,
  fee: 3000,
  tickSpacing: 60,
  hooks: ZERO_HOOKS,
};

const amountIn = parseEther("1");
const zeroForOne = WETH.toLowerCase() === currency0.toLowerCase(); // true if WETH is token0

// Step 1: Get quote
const quote = await sdk.getQuote({
  poolKey,
  zeroForOne,
  amountIn,
});

const minAmountOut = calculateMinimumOutput(quote.amountOut, 50); // 0.5% slippage

// Step 2: Prepare Permit2 (skip for native ETH)
const universalRouter = sdk.getContractAddress("universalRouter");
const permitData = await sdk.preparePermit2BatchData({
  tokens: [zeroForOne ? currency0 : currency1],
  spender: universalRouter,
  owner: account.address,
});

const signature = await wallet.signTypedData({
  account,
  domain: permitData.toSign.domain,
  types: permitData.toSign.types,
  primaryType: permitData.toSign.primaryType,
  message: permitData.toSign.message,
});

const permit2Signature = permitData.buildPermit2BatchDataWithSignature(signature);

// Step 3: Get pool and build calldata
const pool = await sdk.getPool(poolKey);
const calldata = await sdk.buildSwapCallData({
  pool,
  amountIn,
  amountOutMinimum: minAmountOut,
  zeroForOne,
  recipient: account.address,
  permit2Signature,
});

// Step 4: Send transaction
const hash = await wallet.sendTransaction({
  account,
  to: universalRouter,
  data: calldata,
  chain: mainnet,
});

console.log(`Swap tx: ${hash}`);
```

---

## Recipe 3: Native ETH Swap (Core SDK)

When swapping native ETH, skip Permit2 and send `value` with the transaction.

```ts
// For a pool with WETH as one of the currencies
const calldata = await sdk.buildSwapCallData({
  pool,
  amountIn: parseEther("1"),
  amountOutMinimum: minAmountOut,
  zeroForOne: true,
  recipient: account.address,
  useNativeETH: true, // enables WRAP_ETH / UNWRAP_WETH commands
});

const hash = await wallet.sendTransaction({
  account,
  to: universalRouter,
  data: calldata,
  value: parseEther("1"), // send ETH with the transaction
  chain: mainnet,
});
```

---

## Recipe 4: Add Liquidity / Create Position (Core SDK)

```ts
const pool = await sdk.getPool(poolKey);

// Prepare Permit2 for both tokens
const positionManager = sdk.getContractAddress("positionManager");
const permitData = await sdk.preparePermit2BatchData({
  tokens: [currency0, currency1],
  spender: positionManager,
  owner: account.address,
});

const signature = await wallet.signTypedData({
  account,
  domain: permitData.toSign.domain,
  types: permitData.toSign.types,
  primaryType: permitData.toSign.primaryType,
  message: permitData.toSign.message,
});
const permit2Signature = permitData.buildPermit2BatchDataWithSignature(signature);

// Build calldata
const { calldata, value } = await sdk.buildAddLiquidityCallData({
  pool,
  amount0: "1000000", // 1 USDC (6 decimals)
  amount1: "500000000000000000", // 0.5 WETH (18 decimals)
  recipient: account.address,
  tickLower: -887220, // full range
  tickUpper: 887220,
  slippageTolerance: 50,
  permit2BatchSignature: permit2Signature,
});

const hash = await wallet.sendTransaction({
  account,
  to: positionManager,
  data: calldata,
  value: BigInt(value),
  chain: mainnet,
});
```

---

## Recipe 5: Remove Liquidity (Core SDK)

```ts
const { calldata, value } = await sdk.buildRemoveLiquidityCallData({
  tokenId: "12345",
  liquidityPercentage: 10_000, // 100% = full removal
  slippageTolerance: 100, // 1%
});

const hash = await wallet.sendTransaction({
  account,
  to: sdk.getContractAddress("positionManager"),
  data: calldata,
  value: BigInt(value),
  chain: mainnet,
});
```

---

## Recipe 6: Collect Fees (Core SDK)

```ts
const { calldata, value } = await sdk.buildCollectFeesCallData({
  tokenId: "12345",
  recipient: account.address,
});

const hash = await wallet.sendTransaction({
  account,
  to: sdk.getContractAddress("positionManager"),
  data: calldata,
  value: BigInt(value),
  chain: mainnet,
});
```

---

## Recipe 7: React Swap Component

```tsx
"use client";

import { useState } from "react";
import { parseEther, zeroAddress } from "viem";
import { useAccount } from "wagmi";
import { useSwap } from "@zahastudio/uniswap-sdk-react";

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

export function SwapWidget() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("1");

  const swap = useSwap(
    {
      poolKey: {
        currency0: USDC,
        currency1: WETH,
        fee: 3000,
        tickSpacing: 60,
        hooks: zeroAddress,
      },
      amountIn: parseEther(amount || "0"),
      zeroForOne: false, // WETH → USDC
      slippageBps: 50,
    },
    { refetchInterval: 12000 },
  );

  const quote = swap.steps.quote.data;

  return (
    <div>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      {quote && <p>Output: {quote.amountOut.toString()} USDC</p>}

      <button
        onClick={() => swap.executeAll()}
        disabled={swap.currentStep === "quote"}
      >
        {swap.currentStep === "completed" ? "Done!" : `Swap (${swap.currentStep})`}
      </button>
    </div>
  );
}
```

---

## Recipe 8: React Create Position

```tsx
"use client";

import { parseUnits, zeroAddress } from "viem";
import { useAccount } from "wagmi";
import { useCreatePosition } from "@zahastudio/uniswap-sdk-react";

export function CreatePositionWidget() {
  const { address } = useAccount();

  const create = useCreatePosition({
    poolKey: {
      currency0: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      currency1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      fee: 3000,
      tickSpacing: 60,
      hooks: zeroAddress,
    },
    amount0: parseUnits("1000", 6), // 1000 USDC
    // amount1 is auto-calculated from current pool price
  });

  return (
    <div>
      <p>Pool price: {create.pool.data?.token0Price.toFixed(4)}</p>
      <p>Token0: {create.position?.formattedAmount0}</p>
      <p>Token1: {create.position?.formattedAmount1}</p>

      <button
        onClick={() => create.executeAll({ recipient: address! })}
        disabled={!create.pool.data || !address}
      >
        Create Position ({create.currentStep})
      </button>
    </div>
  );
}
```

---

## Recipe 9: Fetch Position Info

```ts
// Core SDK — full position with SDK instances
const position = await sdk.getPosition("12345");
console.log(`Liquidity: ${position.position.liquidity}`);
console.log(`Current tick: ${position.currentTick}`);
console.log(`Token0: ${position.currency0.symbol}`);

// Core SDK — lightweight metadata (more efficient)
const info = await sdk.getPositionInfo("12345");
console.log(`Tick range: ${info.tickLower} - ${info.tickUpper}`);

// Core SDK — uncollected fees
const fees = await sdk.getUncollectedFees("12345");
console.log(`Fees: ${fees.amount0} token0, ${fees.amount1} token1`);
```

---

## Recipe 10: Custom Cache Adapter (Redis)

```ts
import Redis from "ioredis";
import type { CacheAdapter } from "@zahastudio/uniswap-sdk";

const redis = new Redis();

const redisCache: CacheAdapter = {
  async get<T>(key: string): Promise<T | undefined> {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : undefined;
  },
  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    if (ttlMs) {
      await redis.set(key, JSON.stringify(value), "PX", ttlMs);
    } else {
      await redis.set(key, JSON.stringify(value));
    }
  },
};

const sdk = UniswapSDK.create(client, 1, { cache: redisCache });
```
