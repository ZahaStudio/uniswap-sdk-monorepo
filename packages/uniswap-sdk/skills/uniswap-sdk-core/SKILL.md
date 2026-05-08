---
name: uniswap-sdk-core
description: >
  Use this when building with @zahastudio/uniswap-sdk core APIs: UniswapSDK.create, Uniswap v4 PoolKey routes, getQuote, buildSwapCallData, Permit2 batch signatures, liquidity calldata, position reads, native ETH/WETH handling, contract overrides, slippage BPS, and viem PublicClient integration.
type: core
library: "@zahastudio/uniswap-sdk"
library_version: "0.5.0"
sources:
  - "ZahaStudio/uniswap-sdk-monorepo:docs/README.md"
  - "ZahaStudio/uniswap-sdk-monorepo:docs/core-sdk.md"
  - "ZahaStudio/uniswap-sdk-monorepo:docs/recipes.md"
  - "ZahaStudio/uniswap-sdk-monorepo:docs/types.md"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk/src/core/sdk.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk/src/helpers/swap.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk/src/helpers/tokens.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk/src/internal/swap.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk/src/utils/buildAddLiquidityCallData.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk/src/utils/buildCollectFeesCallData.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk/src/utils/buildRemoveLiquidityCallData.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk/src/utils/buildSwapCallData.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk/src/utils/getQuote.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk/src/utils/preparePermit2BatchData.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk/src/utils/swapRoute.ts"
---

# Community Uniswap SDK Core

## Setup

```ts
import { UniswapSDK, sortTokens } from "@zahastudio/uniswap-sdk";
import { createPublicClient, http, parseEther } from "viem";
import { mainnet } from "viem/chains";

const client = createPublicClient({ chain: mainnet, transport: http() });
const sdk = UniswapSDK.create(client, mainnet.id);

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const [currency0, currency1] = sortTokens(WETH, USDC);

const poolKey = {
  currency0,
  currency1,
  fee: 3000,
  tickSpacing: 60,
  hooks: "0x0000000000000000000000000000000000000000",
} as const;

const quote = await sdk.getQuote({
  route: [{ poolKey }],
  exactInput: { currency: WETH, amount: parseEther("1") },
});
```

## Core Patterns

### Quote exact-input and exact-output swaps

```ts
import { calculateMaximumInput } from "@zahastudio/uniswap-sdk";

const exactInputQuote = await sdk.getQuote({
  route: [{ poolKey, hookData: "0x" }],
  exactInput: { currency: WETH, amount: 1_000_000_000_000_000_000n },
});

const exactOutputQuote = await sdk.getQuote({
  route: [{ poolKey, hookData: "0x" }],
  exactOutput: { currency: USDC, amount: 1_000_000n },
});

const maxAmountIn = calculateMaximumInput(exactOutputQuote.amountIn, 50);
```

Use `exactInput` or `exactOutput`, never both. `hookData` is optional per route hop and defaults to `"0x"`.

### Build swap calldata with Permit2

```ts
import { calculateMinimumOutput } from "@zahastudio/uniswap-sdk";

const universalRouter = sdk.getContractAddress("universalRouter");
const permitData = await sdk.preparePermit2BatchData({
  tokens: [WETH],
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

const pool = await sdk.getPool(poolKey);
const { calldata, value } = await sdk.buildSwapCallData({
  route: [{ pool, hookData: "0x" }],
  exactInput: { currency: WETH, amount: 1_000_000_000_000_000_000n },
  minAmountOut: calculateMinimumOutput(exactInputQuote.amountOut, 50),
  recipient: account.address,
  permit2Signature: permitData.buildPermit2BatchDataWithSignature(signature),
});
```

Calldata builders do not send transactions. Send the returned calldata to the resolved router or position manager with a viem wallet client.

### Swap with native ETH through a WETH pool

```ts
const { calldata, value } = await sdk.buildSwapCallData({
  route: [{ pool }],
  exactInput: { currency: WETH, amount: 1_000_000_000_000_000_000n },
  minAmountOut: 2_000_000_000n,
  recipient: account.address,
  useNativeToken: true,
});

await wallet.sendTransaction({
  account,
  chain: mainnet,
  to: sdk.getContractAddress("universalRouter"),
  data: calldata,
  value: BigInt(value),
});
```

When `useNativeToken` is true, route edges use WETH addresses but execution wraps or unwraps native ETH.

### Build liquidity and position calldata

```ts
const positionManager = sdk.getContractAddress("positionManager");
const pool = await sdk.getPool(poolKey);
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

const { calldata, value } = await sdk.buildAddLiquidityCallData({
  pool,
  amount0: "1000000",
  amount1: "500000000000000000",
  recipient: account.address,
  tickLower: -887220,
  tickUpper: 887220,
  slippageTolerance: 50,
  permit2BatchSignature: permitData.buildPermit2BatchDataWithSignature(signature),
});
```

Use the Position Manager address for add, remove, and collect liquidity transactions.
For ERC-20 flows, ensure the wallet has also approved the token contract to the Permit2 contract before relying on the off-chain Permit2 signature.
Fee collection currently uses empty hook data (`"0x"`); custom hooked positions that require collection hook bytes are not supported by `buildCollectFeesCallData` yet.

## Common Mistakes

### HIGH Unsorted pool key currencies

Wrong:

```ts
const poolKey = { currency0: WETH, currency1: USDC, fee: 3000, tickSpacing: 60, hooks: ZERO_HOOKS };
```

Correct:

```ts
const [currency0, currency1] = sortTokens(WETH, USDC);
const poolKey = { currency0, currency1, fee: 3000, tickSpacing: 60, hooks: ZERO_HOOKS };
```

Uniswap v4 pool keys require sorted currencies; swap direction comes from `exactInput.currency` or `exactOutput.currency` plus the ordered route.

Source: ZahaStudio/uniswap-sdk-monorepo:docs/README.md

### HIGH Mixing quote routes and calldata routes

Wrong:

```ts
await sdk.buildSwapCallData({
  route: [{ poolKey }],
  exactInput: { currency: WETH, amount },
  minAmountOut,
  recipient,
});
```

Correct:

```ts
const pool = await sdk.getPool(poolKey);
await sdk.buildSwapCallData({
  route: [{ pool }],
  exactInput: { currency: WETH, amount },
  minAmountOut,
  recipient,
});
```

Quotes use `route: [{ poolKey }]`; calldata builders need initialized `Pool` instances in `route: [{ pool }]`.

Source: ZahaStudio/uniswap-sdk-monorepo:docs/core-sdk.md

### HIGH Sending native ETH without value

Wrong:

```ts
await wallet.sendTransaction({
  account,
  chain: mainnet,
  to: sdk.getContractAddress("universalRouter"),
  data: calldata,
});
```

Correct:

```ts
await wallet.sendTransaction({
  account,
  chain: mainnet,
  to: sdk.getContractAddress("universalRouter"),
  data: calldata,
  value: BigInt(value),
});
```

Native ETH swaps skip Permit2 but must send the returned `value` with the transaction.

Source: ZahaStudio/uniswap-sdk-monorepo:docs/recipes.md

### MEDIUM Treating BPS as percentages

Wrong:

```ts
const minAmountOut = calculateMinimumOutput(quote.amountOut, 0.5);
```

Correct:

```ts
const minAmountOut = calculateMinimumOutput(quote.amountOut, 50);
```

Slippage uses basis points: `50` is 0.5%, `100` is 1%, and `10000` is 100%.

Source: ZahaStudio/uniswap-sdk-monorepo:docs/README.md

### MEDIUM Omitting hookData for hooked pools

Wrong:

```ts
await sdk.getQuote({ route: [{ poolKey: hookedPoolKey }], exactInput: { currency: tokenIn, amount } });
```

Correct:

```ts
await sdk.getQuote({
  route: [{ poolKey: hookedPoolKey, hookData: "0x1234" }],
  exactInput: { currency: tokenIn, amount },
});
```

The SDK preserves `hookData` unchanged; hooked pools that require bytes need those bytes on each affected route hop.

Source: ZahaStudio/uniswap-sdk-monorepo:docs/core-sdk.md
