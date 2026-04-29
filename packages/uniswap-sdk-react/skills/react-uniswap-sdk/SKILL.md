---
name: react-uniswap-sdk
description: >
  Use this when building React or Next.js apps with @zahastudio/uniswap-sdk-react: UniswapSDKProvider setup, wagmi and QueryClientProvider ordering, useUniswapSDK, useSwap, useCreatePosition, position hooks, usePermit2, useTokenApproval, useTransaction, step lifecycles, chainId options, and TanStack Query polling.
type: framework
library: "@zahastudio/uniswap-sdk-react"
framework: react
library_version: "0.5.0"
requires:
  - uniswap-sdk-core
sources:
  - "ZahaStudio/uniswap-sdk-monorepo:docs/react-sdk.md"
  - "ZahaStudio/uniswap-sdk-monorepo:docs/recipes.md"
  - "ZahaStudio/uniswap-sdk-monorepo:docs/types.md"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk-react/src/provider/UniswapSDKProvider.tsx"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk-react/src/hooks/useCreatePosition.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk-react/src/hooks/usePoolState.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk-react/src/hooks/usePosition.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk-react/src/hooks/usePositionCollectFees.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk-react/src/hooks/usePositionIncreaseLiquidity.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk-react/src/hooks/usePositionRemoveLiquidity.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk-react/src/hooks/useSwap.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk-react/src/hooks/useUniswapSDK.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk-react/src/hooks/primitives/usePermit2.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk-react/src/hooks/primitives/useToken.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk-react/src/hooks/primitives/useTokenApproval.ts"
  - "ZahaStudio/uniswap-sdk-monorepo:packages/uniswap-sdk-react/src/hooks/primitives/useTransaction.ts"
---

This skill builds on `uniswap-sdk-core`. Read it first for pool keys, routes, Permit2, slippage BPS, native token handling, and calldata behavior.

# Community Uniswap SDK React

## Setup

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UniswapSDKProvider } from "@zahastudio/uniswap-sdk-react";
import type { ReactNode } from "react";
import { WagmiProvider, type Config } from "wagmi";

const queryClient = new QueryClient();

export function Providers({ children, wagmiConfig }: { children: ReactNode; wagmiConfig: Config }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <UniswapSDKProvider>{children}</UniswapSDKProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

Render `WagmiProvider`, `QueryClientProvider`, and `UniswapSDKProvider` above every component that calls SDK hooks. The SDK provider owns SDK configuration and caching; hook consumers still need wagmi and TanStack Query contexts.

## Hooks and Components

### Access a chain-scoped SDK instance

```tsx
"use client";

import { useUniswapSDK } from "@zahastudio/uniswap-sdk-react";

export function PoolReader() {
  const { sdk, chainId } = useUniswapSDK({ chainId: 1 });

  return (
    <span>
      {sdk.getContractAddress("stateView")} on {chainId}
    </span>
  );
}
```

SDK instances are cached per chain ID. If the provider is missing or wagmi cannot provide a public client for the chain, `useUniswapSDK` throws instead of returning an uninitialized SDK.

### Run a full swap lifecycle

```tsx
"use client";

import { useSwap } from "@zahastudio/uniswap-sdk-react";
import { parseEther } from "viem";
import { useAccount } from "wagmi";

export function SwapButton() {
  const { address } = useAccount();
  const swap = useSwap(
    {
      route: [{ poolKey, hookData: "0x" }],
      exactInput: { currency: WETH, amount: parseEther("1") },
      ...(address ? { recipient: address } : {}),
      slippageBps: 50,
      useNativeToken: false,
    },
    { chainId: 1, enabled: Boolean(address), refetchInterval: 12_000 },
  );

  return (
    <button
      disabled={!address || swap.currentStep === "quote"}
      onClick={() => void swap.executeAll()}
    >
      {swap.currentStep}
    </button>
  );
}
```

`executeAll()` runs approval, Permit2, and swap execution as needed.

### Render manual swap steps

```tsx
if (swap.currentStep === "approval" && swap.steps.approval.isRequired) {
  return <button onClick={() => void swap.steps.approval.approve()}>Approve</button>;
}

if (swap.currentStep === "permit2") {
  return <button onClick={() => void swap.steps.permit2.sign()}>Sign</button>;
}

if (swap.currentStep === "swap") {
  return <button onClick={() => void swap.steps.swap.execute()}>Swap</button>;
}
```

Native ETH swaps skip approval and Permit2 automatically.

### Create a position with one-side amount computation

```tsx
"use client";

import { useCreatePosition } from "@zahastudio/uniswap-sdk-react";

export function CreatePositionButton({ recipient }: { recipient: `0x${string}` }) {
  const create = useCreatePosition(
    {
      poolKey,
      amount0: 1_000_000n,
      tickLower: -887220,
      tickUpper: 887220,
    },
    { chainId: 1 },
  );

  return (
    <button onClick={() => void create.executeAll({ recipient, slippageTolerance: 50 })}>{create.currentStep}</button>
  );
}
```

Pass exactly one of `amount0` or `amount1` when you want the hook to compute the complementary amount.
This is for pools that already have liquidity. For zero-liquidity pool creation, pass both `amount0` and `amount1` so the initial price can be derived.

## React-Specific Patterns

### Prefer hook options over ad hoc conditionals

```tsx
const position = usePosition({ tokenId }, { chainId: 1, enabled: tokenId.length > 0, refetchInterval: 12_000 });
```

Use `enabled` to delay queries until required params exist.

### Use exact-output quote fields for allowances

```tsx
const maxAmountIn = swap.steps.quote.data?.maxAmountIn;

return <span>{maxAmountIn?.toString() ?? "Quote loading"}</span>;
```

Exact-output mode bases approval, Permit2, and transaction value on `quote.maxAmountIn`.

## Common Mistakes

### CRITICAL Hook consumers outside required providers

Wrong:

```tsx
<UniswapSDKProvider>
  <SwapPage />
</UniswapSDKProvider>
```

Correct:

```tsx
<WagmiProvider config={wagmiConfig}>
  <QueryClientProvider client={queryClient}>
    <UniswapSDKProvider>
      <App />
    </UniswapSDKProvider>
  </QueryClientProvider>
</WagmiProvider>
```

SDK hook consumers read wagmi and TanStack Query context, so they must be rendered under those providers as well as `UniswapSDKProvider`.

Source: ZahaStudio/uniswap-sdk-monorepo:docs/react-sdk.md

### HIGH Polling without stable chain selection

Wrong:

```tsx
const swap = useSwap(params, { refetchInterval: 12_000 });
```

Correct:

```tsx
const swap = useSwap(params, { chainId: 1, refetchInterval: 12_000 });
```

When the app can connect to multiple chains, pass `chainId` to avoid silently querying the connected chain instead of the intended pool chain.

Source: ZahaStudio/uniswap-sdk-monorepo:docs/react-sdk.md

### HIGH Executing before quote-dependent steps settle

Wrong:

```tsx
await swap.steps.swap.execute();
```

Correct:

```tsx
const txHash = await swap.executeAll();
```

Direct execution skips the hook's step sequencing; use `executeAll()` unless the UI intentionally controls each step.

Source: ZahaStudio/uniswap-sdk-monorepo:docs/react-sdk.md

### MEDIUM Treating native ETH like ERC-20

Wrong:

```tsx
const swap = useSwap({ route, exactInput: { currency: WETH, amount }, recipient });
```

Correct:

```tsx
const swap = useSwap({ route, exactInput: { currency: WETH, amount }, recipient, useNativeToken: true });
```

Native ETH swaps route through WETH pool edges but skip ERC-20 approval and Permit2.

Source: ZahaStudio/uniswap-sdk-monorepo:docs/react-sdk.md

### MEDIUM Expecting auto-compute with both amounts

Wrong:

```tsx
useCreatePosition({ poolKey, amount0: 1_000_000n, amount1: 500_000_000_000_000_000n });
```

Correct:

```tsx
useCreatePosition({ poolKey, amount0: 1_000_000n });
```

The hook only auto-computes the complementary side when exactly one side is supplied; passing both sides uses both explicit amounts.
For zero-liquidity pool creation, both amounts are required.

Source: ZahaStudio/uniswap-sdk-monorepo:docs/react-sdk.md
