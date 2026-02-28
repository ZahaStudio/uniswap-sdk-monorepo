# React SDK Reference — `@zahastudio/uniswap-sdk-react`

## Installation

```bash
pnpm add @zahastudio/uniswap-sdk-react @zahastudio/uniswap-sdk viem wagmi @tanstack/react-query
```

Peer dependencies: `react >= 18`, `viem >= 2`, `wagmi >= 2`, `@wagmi/core >= 2`, `@tanstack/react-query >= 5`

## Provider Setup

The `UniswapSDKProvider` must be nested inside `WagmiProvider` and `QueryClientProvider`:

```tsx
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UniswapSDKProvider } from "@zahastudio/uniswap-sdk-react";

const queryClient = new QueryClient();

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <UniswapSDKProvider config={sdkConfig}>
          <YourApp />
        </UniswapSDKProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### `UniswapSDKConfig`

| Field                      | Type                          | Default       | Description                            |
| -------------------------- | ----------------------------- | ------------- | -------------------------------------- |
| `contracts`                | `Record<number, V4Contracts>` | Auto-resolved | Custom contract addresses per chain ID |
| `defaultDeadline`          | `number`                      | `600`         | Default deadline in seconds            |
| `defaultSlippageTolerance` | `number`                      | `50`          | Default slippage in BPS                |

---

## Common Hook Options

Most hooks accept an `options` parameter:

### `UseHookOptions`

| Field             | Type              | Default         | Description                                            |
| ----------------- | ----------------- | --------------- | ------------------------------------------------------ |
| `chainId`         | `number`          | Connected chain | Override chain ID                                      |
| `enabled`         | `boolean`         | `true`          | Enable/disable the query                               |
| `refetchInterval` | `number \| false` | `false`         | Polling interval in ms (recommend `12000` for 1 block) |

### `UseMutationHookOptions`

| Field       | Type         | Description                        |
| ----------- | ------------ | ---------------------------------- |
| `chainId`   | `number`     | Override chain ID                  |
| `onSuccess` | `() => void` | Callback when transaction confirms |

---

## Hooks

### `useUniswapSDK(options?)`

Access a cached SDK instance for a chain.

```tsx
const { sdk, isInitialized, chainId } = useUniswapSDK();
// Or for a specific chain:
const { sdk } = useUniswapSDK({ chainId: 42161 });
```

**Returns:** `UseUniswapSDKReturn`

| Field           | Type         | Description                   |
| --------------- | ------------ | ----------------------------- |
| `sdk`           | `UniswapSDK` | The SDK instance              |
| `isInitialized` | `boolean`    | Whether SDK is ready          |
| `chainId`       | `number`     | Effective chain ID being used |

SDK instances are cached per chain — calling with the same `chainId` returns the same instance.

---

### `useSwap(params, options?)`

Full swap lifecycle: quote → approve → permit2 sign → execute.

```tsx
const swap = useSwap(
  {
    poolKey: { currency0, currency1, fee: 3000, tickSpacing: 60, hooks: ZERO_ADDRESS },
    amountIn: parseEther("1"),
    zeroForOne: true,
    slippageBps: 50, // optional, default from SDK
    recipient: address, // optional, defaults to connected wallet
    useNativeETH: false, // optional, wrap/unwrap ETH
  },
  { refetchInterval: 12000 }, // optional
);
```

**Params:** `UseSwapParams`

| Field          | Type      | Required | Description                                  |
| -------------- | --------- | -------- | -------------------------------------------- |
| `poolKey`      | `PoolKey` | Yes      | Pool to swap through                         |
| `amountIn`     | `bigint`  | Yes      | Input amount (base units)                    |
| `zeroForOne`   | `boolean` | Yes      | Swap direction                               |
| `recipient`    | `Address` | No       | Output recipient (default: connected wallet) |
| `slippageBps`  | `number`  | No       | Slippage in BPS (default: SDK default)       |
| `useNativeETH` | `boolean` | No       | Wrap/unwrap native ETH                       |

**Returns:** `UseSwapReturn`

| Field            | Type                                                          | Description                                             |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------- |
| `steps.quote`    | `UseQueryResult<QuoteData>`                                   | Auto-fetching quote with `amountOut` and `minAmountOut` |
| `steps.approval` | `UseTokenApprovalReturn`                                      | ERC-20 → Permit2 approval                               |
| `steps.permit2`  | `UsePermit2SignStep`                                          | Off-chain Permit2 signature                             |
| `steps.swap`     | `UseSwapExecuteStep`                                          | Swap transaction execution                              |
| `currentStep`    | `"quote" \| "approval" \| "permit2" \| "swap" \| "completed"` | First incomplete step                                   |
| `executeAll`     | `() => Promise<Hex>`                                          | Run all remaining steps sequentially                    |
| `reset`          | `() => void`                                                  | Reset mutation state (quote persists)                   |

#### Usage Patterns

**One-click swap:**

```tsx
const txHash = await swap.executeAll();
```

**Step-by-step control:**

```tsx
// 1. Wait for quote
const quote = swap.steps.quote.data;

// 2. Approve if needed
if (swap.steps.approval.isRequired) {
  await swap.steps.approval.approve();
  await swap.steps.approval.transaction.waitForConfirmation();
}

// 3. Sign permit2
await swap.steps.permit2.sign();

// 4. Execute swap
const txHash = await swap.steps.swap.execute();
```

**Render current step:**

```tsx
switch (swap.currentStep) {
  case "quote":
    return <Loading />;
  case "approval":
    return <ApproveButton onClick={swap.steps.approval.approve} />;
  case "permit2":
    return <SignButton onClick={swap.steps.permit2.sign} />;
  case "swap":
    return <SwapButton onClick={swap.steps.swap.execute} />;
  case "completed":
    return <Success />;
}
```

**Native ETH skips approval + permit2 steps automatically.**

---

### `useCreatePosition(params, options?)`

Create a new liquidity position: fetch pool → compute amounts → approve → permit2 → mint.

```tsx
const create = useCreatePosition(
  {
    poolKey: { currency0, currency1, fee: 3000, tickSpacing: 60, hooks: ZERO_ADDRESS },
    amount0: parseUnits("1", 18), // pass ONE amount, the other is auto-computed
    // amount1: parseUnits("2000", 6), // OR pass this instead
    tickLower: -887220, // optional, defaults to full range
    tickUpper: 887220, // optional, defaults to full range
  },
  { onSuccess: () => refetchPositions() },
);
```

**Params:** `UseCreatePositionParams`

| Field       | Type      | Required     | Description                      |
| ----------- | --------- | ------------ | -------------------------------- |
| `poolKey`   | `PoolKey` | Yes          | Pool to add liquidity to         |
| `amount0`   | `bigint`  | One required | Token0 amount (user-edited side) |
| `amount1`   | `bigint`  | One required | Token1 amount (user-edited side) |
| `tickLower` | `number`  | No           | Lower tick (default: full range) |
| `tickUpper` | `number`  | No           | Upper tick (default: full range) |

**Returns:** `UseCreatePositionReturn`

| Field                  | Type                                         | Description                                                                  |
| ---------------------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| `pool`                 | `UseQueryResult<Pool>`                       | Pool query (current price, liquidity)                                        |
| `position`             | `CalculatedPosition \| null`                 | Computed amounts: `{ amount0, amount1, formattedAmount0, formattedAmount1 }` |
| `tickRange`            | `{ tickLower, tickUpper } \| null`           | Resolved tick range                                                          |
| `steps.approvalToken0` | `UseTokenApprovalReturn`                     | ERC-20 approval for token0                                                   |
| `steps.approvalToken1` | `UseTokenApprovalReturn`                     | ERC-20 approval for token1                                                   |
| `steps.permit2`        | `UsePermit2SignStep`                         | Permit2 batch signature                                                      |
| `steps.execute`        | `{ transaction, execute }`                   | Mint transaction                                                             |
| `currentStep`          | `AddLiquidityStep`                           | First incomplete step                                                        |
| `executeAll`           | `(args: CreatePositionArgs) => Promise<Hex>` | Run all steps                                                                |
| `reset`                | `() => void`                                 | Reset mutation state                                                         |

#### Usage

```tsx
// Auto-computed complementary amount
const computedAmount1 = create.position?.formattedAmount1;

// One-click create
const txHash = await create.executeAll({
  recipient: address,
  slippageTolerance: 50, // optional
});
```

---

### `usePosition(tokenId, options?)`

Fetch position data by NFT token ID.

```tsx
const position = usePosition("12345", { chainId: 1 });
// Returns UseQueryResult with GetPositionResponse data
```

---

### `usePositionIncreaseLiquidity(params, options?)`

Add liquidity to an existing position.

```tsx
const increase = usePositionIncreaseLiquidity({
  tokenId: "12345",
  amount0: parseUnits("0.5", 18),
});

await increase.executeAll({ recipient: address });
```

---

### `usePositionRemoveLiquidity(params, options?)`

Remove liquidity from a position.

```tsx
const remove = usePositionRemoveLiquidity({
  tokenId: "12345",
  liquidityPercentage: 5000, // 50% in BPS
});

await remove.executeAll();
```

---

### `usePositionCollectFees(params, options?)`

Collect accrued fees from a position.

```tsx
const collect = usePositionCollectFees({ tokenId: "12345" });
await collect.execute({ recipient: address });
```

---

### Primitive Hooks

These are lower-level hooks used internally by the workflow hooks above. Use them for custom flows.

#### `useToken(params, options?)`

Fetch token metadata and balance.

```tsx
const { query } = useToken({ tokenAddress: "0x..." }, { enabled: true, chainId: 1 });
// query.data = { symbol, name, decimals, balance: { raw, formatted } }
```

#### `usePermit2(params, options?)`

Manage Permit2 approval + signature for one or more tokens.

```tsx
const permit2 = usePermit2(
  {
    tokens: [{ address: "0x...", amount: 1000000n }],
    spender: universalRouterAddress,
  },
  { enabled: true, chainId: 1 },
);

// Full flow: approve ERC-20 → Permit2, then sign
const signedPermit = await permit2.approveAndSign();

// Or individually:
permit2.approvals[0].approve(); // ERC-20 approve
permit2.permit2.sign(); // Off-chain sign
```

#### `useTokenApproval(params, options?)`

Single ERC-20 approval step.

```tsx
const approval = useTokenApproval({ tokenAddress, spender, amount });
if (approval.isRequired) {
  await approval.approve();
  await approval.transaction.waitForConfirmation();
}
```

#### `useTransaction()`

Transaction lifecycle management (send, wait, status tracking).

```tsx
const tx = useTransaction();
const hash = await tx.sendTransaction({ to, data, value });
await tx.waitForConfirmation();
// tx.status: "idle" | "pending" | "confirming" | "confirmed" | "error"
```

---

## Step-Based Architecture

All workflow hooks (`useSwap`, `useCreatePosition`, `usePositionIncreaseLiquidity`, `usePositionRemoveLiquidity`) follow a consistent pattern:

1. **`steps`** — individual lifecycle steps with their own state and actions
2. **`currentStep`** — the first incomplete required step (for rendering UI)
3. **`executeAll()`** — chains all remaining steps sequentially
4. **`reset()`** — resets mutation state without clearing queries

This pattern enables both one-click UX (`executeAll`) and granular step-by-step control.
