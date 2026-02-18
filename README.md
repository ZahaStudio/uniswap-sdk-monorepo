# Community Uniswap SDK

A TypeScript SDK for interacting with **Uniswap V4** — providing pool queries, token swaps, liquidity management, and Permit2 approvals out of the box. Includes first-class React bindings with hooks for every operation.

## Packages

| Package                                                         | Description                                                |
| --------------------------------------------------------------- | ---------------------------------------------------------- |
| [`@zahastudio/uniswap-sdk`](./packages/uniswap-sdk)             | Core SDK — framework-agnostic, works with any viem client  |
| [`@zahastudio/uniswap-sdk-react`](./packages/uniswap-sdk-react) | React hooks and provider built on `wagmi` + TanStack Query |

An [example](./apps/example) app is provided in the repo implementing the swap and position management flows.

## Features

- **Pool queries** — fetch real-time pool state (slot0, liquidity) via multicall
- **Swap execution** — quote, build calldata, and execute swaps through Universal Router
- **Liquidity Management** — mint, increase, decrease positions and collect fees
- **Permit2** — batch token approvals with typed signature generation
- **Built-in caching** — LRU cache with pluggable adapter interface
- **React Hooks** — step-by-step hooks for swaps, positions, approvals, and transactions

## Quick Start

### Core SDK

```bash
pnpm install @zahastudio/uniswap-sdk viem
```

```ts
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { UniswapSDK } from "@zahastudio/uniswap-sdk";

const client = createPublicClient({ chain: mainnet, transport: http() });
const sdk = UniswapSDK.create(client, mainnet.id);

// Fetch token metadata
const [weth, usdc] = await sdk.getTokens([
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
]);

// Get a quote
const quote = await sdk.getQuote({
  poolKey: {
    currency0: weth,
    currency1: usdc,
    fee: 3000,
    tickSpacing: 60,
    hooks: "0x0000000000000000000000000000000000000000",
  },
  amountIn: 1000000000000000000n, // 1 ETH
  zeroForOne: true,
});
```

### React

```bash
pnpm install @zahastudio/uniswap-sdk-react @zahastudio/uniswap-sdk viem wagmi @tanstack/react-query
```

```tsx
import { UniswapSDKProvider, useSwap, usePosition } from "@zahastudio/uniswap-sdk-react";

// Wrap your app with the provider (alongside WagmiProvider and QueryClientProvider)
function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <UniswapSDKProvider>
          <SwapPage />
        </UniswapSDKProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

Available hooks:

| Hook                             | Purpose                                               |
| -------------------------------- | ----------------------------------------------------- |
| `useUniswapSDK()`                | Access cached SDK instances by chain                  |
| `useSwap()`                      | Full swap workflow (quote, approve, permit2, execute) |
| `useCreatePosition()`            | Full position creation workflow                       |
| `usePosition()`                  | Fetch position data by token ID                       |
| `usePositionIncreaseLiquidity()` | Add liquidity to an existing position                 |
| `usePositionRemoveLiquidity()`   | Remove liquidity from a position                      |
| `usePositionCollectFees()`       | Collect accrued fees                                  |
| `useToken()`                     | Fetch token metadata and balance (primitive)          |
| `usePermit2()`                   | Permit2 signature workflow (includes approval)        |
| `useTokenApproval()`             | ERC20 approval workflow                               |
| `useTransaction()`               | Transaction lifecycle management                      |

## API Reference

### `UniswapSDK`

```ts
// Create an instance
const sdk = UniswapSDK.create(client, chainId, options?);
// options: { contracts?, cache?, defaultDeadline?, defaultSlippageTolerance? }

// Pool & token queries
await sdk.getPool(poolArgs);                        // Fetch pool state
await sdk.getTokens(addresses);                     // Fetch token metadata
await sdk.getQuote(swapArgs);                       // Simulate a swap
await sdk.getTickInfo(tickArgs);                    // Query tick data

// Position queries
await sdk.getPosition(tokenId);                     // Full position with SDK instances
await sdk.getPositionInfo(tokenId);                 // Lightweight position metadata
await sdk.getUncollectedFees(tokenId);              // Accrued fee amounts

// Transaction calldata builders (no RPC calls)
await sdk.buildSwapCallData(swapArgs);              // Universal Router swap calldata
await sdk.buildAddLiquidityCallData(addArgs);       // Position Manager mint calldata
await sdk.buildRemoveLiquidityCallData(removeArgs); // Position Manager burn calldata
await sdk.buildCollectFeesCallData(collectArgs);    // Position Manager collect calldata

// Permit2
await sdk.preparePermit2BatchData(batchArgs);       // Multi-token batch permit
```

Contract addresses are resolved automatically via [hookmate](https://github.com/akshatmittal/hookmate) for supported chains. Pass a custom `V4Contracts` object to override.

## Monorepo Structure

```
uniswap-sdk-monorepo/
├── packages/
│   ├── uniswap-sdk/          # Core SDK
│   └── uniswap-sdk-react/    # React hooks & provider
├── apps/
│   └── example/              # Next.js demo app
└── tooling/
    ├── acme-eslint/          # Shared ESLint config
    └── acme-tsconfig/        # Shared TypeScript config
```

## Development

**Requirements:** Node.js >= 24, `pnpm`

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start dev mode (watches all packages + example app)
pnpm dev

# Run tests
pnpm test

# Lint & typecheck
pnpm lint
pnpm typecheck

# Format code
pnpm format
```

### Running with Anvil (local mainnet fork)

```bash
# Terminal 1 — start the fork
pnpm anvil

# Terminal 2 — point the app at Anvil and start dev
export NEXT_PUBLIC_MAINNET_RPC_URL="http://127.0.0.1:8545"
pnpm dev
```

Import one of the Anvil private keys into your browser wallet and set the RPC URL to `http://127.0.0.1:8545`.

### Releasing

This monorepo uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing. All releases are created using GitHub Actions.

Make sure to create a changeset when submitting a PR.

```bash
pnpm changeset
```

## Examples
- An example app using this sdk to swap Clanker tokens can be found [here](https://github.com/Sneh1999/clanker-example)

## Contributors & Maintainers

This SDK is a community-built project with contributions from **Zaha Studio** (primary maintainer) and **BootNode**, with support from the **Uniswap Foundation**. We welcome all community contributions!

## License

MIT
