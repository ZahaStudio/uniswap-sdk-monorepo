# Community Uniswap SDK

A TypeScript monorepo for interacting with **Uniswap V4**, with an additional **experimental Trading SDK** for Uniswap Trading API flows. The V4 SDK provides pool queries, token swaps, liquidity management, and Permit2 approvals out of the box, and includes first-class React bindings with hooks for every operation.

## Packages

| Package                                                         | Description                                                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`@zahastudio/uniswap-sdk`](./packages/uniswap-sdk)             | Core SDK — framework-agnostic, works with any viem client                                |
| [`@zahastudio/uniswap-sdk-react`](./packages/uniswap-sdk-react) | React hooks and provider built on `wagmi` + TanStack Query                               |
| [`@zahastudio/trading-sdk`](./packages/trading-sdk)             | Experimental Trading SDK for quote, approval, and swap flows via the Uniswap Trading API |
| [`@zahastudio/trading-sdk-react`](./packages/trading-sdk-react) | Experimental React provider and hooks for the Trading SDK                                |

An [example](./apps/example) app is provided in the repo implementing swap, position management, and experimental Trading API flows.

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
import { sortTokens, UniswapSDK } from "@zahastudio/uniswap-sdk";

const client = createPublicClient({ chain: mainnet, transport: http() });
const sdk = UniswapSDK.create(client, mainnet.id);

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const [currency0, currency1] = sortTokens(WETH, USDC);

// Fetch token metadata
const [weth, usdc] = await sdk.getTokens({
  addresses: [WETH, USDC],
});

// Get a quote
const quote = await sdk.getQuote({
  route: [
    {
      poolKey: {
        currency0,
        currency1,
        fee: 3000,
        tickSpacing: 60,
        hooks: "0x0000000000000000000000000000000000000000",
      },
    },
  ],
  exactInput: {
    currency: WETH,
    amount: 1000000000000000000n,
  }, // 1 ETH
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
| `usePoolState()`                 | Fetch current pool state by pool key                  |
| `usePositionIncreaseLiquidity()` | Add liquidity to an existing position                 |
| `usePositionRemoveLiquidity()`   | Remove liquidity from a position                      |
| `usePositionCollectFees()`       | Collect accrued fees                                  |
| `useToken()`                     | Fetch token metadata and balance (primitive)          |
| `usePermit2()`                   | Permit2 signature workflow (includes approval)        |
| `useTokenApproval()`             | ERC20 approval workflow                               |
| `useTransaction()`               | Transaction lifecycle management                      |

### Trading SDK (Experimental)

The Trading SDK packages in this branch are **experimental**. Expect API and ergonomics changes while the package surface settles.

```bash
pnpm install @zahastudio/trading-sdk viem
```

```ts
import { TradingSDK } from "@zahastudio/trading-sdk";

const sdk = TradingSDK.create({
  apiKey: process.env.UNISWAP_API_KEY!,
});

const quote = await sdk.getQuote({
  type: "EXACT_INPUT",
  amount: 1000000n,
  tokenIn: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  tokenOut: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  chainId: 1,
  swapper: "0x0000000000000000000000000000000000000001",
});
```

React bindings are also available experimentally:

```bash
pnpm install @zahastudio/trading-sdk-react @zahastudio/trading-sdk viem wagmi @tanstack/react-query react
```

Use `TradingSDKProvider` and `useTrading()` for quote, approval, permit, and swap execution flows backed by the Uniswap Trading API.

## API Reference

### `UniswapSDK`

```ts
// Create an instance
const sdk = UniswapSDK.create(client, chainId, options?);
// options: { contracts?, cache?, defaultDeadline? (positive integer seconds), defaultSlippageTolerance? }

// Pool & token queries
await sdk.getPool(poolArgs);                        // Fetch pool state
await sdk.getTokens({ addresses });                 // Fetch token metadata
await sdk.getQuote(swapArgs);                       // Simulate exact-input or exact-output swaps
await sdk.getTickInfo(tickArgs);                    // Query tick data

// Position queries
await sdk.getPosition(tokenId);                     // Full position with SDK instances
await sdk.getPositionInfo(tokenId);                 // Lightweight position metadata
await sdk.getUncollectedFees(tokenId);              // Accrued fee amounts

// Transaction calldata builders (do not send transactions)
await sdk.buildSwapCallData(swapArgs);              // Universal Router swap calldata (exact in/out)
await sdk.buildAddLiquidityCallData(addArgs);       // Position Manager mint calldata
await sdk.buildRemoveLiquidityCallData(removeArgs); // Position Manager burn calldata
await sdk.buildCollectFeesCallData(collectArgs);    // Position Manager collect calldata

// Permit2
await sdk.preparePermit2BatchData(batchArgs);       // Multi-token batch permit
```

Some calldata builders fetch the latest block timestamp or position state internally to compute deadlines and position-specific params, but none of them broadcast a transaction.

Contract addresses are resolved automatically via [hookmate](https://github.com/akshatmittal/hookmate) for supported chains. Pass a custom `V4Contracts` object to override.

### `TradingSDK` (Experimental)

```ts
// Create an instance
const sdk = TradingSDK.create({ apiKey, baseUrl?, headers?, permit2Disabled? });

// Trading API flows
await sdk.getQuote(quoteArgs);             // Request a Trading API quote
await sdk.checkApproval(approvalArgs);     // Check whether approval/reset is needed
await sdk.createSwap(createSwapArgs);      // Build the executable swap transaction
```

`TradingSDK` requires a Uniswap Trading API key and is currently experimental.

## Monorepo Structure

```
uniswap-sdk-monorepo/
├── packages/
│   ├── uniswap-sdk/          # Core SDK
│   ├── uniswap-sdk-react/    # React hooks & provider
│   ├── trading-sdk/          # Experimental Trading API SDK
│   └── trading-sdk-react/    # Experimental React hooks & provider
├── apps/
│   └── example/              # Next.js demo app for V4 + experimental trading flows
└── tooling/
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
# Check formatting in CI/local
pnpm format:check
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

## AI Agent Integration

The core V4 SDK ships with comprehensive documentation designed for AI agents (Claude, Cursor, Amp, Copilot, etc.). Those docs are published under `docs/` in `@zahastudio/uniswap-sdk`.

To give your AI agent direct access to the SDK documentation, add the following line to your project's `AGENTS.md` (or equivalent):

```markdown
Read `node_modules/@zahastudio/uniswap-sdk/docs/README.md` for the full Community Uniswap SDK reference, including core SDK methods, React hooks, type definitions, and end-to-end recipes.
```

Or reference individual docs as needed:

| Path                                                     | Contents                                       |
| -------------------------------------------------------- | ---------------------------------------------- |
| `node_modules/@zahastudio/uniswap-sdk/docs/README.md`    | Overview, key concepts, decision tree          |
| `node_modules/@zahastudio/uniswap-sdk/docs/core-sdk.md`  | Core SDK class, all methods, type signatures   |
| `node_modules/@zahastudio/uniswap-sdk/docs/react-sdk.md` | React provider, all hooks, step-based patterns |
| `node_modules/@zahastudio/uniswap-sdk/docs/recipes.md`   | 10 complete copy-paste code examples           |
| `node_modules/@zahastudio/uniswap-sdk/docs/types.md`     | Core and React hook types used in these docs   |

## Contributors & Maintainers

This SDK is a community-built project with contributions from **Zaha Studio** (primary maintainer) and **BootNode**, with support from the **Uniswap Foundation**. We welcome all community contributions!

## License

MIT
